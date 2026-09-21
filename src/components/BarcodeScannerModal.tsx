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
  Monitor,
  Tablet as TabletIcon,
  Barcode,
  Radio,
  Cpu,
  Flashlight,
  FlashlightOff,
  Image as ImageIcon,
  Upload,
  FolderOpen,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { InventoryItem } from '../types';
import { playScannerBeep, findItemByBarcodeOrSku, parseAppGeneratedSku, isAppGeneratedSkuFormat } from '../utils/barcodeUtils';
import { formatNPR } from '../utils/nepalLocale';
import { CameraDiagnosticHelper } from './CameraDiagnosticHelper';
import {
  detectDeviceHardware,
  getAutoSensorCalibration,
  enumerateCameraSensors,
  AutoSensorCalibration,
  DeviceType
} from '../utils/deviceSensorDetector';

export interface ScannedBatchEntry {
  item: InventoryItem;
  quantity: number;
  scannedAt?: string;
}

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
  initialHeldItems?: ScannedBatchEntry[];
  onAddItemsToBill?: (items: ScannedBatchEntry[]) => void;
  onSellInPos?: (items: ScannedBatchEntry[]) => void;
}

export function BarcodeScannerModal({ 
  isOpen, 
  onClose, 
  onBarcodeDetected, 
  inventory,
  title,
  subtitle,
  zIndexClass = 'z-50',
  initialHeldItems,
  onAddItemsToBill,
  onSellInPos,
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

  // Auto-Sensed Hardware & Sensor Calibration State (Limited to PC, Phone, Tablet)
  const [deviceModeOverride, setDeviceModeOverride] = useState<DeviceType | null>(null);
  const [deviceHardware, setDeviceHardware] = useState(() => detectDeviceHardware());
  const [sensorCalibration, setSensorCalibration] = useState<AutoSensorCalibration>(() => 
    getAutoSensorCalibration(detectDeviceHardware(), [])
  );
  const [detectedSensorCount, setDetectedSensorCount] = useState<number>(0);
  const [hardwareScannerActive, setHardwareScannerActive] = useState<boolean>(false);

  // Torch / Flashlight state
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);

  // Continuous Multi-Scan & Held Batch Items State
  const [heldScannedItems, setHeldScannedItems] = useState<ScannedBatchEntry[]>(() => initialHeldItems || []);
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

  // Sync initialHeldItems when changed from parent
  useEffect(() => {
    if (initialHeldItems) {
      setHeldScannedItems(initialHeldItems);
    }
  }, [initialHeldItems]);

  // Switch between PC, Phone, and Tablet modes manually
  const handleSwitchDeviceMode = async (mode: DeviceType) => {
    setDeviceModeOverride(mode);
    const hw = detectDeviceHardware(mode);
    setDeviceHardware(hw);
    const cameras = await enumerateCameraSensors();
    setDetectedSensorCount(cameras.length);
    const cal = getAutoSensorCalibration(hw, cameras);
    setSensorCalibration(cal);

    if (cameras.length > 0) {
      if (mode === 'pc') {
        const frontCam = cameras.find((c) => c.isFrontCamera || c.isExternalWebcam) || cameras[0];
        if (frontCam) setSelectedCameraId(frontCam.deviceId);
      } else {
        const backCam = cameras.find((c) => c.isBackCamera) || cameras[0];
        if (backCam) setSelectedCameraId(backCam.deviceId);
      }
    }

    if (cameraActive) {
      await stopCamera();
      setTimeout(() => {
        startCamera();
      }, 250);
    }
  };

  // Auto-Probe Hardware Sensors & Auto-Start Camera immediately on Modal Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const probeHardwareAndAutoStart = async () => {
      const hw = detectDeviceHardware(deviceModeOverride || undefined);
      setDeviceHardware(hw);
      const cameras = await enumerateCameraSensors();
      if (!isMounted) return;
      setDetectedSensorCount(cameras.length);
      const cal = getAutoSensorCalibration(hw, cameras);
      setSensorCalibration(cal);

      let targetCamId = '';
      if (cameras.length > 0) {
        setAvailableCameras(
          cameras.map((c) => ({
            id: c.deviceId,
            label: c.label || `${c.isBackCamera ? 'Rear Lens' : c.isFrontCamera ? 'Webcam / Front Lens' : 'Optical Sensor'}`,
          }))
        );
        if (hw.deviceType === 'pc') {
          const frontCam = cameras.find((c) => c.isFrontCamera || c.isExternalWebcam) || cameras[0];
          if (frontCam) targetCamId = frontCam.deviceId;
        } else {
          const backCam = cameras.find((c) => c.isBackCamera) || cameras[0];
          if (backCam) targetCamId = backCam.deviceId;
        }
        if (targetCamId) setSelectedCameraId(targetCamId);
      }

      // Automatically start camera stream without asking user to click "Start Camera"
      setTimeout(() => {
        if (isMounted && isOpen) {
          startCamera(targetCamId || undefined);
        }
      }, 100);
    };

    probeHardwareAndAutoStart();

    return () => {
      isMounted = false;
    };
  }, [isOpen, deviceModeOverride]);

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
        setHardwareScannerActive(true);
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

  const handleScanSuccess = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    // Cooldown logic: avoid spamming duplicate scans of same code within 1.6s
    if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1600) {
      return;
    }
    // New barcode cooldown 500ms
    if (trimmed !== lastScannedCodeRef.current && now - lastScannedTimeRef.current < 500) {
      return;
    }

    lastScannedCodeRef.current = trimmed;
    lastScannedTimeRef.current = now;

    const matchedItem = findItemByBarcodeOrSku(inventory, trimmed);

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
      name: matchedItem?.name || '⚠️ Product Unrecognized (Not in Catalog)',
    });

    // Hold all scanned inventory items details in the active multi-scan batch
    if (matchedItem) {
      setHeldScannedItems((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.item.id === matchedItem.id);
        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          const newQty = Math.min(existing.quantity + 1, matchedItem.stockQuantity);
          const next = [...prev];
          next[existingIndex] = {
            ...existing,
            quantity: newQty,
          };
          return next;
        } else {
          return [
            {
              item: matchedItem,
              quantity: 1,
              scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev,
          ];
        }
      });
    }

    // Notify parent listener for telemetry / dashboard sync
    onBarcodeDetected(trimmed, matchedItem || undefined);
  };

  const handleUpdateHeldQuantity = (itemId: string, delta: number) => {
    setHeldScannedItems((prev) => {
      return prev
        .map((entry) => {
          if (entry.item.id === itemId) {
            const nextQty = entry.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > entry.item.stockQuantity) return entry;
            return { ...entry, quantity: nextQty };
          }
          return entry;
        })
        .filter(Boolean) as ScannedBatchEntry[];
    });
  };

  const handleRemoveHeldItem = (itemId: string) => {
    setHeldScannedItems((prev) => prev.filter((e) => e.item.id !== itemId));
  };

  const handleClearBatch = () => {
    setHeldScannedItems([]);
  };

  const handleDoneAndAddToBills = () => {
    stopCamera();
    if (onAddItemsToBill) {
      onAddItemsToBill(heldScannedItems);
    }
    onClose();
  };

  const handleDoneAndSellInPos = () => {
    stopCamera();
    if (onSellInPos) {
      onSellInPos(heldScannedItems);
    }
    onClose();
  };

  const handleInspectScannedItem = (code: string, item: InventoryItem | null) => {
    stopCamera();
    onClose();
    onBarcodeDetected(code, item || undefined);
  };

  /**
   * Helper to build video constraints automatically calibrated to detected hardware
   */
  const buildResolutionConstraints = () => {
    return {
      width: { ideal: sensorCalibration.recommendedResolution.width },
      height: { ideal: sensorCalibration.recommendedResolution.height },
      aspectRatio: { ideal: sensorCalibration.aspectRatio },
      frameRate: { ideal: sensorCalibration.targetFps },
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

      const isPc = deviceHardware.deviceType === 'pc';
      const targetCamera = cameraIdOverride || selectedCameraId;
      const targetFps = isPc ? 24 : sensorCalibration.targetFps;

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
      };

      let started = false;

      // Strategy 1: Direct deviceId (works reliably without constraint failures)
      if (targetCamera) {
        try {
          await qrCode.start(
            targetCamera,
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (targetErr) {
          console.warn('Direct deviceId start failed, trying device list:', targetErr);
        }
      }

      // Strategy 2: For PC, probe available cameras and pass the first deviceId directly
      if (!started && isPc) {
        try {
          const devices = await Html5Qrcode.getCameras().catch(() => []);
          if (devices && devices.length > 0) {
            await qrCode.start(
              devices[0].id,
              scanConfig,
              (decodedText) => handleScanSuccess(decodedText),
              () => {}
            );
            started = true;
            setSelectedCameraId(devices[0].id);
          }
        } catch (pcProbeErr) {
          console.warn('PC probe start failed, trying facingMode:', pcProbeErr);
        }
      }

      // Strategy 3: Preferred facingMode (user for PC webcam, environment for Phone/Tablet)
      if (!started) {
        const preferredFacing = isPc ? 'user' : 'environment';
        try {
          await qrCode.start(
            { facingMode: preferredFacing },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (sensorErr) {
          console.warn(`Preferred ${preferredFacing} failed, trying alternative:`, sensorErr);
        }
      }

      // Strategy 4: Alternative facingMode
      if (!started) {
        const altFacing = isPc ? 'environment' : 'user';
        try {
          await qrCode.start(
            { facingMode: altFacing },
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
        } catch (altErr) {
          console.warn('Alt facingMode failed, attempting any available camera device:', altErr);
        }
      }

      // Strategy 5: Query any available camera devices directly by device ID
      if (!started) {
        const allDevices = await Html5Qrcode.getCameras().catch(() => []);
        if (allDevices && allDevices.length > 0) {
          const fallbackCameraId = allDevices[0].id;
          await qrCode.start(
            fallbackCameraId,
            scanConfig,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          started = true;
          setSelectedCameraId(fallbackCameraId);
        } else {
          // If no cameras can be enumerated, try user facing mode as the last valid constraint
          await qrCode.start(
            { facingMode: 'user' },
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
      const devices = await Html5Qrcode.getCameras().catch(() => []);
      if (devices && devices.length > 0) {
        setAvailableCameras(
          devices.map((d) => ({
            id: d.id,
            label: d.label || `Camera Sensor ${d.id.slice(0, 5)}...`,
          }))
        );
      }
    } catch (err: any) {
      console.error('Camera startup failure:', err);
      const isPc = deviceHardware.deviceType === 'pc';
      let msg = isPc ? 'PC camera access could not be started.' : 'Camera access could not be started.';
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (errName === 'NotAllowedError' || errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError')) {
        msg = isPc
          ? 'Webcam permission was denied in your PC browser. Please click the lock or settings icon in your browser address bar to allow Camera, then tap "Start PC Camera".'
          : 'Camera permission was denied in your phone browser. Please tap the lock/settings icon in the address bar to allow Camera, or use "Snap Photo" below.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError' || errMsg.includes('Requested device not found')) {
        msg = isPc
          ? 'No webcam was detected on this PC. Please connect a USB webcam or upload a barcode image.'
          : 'No camera sensor was detected on this mobile device.';
      } else if (errName === 'NotReadableError' || errMsg.includes('Device in use') || errMsg.includes('Could not start video source')) {
        msg = isPc
          ? 'Your PC webcam is currently in use by another desktop application (e.g. Zoom, Teams, Meet). Please close that app and retry.'
          : 'Camera hardware is temporarily locked by another app. Please close other camera apps and retry.';
      } else if (isInIframe) {
        msg = isPc
          ? 'Webcam stream may be blocked inside embedded preview. Click "New Tab" above to open standalone for direct webcam access.'
          : 'Live camera stream is restricted inside this preview frame. Tap "New Tab" or tap "Snap Photo" for direct native camera access.';
      } else {
        msg = `Camera issue: ${errMsg || 'Unable to open video stream'}.`;
      }
      setCameraError(msg);
      setCameraActive(false);
      isScanningRef.current = false;
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
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
        if (isScanningRef.current) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
    // Rigorously stop any remaining camera tracks in DOM to immediately turn off the physical webcam/camera LED
    try {
      const container = document.getElementById('reader-viewport');
      const video = container?.querySelector('video');
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    } catch {
      // ignore
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
      console.warn('Torch toggle not supported on this lens:', e);
    }
  };

  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    if (cameraActive) {
      await stopCamera();
      await startCamera(newCamId);
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

  const renderDeviceIcon = () => {
    switch (deviceHardware.deviceType) {
      case 'phone':
        return <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'tablet':
        return <TabletIcon className="w-4 h-4 text-sky-600 shrink-0" />;
      case 'pc':
      default:
        return <Monitor className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
  };

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
                  {title || 'Barcode Scanner & Sensor Reader'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full">
                  Auto-Calibrated
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {subtitle || 'Device Calibration: PC / Laptop, Phone, Tablet'}
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

        <div className="py-3 space-y-3 overflow-y-auto pr-0.5 max-h-[70vh]">
          {/* Camera Viewport Container - Always Live for Continuous Scanning */}
          <div className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 min-h-[220px]">
            {/* Target element for Html5Qrcode video & canvas rendering */}
            <div 
              id="reader-viewport" 
              className="w-full min-h-[220px] flex items-center justify-center [&_video]:w-full [&_video]:max-h-[260px] [&_video]:object-cover"
            />

            {/* Inactive Standby Screen Overlay */}
            {!cameraActive && !isStartingCamera && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-slate-400 z-10">
                {deviceHardware.deviceType === 'pc' ? (
                  <Monitor className="w-10 h-10 text-indigo-400 mb-2" />
                ) : deviceHardware.deviceType === 'tablet' ? (
                  <TabletIcon className="w-10 h-10 text-amber-400 mb-2" />
                ) : (
                  <Smartphone className="w-10 h-10 text-emerald-400 mb-2" />
                )}
                <p className="text-xs text-slate-100 font-semibold">
                  Auto-Opening Camera Scanner...
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Continuous multi-scan is ready. Point your camera at product barcodes or SKUs.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera Stream
                </button>
              </div>
            )}

            {/* Loading / Initializing Overlay */}
            {isStartingCamera && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 text-white z-20 backdrop-blur-xs">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-bold">
                  Connecting to Camera...
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Continuous multi-scan mode activating</p>
              </div>
            )}

            {/* Photo Analyzing Spinner */}
            {isScanningPhoto && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-6 text-white z-20 backdrop-blur-xs">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <p className="text-xs font-bold">Decoding Barcode from Image...</p>
                <p className="text-[11px] text-slate-400 mt-0.5">High-resolution image decoding</p>
              </div>
            )}

            {/* Live Camera State Indicator Pill on Viewfinder */}
            {cameraActive && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-emerald-500/50 pointer-events-none z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-bold text-emerald-300 tracking-wider">
                  CONTINUOUS SCAN ACTIVE
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
                  className={`w-60 h-32 border-2 rounded-xl relative transition-all duration-300 ${
                    scanPulse
                      ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)] scale-105'
                      : 'border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                  }`}
                >
                  <div className={`absolute inset-x-0 top-1/2 h-0.5 ${scanPulse ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse'}`} />
                  <span className="absolute -bottom-6 inset-x-0 text-center text-[10px] font-mono text-emerald-300 bg-slate-950/85 py-0.5 px-2 rounded-full mx-auto w-fit">
                    {scanPulse ? 'BARCODE CAPTURED' : 'READY FOR NEXT SCAN'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Controls Bar: Lens switcher, New Tab, Upload Photo */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-1">
              {availableCameras.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 flex-1 max-w-[200px]">
                  <SwitchCamera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedCameraId}
                    onChange={(e) => handleCameraChange(e.target.value)}
                    className="w-full text-[11px] bg-transparent text-slate-700 focus:outline-none"
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

            <div className="flex items-center gap-1.5">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handleNativeCameraCapture}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isScanningPhoto}
                title="Scan barcode from image file"
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Barcode</span>
              </button>
            </div>
          </div>

          {/* Camera Error Message */}
          {cameraError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-900">Camera Message</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{cameraError}</p>
              </div>
            </div>
          )}

          {/* HELD SCANNED INVENTORY ITEMS SECTION (Live Multi-Scan Queue) */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-emerald-600 text-white rounded-md">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  Scanned Items Queue ({heldScannedItems.reduce((s, e) => s + e.quantity, 0)} Units)
                </h4>
              </div>
              {heldScannedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBatch}
                  className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors font-medium cursor-pointer"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {heldScannedItems.length === 0 ? (
              <div className="py-4 px-3 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                <Scan className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">No items scanned yet in this session</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Point camera or use laser scanner to continuously queue items for Sales & Bills.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {heldScannedItems.map(({ item, quantity }) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                          {item.brand}
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                        <span>SKU: {item.sku}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-bold font-sans">
                          {formatNPR(item.sellingPrice)} each
                        </span>
                        <span>•</span>
                        <span className={item.stockQuantity <= item.reorderLevel ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                          Stock: {item.stockQuantity}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Modifiers & Subtotal */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleUpdateHeldQuantity(item.id, -1)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-900 font-mono">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateHeldQuantity(item.id, 1)}
                          disabled={quantity >= item.stockQuantity}
                          className="p-1 hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <p className="text-xs font-black text-slate-900 font-mono">
                          {formatNPR(item.sellingPrice * quantity)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveHeldItem(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Queue Financial Totals Summary Bar */}
            {heldScannedItems.length > 0 && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-bold">
                  Queue Total ({heldScannedItems.reduce((s, e) => s + e.quantity, 0)} items)
                </span>
                <span className="text-emerald-950 font-black font-mono text-sm">
                  {formatNPR(
                    heldScannedItems.reduce((acc, entry) => acc + entry.item.sellingPrice * entry.quantity, 0)
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Manual Barcode or SKU Entry Box */}
          <div className="pt-1">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Laser Scanner Gun / Manual Barcode Input
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
                placeholder="Scan with laser gun or type SKU..."
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleScanSuccess(manualCode)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Enter
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions for Bills & POS */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="font-medium text-emerald-800">
              Camera live • Ready for next scan
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {/* Button 2: Done (Add all scanned items to Current Sales & Bills) */}
            <button
              type="button"
              onClick={handleDoneAndAddToBills}
              disabled={heldScannedItems.length === 0}
              className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                Done {heldScannedItems.length > 0 ? `(${heldScannedItems.reduce((s, e) => s + e.quantity, 0)} to Bill)` : ''}
              </span>
            </button>

            {/* Button 3: Sell in POS */}
            <button
              type="button"
              onClick={handleDoneAndSellInPos}
              disabled={heldScannedItems.length === 0}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>
                Sell in POS {heldScannedItems.length > 0 ? `(${heldScannedItems.reduce((s, e) => s + e.quantity, 0)})` : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
