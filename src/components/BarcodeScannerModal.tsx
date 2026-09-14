import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  Scan, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Volume2, 
  Keyboard, 
  ExternalLink,
  SwitchCamera,
  Loader2
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { InventoryItem } from '../types';
import { playScannerBeep } from '../utils/barcodeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string, foundItem?: InventoryItem) => void;
  inventory: InventoryItem[];
  title?: string;
  subtitle?: string;
  zIndexClass?: string;
}

export function BarcodeScannerModal({ 
  isOpen, 
  onClose, 
  onBarcodeDetected, 
  inventory,
  title,
  subtitle,
  zIndexClass = 'z-50'
}: Props) {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{ code: string; name?: string } | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<number>(0);

  // Check if running inside iframe preview
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Hardware Laser Barcode Scanner Listener (USB / Bluetooth guns)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();
    let isFastBurst = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isManualInput = activeEl?.id === 'barcode-manual-input';

      const currentTime = Date.now();
      const timeSinceLastKey = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Hardware barcode scanners type extremely fast (< 45ms per character)
      if (timeSinceLastKey < 50) {
        isFastBurst = true;
      } else if (timeSinceLastKey > 150) {
        buffer = '';
        isFastBurst = false;
      }

      if (e.key === 'Enter') {
        // If it was a fast burst from a physical scanner or entered into a non-input element
        if (buffer.length >= 3 && (isFastBurst || !activeEl || activeEl.tagName !== 'INPUT' || isManualInput)) {
          if (activeEl?.tagName === 'INPUT') {
            (activeEl as HTMLInputElement).blur();
          }
          handleScanSuccess(buffer);
          buffer = '';
          isFastBurst = false;
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, inventory]);

  // Enumerate cameras when modal opens
  useEffect(() => {
    if (!isOpen) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}...` })));
          // Prefer environment/back camera if found
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not enumerate cameras yet:', err);
      });
  }, [isOpen]);

  const handleScanSuccess = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Prevent duplicate scans within 1.5 seconds
    const now = Date.now();
    if (now - lastScannedTimeRef.current < 1500) return;
    lastScannedTimeRef.current = now;

    const matchedItem = inventory.find(
      (item) => item.barcode === trimmed || item.sku.toLowerCase() === trimmed.toLowerCase()
    );

    playScannerBeep(!matchedItem);
    setLastScannedResult({
      code: trimmed,
      name: matchedItem?.name || 'Item Not Found in Catalog',
    });

    // Close camera, close modal, and hand over to App for ScannedProductDashboardModal
    stopCamera();
    onClose();
    onBarcodeDetected(trimmed, matchedItem);
  };

  const startCamera = async (cameraIdOverride?: string) => {
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      // Ensure any existing scanner instance is cleaned up
      if (html5QrCodeRef.current) {
        try {
          if (isScanningRef.current) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch (e) {
          console.warn('Cleanup error', e);
        }
        html5QrCodeRef.current = null;
        isScanningRef.current = false;
      }

      // Create instance supporting retail 1D & 2D barcode formats
      const qrCode = new Html5Qrcode('reader-viewport', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = qrCode;

      const targetCamera = cameraIdOverride || selectedCameraId;
      const cameraConfig = targetCamera
        ? { deviceId: { exact: targetCamera } }
        : { facingMode: 'environment' };

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.min(viewfinderWidth * 0.85, 320),
            height: Math.min(viewfinderHeight * 0.55, 180),
          };
        },
        aspectRatio: 1.333333,
      };

      try {
        await qrCode.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Ignored per-frame decode attempt misses
          }
        );
      } catch (firstErr) {
        console.warn('First camera config attempt failed, trying fallback to any available camera:', firstErr);
        // Fallback to front camera or default video device
        await qrCode.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      }

      isScanningRef.current = true;
      setCameraActive(true);

      // Refresh camera list with real labels once permission is granted
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}...` })));
      }
    } catch (err: any) {
      console.error('Camera startup failure:', err);
      let msg = 'Camera access could not be started.';
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (err?.name === 'NotFoundError') {
        msg = 'No camera device found on this computer. You can use manual entry, quick-test buttons, or a USB scanner.';
      } else if (isInIframe) {
        msg = 'Camera stream was restricted by the preview frame. Click "Open in New Tab" below for direct hardware camera access.';
      } else {
        msg = `Camera issue: ${err?.message || 'Unable to open video stream'}. You can still scan using manual entry or a USB laser scanner.`;
      }
      setCameraError(msg);
      setCameraActive(false);
      isScanningRef.current = false;
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
    isScanningRef.current = false;
    setCameraActive(false);
  };

  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    if (cameraActive) {
      await stopCamera();
      await startCamera(newCamId);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScannedResult(null);
      setManualCode('');
      setCameraError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs`}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {title || 'Barcode Scanner & Reader'}
              </h3>
              <p className="text-xs text-slate-500">
                {subtitle || 'Live Camera, USB Handheld Lasers, & 1-Click Tests'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-3.5 overflow-y-auto pr-0.5">
          {/* Hardware Laser Scanner Status Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-800">
                USB/Bluetooth Laser Gun: Ready
              </span>
            </div>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" /> Auto-Beep on Scan
            </span>
          </div>

          {/* Camera Viewport Container */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden min-h-[220px] flex items-center justify-center border border-slate-800">
            {/* Target element for Html5Qrcode video & canvas rendering */}
            <div 
              id="reader-viewport" 
              className={`w-full h-full min-h-[220px] ${cameraActive ? 'block' : 'hidden'}`} 
            />

            {/* Inactive Placeholder Screen */}
            {!cameraActive && (
              <div className="text-center p-6 text-slate-400 flex flex-col items-center justify-center">
                <Camera className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-xs text-slate-300 font-medium">Camera Standby</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Works with laptop webcams, USB cameras, and mobile phone lenses.
                </p>
              </div>
            )}

            {/* Reticle guide line during active scanning */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-36 border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                  <span className="absolute -bottom-6 inset-x-0 text-center text-[10px] font-mono text-emerald-300 bg-slate-950/80 py-0.5 px-2 rounded-full mx-auto w-fit">
                    ALIGN BARCODE INSIDE FRAME
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls & Camera Selector */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  onClick={() => startCamera()}
                  disabled={isStartingCamera}
                  className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  {isStartingCamera ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening Camera...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Start Camera Scanner
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  Stop Camera
                </button>
              )}

              {/* Open in New Tab button if in preview iframe or having issues */}
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                title="Open app in a new full browser window for direct hardware camera access"
                className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            </div>

            {/* Camera Switcher Dropdown (if device has multiple cameras, e.g. Front/Back/Webcam) */}
            {availableCameras.length > 1 && (
              <div className="flex items-center gap-2 px-1">
                <SwitchCamera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="w-full text-xs py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Camera Error / Troubleshooting Notification */}
          {cameraError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-medium">{cameraError}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in New Window (Grants Direct Access)
                </button>
              </div>
            </div>
          )}

          {/* Last scanned feedback banner */}
          {lastScannedResult && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold">{lastScannedResult.name}</p>
                  <p className="font-mono-num text-[11px] text-emerald-700">
                    Barcode: {lastScannedResult.code}
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 font-bold">
                SCANNED
              </span>
            </div>
          )}

          {/* Manual Barcode or SKU Entry */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Manual Barcode or SKU Entry
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScanSuccess(manualCode);
                }}
                placeholder="Scan with gun or type e.g. 195949012345"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleScanSuccess(manualCode)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Submit
              </button>
            </div>
          </div>

          {/* 1-Click Simulation Barcode Test Deck */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Quick-Test Retail Barcodes (Simulate Scan)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              <button
                onClick={() => handleScanSuccess('8901234567890')}
                className="text-left p-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/60 transition-all text-xs"
              >
                <p className="font-bold text-amber-900 truncate">Test Uncataloged Product</p>
                <p className="font-mono-num text-[10px] text-amber-700">
                  8901234567890 (Not in inventory)
                </p>
              </button>
              {inventory.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleScanSuccess(item.barcode)}
                  className="text-left p-2 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-xs"
                >
                  <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                  <p className="font-mono-num text-[10px] text-slate-500">
                    {item.barcode} ({item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Sold out'})
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}

