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
  Loader2,
  HelpCircle,
  Eye,
  Check,
  RotateCcw,
  Sparkles,
  Smartphone,
  Sliders,
  Flashlight,
  FlashlightOff,
  Image as ImageIcon
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { InventoryItem } from '../types';
import { playScannerBeep } from '../utils/barcodeUtils';
import { formatNPR } from '../utils/nepalLocale';
import { CameraDiagnosticHelper } from './CameraDiagnosticHelper';
import { 
  PHONE_SPECS_PROFILES, 
  PhoneCameraSpecs, 
  CustomPhoneCameraSpecs, 
  detectPhoneProfile 
} from '../utils/phoneSpecsProfiles';

interface SessionScan {
  id: string;
  code: string;
  item: InventoryItem | null;
  time: string;
}

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
  const [isScanningPhoto, setIsScanningPhoto] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{ code: string; name?: string } | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  // Phone Specs & Hardware Profile State
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => detectPhoneProfile().id);
  const [showSpecsConfig, setShowSpecsConfig] = useState<boolean>(false);
  const [customSpecs, setCustomSpecs] = useState<CustomPhoneCameraSpecs>({
    enabled: false,
    resolution: '720p',
    aspectRatio: '4:3',
    fps: 15,
    facingMode: 'environment',
  });

  // Torch / Flashlight state
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);

  // Continuous Scan & Hold Camera Mode
  const [holdCameraOnFrame, setHoldCameraOnFrame] = useState<boolean>(true);
  const [sessionScans, setSessionScans] = useState<SessionScan[]>([]);
  const [recentScan, setRecentScan] = useState<{
    code: string;
    item: InventoryItem | null;
    timestamp: number;
  } | null>(null);
  const [scanPulse, setScanPulse] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const currentProfile = PHONE_SPECS_PROFILES.find((p) => p.id === selectedProfileId) || PHONE_SPECS_PROFILES[0];

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
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
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

    const now = Date.now();
    // Cooldown logic: avoid spamming duplicate scans of same code within 2.2s while holding camera on frame
    if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2200) {
      return;
    }
    // New barcode cooldown 600ms
    if (trimmed !== lastScannedCodeRef.current && now - lastScannedTimeRef.current < 600) {
      return;
    }

    lastScannedCodeRef.current = trimmed;
    lastScannedTimeRef.current = now;

    const matchedItem = inventory.find(
      (item) => item.barcode === trimmed || item.sku.toLowerCase() === trimmed.toLowerCase()
    ) || null;

    playScannerBeep(!matchedItem);

    // Visual pulse on viewfinder
    setScanPulse(true);
    setTimeout(() => setScanPulse(false), 700);

    const scanRecord: SessionScan = {
      id: `${now}-${Math.random().toString(36).substring(2, 6)}`,
      code: trimmed,
      item: matchedItem,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setSessionScans((prev) => [scanRecord, ...prev.slice(0, 19)]);
    setRecentScan({
      code: trimmed,
      item: matchedItem,
      timestamp: now,
    });
    setLastScannedResult({
      code: trimmed,
      name: matchedItem?.name || 'Item Not Found in Catalog',
    });

    // When Hold Camera on Frame is ACTIVE:
    // Do NOT stop camera or close modal! The video feed stays on frame.
    if (!holdCameraOnFrame) {
      stopCamera();
      onClose();
      onBarcodeDetected(trimmed, matchedItem || undefined);
    }
  };

  const handleInspectScannedItem = (code: string, item: InventoryItem | null) => {
    stopCamera();
    onClose();
    onBarcodeDetected(code, item || undefined);
  };

  /**
   * Helper to build video constraints based on active phone profile or custom specs
   */
  const buildResolutionConstraints = () => {
    if (customSpecs.enabled) {
      const resMap: Record<string, { width: number; height: number }> = {
        '1080p': { width: 1920, height: 1080 },
        '720p': { width: 1280, height: 720 },
        '480p': { width: 640, height: 480 },
        '360p': { width: 480, height: 360 },
      };
      const res = resMap[customSpecs.resolution] || { width: 1280, height: 720 };
      const ratio = customSpecs.aspectRatio === '16:9' ? 1.777778 : customSpecs.aspectRatio === '1:1' ? 1.0 : 1.333333;
      return {
        width: { ideal: res.width },
        height: { ideal: res.height },
        aspectRatio: { ideal: ratio },
        frameRate: { ideal: customSpecs.fps },
      };
    }

    return {
      width: { ideal: currentProfile.recommendedResolution.width },
      height: { ideal: currentProfile.recommendedResolution.height },
      aspectRatio: { ideal: currentProfile.aspectRatio },
      frameRate: { ideal: currentProfile.targetFps },
    };
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
      const targetFps = customSpecs.enabled ? customSpecs.fps : currentProfile.targetFps;
      const targetRatio = customSpecs.enabled 
        ? (customSpecs.aspectRatio === '16:9' ? 1.777778 : 1.333333) 
        : currentProfile.aspectRatio;

      const scanConfig = {
        fps: targetFps,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const w = viewfinderWidth > 0 ? viewfinderWidth : 320;
          const h = viewfinderHeight > 0 ? viewfinderHeight : 240;
          return {
            width: Math.min(Math.floor(w * 0.88), 340),
            height: Math.min(Math.floor(h * 0.58), 200),
          };
        },
        aspectRatio: targetRatio,
      };

      const resConstraints = buildResolutionConstraints();
      let started = false;

      // Attempt 1: Target Camera Device ID with Phone Specs Constraints
      if (targetCamera) {
        try {
          await qrCode.start(
            { 
              deviceId: { exact: targetCamera },
              ...resConstraints
            },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (targetErr) {
          console.warn('Exact deviceId with phone specs constraints failed, falling back to facingMode:', targetErr);
        }
      }

      // Attempt 2: Selected Phone Profile Facing Mode (Environment Rear Sensor) with Phone Specs
      if (!started) {
        try {
          const facing = customSpecs.enabled ? customSpecs.facingMode : currentProfile.facingMode;
          await qrCode.start(
            { 
              facingMode: { ideal: facing },
              ...resConstraints
            },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (phoneProfileErr) {
          console.warn('Phone specs facingMode failed, trying pure environment lens:', phoneProfileErr);
        }
      }

      // Attempt 3: Relaxed Environment Rear Lens without resolution bounds
      if (!started) {
        try {
          await qrCode.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (envErr) {
          console.warn('Environment facingMode failed, falling back to front / user lens:', envErr);
        }
      }

      // Attempt 4: Front / User Lens Fallback
      if (!started) {
        try {
          await qrCode.start(
            { facingMode: 'user' },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (frontErr) {
          console.warn('Front camera failed, attempting basic stream:', frontErr);
          // Final Attempt: Any available video stream
          await qrCode.start(
            {} as any,
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        }
      }

      isScanningRef.current = true;
      setCameraActive(true);

      // Check if torch is supported on the running track
      try {
        const caps = qrCode.getRunningTrackCameraCapabilities();
        if (caps && (caps as any).torchFeature?.isSupported?.()) {
          setSupportsTorch(true);
        } else {
          setSupportsTorch(false);
        }
      } catch {
        setSupportsTorch(false);
      }

      // Refresh camera list with real device labels once permission is granted
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setAvailableCameras(
          devices.map((d) => ({
            id: d.id,
            label: d.label || `Camera ${d.id.slice(0, 5)}...`,
          }))
        );
      }
    } catch (err: any) {
      console.error('Camera startup failure:', err);
      let msg = 'Camera access could not be started.';
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (errName === 'NotAllowedError' || errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError')) {
        msg = 'Camera permission was denied in your mobile browser. Please tap the lock/settings icon in the browser address bar to allow Camera, or use "Snap with Phone Camera" below.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errMsg.includes('Requested device not found')) {
        msg = 'No camera device found on this phone. You can use the "Snap with Phone Camera" button, manual entry, or quick-test buttons.';
      } else if (errName === 'NotReadableError' || errMsg.includes('Device in use') || errMsg.includes('Could not start video source')) {
        msg = 'Phone camera hardware is temporarily locked by another app (e.g. WhatsApp, Camera). Please close other camera apps, or try the "Snap with Phone Camera" button below.';
      } else if (isInIframe) {
        msg = 'Live camera stream is restricted inside this preview frame. Tap "Open Standalone Tab" or tap "Snap with Phone Camera" for direct native phone camera access.';
      } else {
        msg = `Camera issue: ${errMsg || 'Unable to open video stream'}. You can switch Phone Specs profile, open in a new tab, or tap "Snap with Phone Camera".`;
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
        if (isTorchOn) {
          try {
            await html5QrCodeRef.current.applyVideoConstraints({
              advanced: [{ torch: false } as any],
            });
          } catch {
            // ignore
          }
        }
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
    isScanningRef.current = false;
    setCameraActive(false);
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScanningRef.current) return;
    try {
      const nextTorch = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle not supported on this phone lens:', e);
    }
  };

  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    if (cameraActive) {
      await stopCamera();
      await startCamera(newCamId);
    }
  };

  const handleProfileChange = async (newProfileId: string) => {
    setSelectedProfileId(newProfileId);
    if (cameraActive) {
      await stopCamera();
      // Restart with new profile
      setTimeout(() => {
        startCamera();
      }, 100);
    }
  };

  /**
   * 100% Fail-safe Native Mobile Camera Capture (Snap & Scan)
   * Opens the phone's native camera shutter (Samsung Camera, Pixel Camera, MIUI Camera, etc.)
   * Reads photo and decodes barcode without any WebRTC or browser permission limits!
   */
  const handleNativeCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningPhoto(true);
    setCameraError(null);

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('reader-viewport', {
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
        html5QrCodeRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, false);
      if (decodedText) {
        handleScanSuccess(decodedText);
      } else {
        setCameraError('No barcode was detected in that photo. Please ensure the barcode is clearly visible and well-lit, then try again.');
      }
    } catch (err: any) {
      console.warn('Scan file error:', err);
      setCameraError('Could not read a barcode from the photo. Make sure the barcode lines are sharply focused and fill most of the picture.');
    } finally {
      setIsScanningPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScannedResult(null);
      setRecentScan(null);
      setManualCode('');
      setCameraError(null);
      setIsTorchOn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs`}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {title || 'Barcode Scanner & Reader'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full">
                  Phone Specs Ready
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {subtitle || 'Samsung, Xiaomi, Pixel, OnePlus presets + Native Camera Shutter'}
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

        <div className="py-3 space-y-3 overflow-y-auto pr-0.5">
          {/* Phone Specs & Hardware Profile Selector Bar */}
          <div className="bg-gradient-to-r from-slate-50 to-emerald-50/40 border border-slate-200 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Phone Model & Camera Specs:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecsConfig(!showSpecsConfig)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                {showSpecsConfig ? 'Hide Specs' : 'Fine-Tune Specs'}
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="w-full text-xs font-semibold py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PHONE_SPECS_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Status Pill on active specs */}
              <div className="flex items-center justify-between px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600">
                <span className="font-medium text-slate-500">Preset Target:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {customSpecs.enabled ? customSpecs.resolution : `${currentProfile.recommendedResolution.height}p`} • {customSpecs.enabled ? customSpecs.fps : currentProfile.targetFps}fps
                </span>
              </div>
            </div>

            {/* Expanded Fine-Tune Specs Panel */}
            {showSpecsConfig && (
              <div className="pt-2 border-t border-slate-200/80 text-xs space-y-2.5 bg-white p-2.5 rounded-lg border border-slate-200">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">{currentProfile.name}:</strong> {currentProfile.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <label className="block text-slate-500 font-medium mb-0.5">Resolution</label>
                    <select
                      value={customSpecs.resolution}
                      onChange={(e) => {
                        setCustomSpecs((prev) => ({ ...prev, enabled: true, resolution: e.target.value as any }));
                      }}
                      className="w-full py-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
                    >
                      <option value="720p">720p HD (Best)</option>
                      <option value="1080p">1080p FHD (Sharp)</option>
                      <option value="480p">480p SD (Fast)</option>
                      <option value="360p">360p (Low RAM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-0.5">Aspect Ratio</label>
                    <select
                      value={customSpecs.aspectRatio}
                      onChange={(e) => {
                        setCustomSpecs((prev) => ({ ...prev, enabled: true, aspectRatio: e.target.value as any }));
                      }}
                      className="w-full py-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
                    >
                      <option value="4:3">4:3 (Standard)</option>
                      <option value="16:9">16:9 (Wide)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-0.5">Framerate</label>
                    <select
                      value={customSpecs.fps}
                      onChange={(e) => {
                        setCustomSpecs((prev) => ({ ...prev, enabled: true, fps: Number(e.target.value) as any }));
                      }}
                      className="w-full py-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
                    >
                      <option value={15}>15 FPS (Smooth)</option>
                      <option value={24}>24 FPS (Fast)</option>
                      <option value={10}>10 FPS (Low CPU)</option>
                      <option value={30}>30 FPS (Max)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-medium mb-0.5">Lens Direction</label>
                    <select
                      value={customSpecs.facingMode}
                      onChange={(e) => {
                        setCustomSpecs((prev) => ({ ...prev, enabled: true, facingMode: e.target.value as any }));
                      }}
                      className="w-full py-1 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[11px]"
                    >
                      <option value="environment">Rear (Back Lens)</option>
                      <option value="user">Front (Selfie Lens)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Tuning: {currentProfile.tuningNotes}</span>
                  {customSpecs.enabled && (
                    <button
                      type="button"
                      onClick={() => setCustomSpecs((prev) => ({ ...prev, enabled: false }))}
                      className="text-rose-600 font-semibold hover:underline"
                    >
                      Reset to Profile Default
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Camera Viewport Container */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden min-h-[230px] flex items-center justify-center border border-slate-800">
            {/* Target element for Html5Qrcode video & canvas rendering.
                IMPORTANT: Keep it in normal DOM flow so its clientWidth & clientHeight are never 0 */}
            <div 
              id="reader-viewport" 
              className="w-full min-h-[230px] flex items-center justify-center [&_video]:w-full [&_video]:max-h-[290px] [&_video]:object-cover"
            />

            {/* Inactive Standby Screen Overlay - Only rendered when camera is not actively streaming */}
            {!cameraActive && !isStartingCamera && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-slate-400 z-10">
                <Camera className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-xs text-slate-200 font-semibold">Live Camera Ready</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Tap <strong>"Start Camera Scanner"</strong> below to launch using your <strong>{currentProfile.brand}</strong> phone specs.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                    Profile: {currentProfile.name.split('(')[0]}
                  </span>
                </div>
              </div>
            )}

            {/* Loading / Initializing Overlay */}
            {isStartingCamera && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 text-white z-20 backdrop-blur-xs">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-bold">Applying {currentProfile.brand} Phone Specs...</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Negotiating camera hardware stream</p>
              </div>
            )}

            {/* Photo Analyzing Spinner */}
            {isScanningPhoto && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 text-white z-20 backdrop-blur-xs">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-bold">Analyzing Barcode from Phone Photo...</p>
                <p className="text-[11px] text-slate-400 mt-0.5">High-resolution image decoding</p>
              </div>
            )}

            {/* Live Camera State Indicator Pill on Viewfinder */}
            {cameraActive && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 rounded-full border border-emerald-500/50 pointer-events-none z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-bold text-emerald-300 tracking-wider">
                  LIVE • {currentProfile.brand.toUpperCase()} {holdCameraOnFrame ? '• HOLD ON FRAME' : ''}
                </span>
              </div>
            )}

            {/* Torch / Flashlight Toggle Button on Viewfinder */}
            {cameraActive && supportsTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg border z-10 transition-colors ${
                  isTorchOn 
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]' 
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {isTorchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
              </button>
            )}

            {/* Reticle guide line during active scanning */}
            {cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div
                  className={`w-64 h-36 border-2 rounded-xl relative transition-all duration-300 ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)] scale-105'
                      : 'border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                  }`}
                >
                  <div className={`absolute inset-x-0 top-1/2 h-0.5 ${scanPulse ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'}`} />
                  <span className="absolute -bottom-6 inset-x-0 text-center text-[10px] font-mono text-emerald-300 bg-slate-950/85 py-0.5 px-2 rounded-full mx-auto w-fit">
                    {scanPulse ? 'BARCODE CAPTURED' : 'ALIGN BARCODE INSIDE FRAME'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Controls: Live Camera & Fail-safe Native Shutter */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  disabled={isStartingCamera || isScanningPhoto}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  {isStartingCamera ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting Camera ({currentProfile.brand})...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Start Camera ({currentProfile.brand})
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Stop Camera
                </button>
              )}

              {/* Toggle Diagnostics */}
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                title="View Camera Diagnostics & Mobile Permissions Guide"
                className="py-2.5 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Diagnostics</span>
              </button>

              {/* Open in Standalone Tab button */}
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                title="Open app in a new full browser window for direct hardware camera access"
                className="py-2.5 px-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            </div>

            {/* Native Android/iOS Camera Shutter Fallback (100% Guaranteed on all phones) */}
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-left">
                <div className="p-1.5 bg-amber-200/80 rounded-lg text-amber-900 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    Snap Barcode with Phone Camera App
                  </p>
                  <p className="text-[11px] text-amber-800/90">
                    Bypasses all browser permission & WebRTC blocks. Opens your phone's native camera shutter.
                  </p>
                </div>
              </div>

              {/* Hidden File Input with capture="environment" for Android / iOS */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleNativeCameraCapture}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isScanningPhoto}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {isScanningPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Reading...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    Snap Photo
                  </>
                )}
              </button>
            </div>

            {/* Camera Switcher Dropdown (Front/Back/External lenses) */}
            {availableCameras.length > 1 && (
              <div className="flex items-center gap-2 px-1">
                <SwitchCamera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

          {/* Active Scanned Item Card (Held while camera remains running) */}
          {recentScan && (
            <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 text-xs shadow-xs space-y-2 animate-fadeIn">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-emerald-200/80 rounded-lg text-emerald-800 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {recentScan.item ? recentScan.item.name : 'Uncataloged Barcode Detected'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-600">
                      <span className="font-mono bg-white px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                        {recentScan.code}
                      </span>
                      {recentScan.item && (
                        <>
                          <span className="font-bold text-slate-800">
                            {formatNPR(recentScan.item.sellingPrice)}
                          </span>
                          <span className={recentScan.item.stockQuantity > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-bold'}>
                            {recentScan.item.stockQuantity > 0 ? `${recentScan.item.stockQuantity} in stock` : 'Out of stock'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 uppercase tracking-wider shrink-0">
                  CAPTURED
                </span>
              </div>

              {/* Action Buttons for Scanned Item */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/60">
                <span className="text-[10px] text-emerald-800 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Camera is held live — point at another item to scan again
                </span>
                <button
                  type="button"
                  onClick={() => handleInspectScannedItem(recentScan.code, recentScan.item)}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3 h-3" />
                  {recentScan.item ? 'Inspect / Use Item' : 'Register New Item'}
                </button>
              </div>
            </div>
          )}

          {/* Session Scanned Items Log (When multiple items are scanned without stopping camera) */}
          {sessionScans.length > 1 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">
                  Scanned in this Session ({sessionScans.length} items)
                </span>
                <button
                  type="button"
                  onClick={() => setSessionScans([])}
                  className="text-slate-400 hover:text-slate-600 text-[10px] flex items-center gap-0.5"
                >
                  <RotateCcw className="w-3 h-3" /> Clear Log
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {sessionScans.slice(0, 8).map((scan) => (
                  <button
                    key={scan.id}
                    type="button"
                    onClick={() => handleInspectScannedItem(scan.code, scan.item)}
                    className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-[10px] font-medium text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <span className="font-semibold truncate max-w-[110px]">
                      {scan.item ? scan.item.name : scan.code}
                    </span>
                    <span className="text-slate-400 font-mono text-[9px]">{scan.time}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera Diagnostic & Mobile Permission Helper */}
          {(showDiagnostics || cameraError) && (
            <CameraDiagnosticHelper
              activeError={cameraError}
              onRetryCamera={() => startCamera()}
              defaultExpanded={true}
            />
          )}

          {/* Manual Barcode or SKU Entry */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Manual Barcode or SKU Entry
            </label>
            <div className="flex gap-2">
              <input
                id="barcode-manual-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleScanSuccess(manualCode);
                }}
                placeholder="Scan with laser gun or type e.g. 195949012345"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleScanSuccess(manualCode)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => handleScanSuccess('8901234567890')}
                className="text-left p-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/60 transition-all text-xs cursor-pointer"
              >
                <p className="font-bold text-amber-900 truncate">Test Uncataloged Product</p>
                <p className="font-mono-num text-[10px] text-amber-700">
                  8901234567890 (Not in inventory)
                </p>
              </button>
              {inventory.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleScanSuccess(item.barcode)}
                  className="text-left p-2 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-xs cursor-pointer"
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
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {cameraActive ? (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                {currentProfile.brand} camera live on frame
              </span>
            ) : (
              <span>Camera is stopped</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {cameraActive && (
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Stop Camera
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Close Scanner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
