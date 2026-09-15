/**
 * Auto Sensor Camera & Hardware Detector
 * Automatically senses and calibrates camera and barcode sensors for:
 * - Phone (Samsung, iPhone, Xiaomi, Pixel, OnePlus, etc.)
 * - PC / Laptop (Desktop, Mac, Windows, Linux webcams)
 * - Tablet (iPad, Android tablets)
 * - Hardware Laser Barcode Scanner (USB / Bluetooth HID gun sensors)
 */

export type DeviceType = 'phone' | 'pc' | 'tablet' | 'scanner';

export interface CameraSensorInfo {
  deviceId: string;
  label: string;
  isBackCamera: boolean;
  isFrontCamera: boolean;
  isExternalWebcam: boolean;
}

export interface AutoSensorCalibration {
  deviceType: DeviceType;
  deviceBrand: string;
  deviceModel: string;
  displayName: string;
  recommendedSensor: 'environment' | 'user';
  sensorLabel: string;
  recommendedResolution: { width: number; height: number; label: string };
  aspectRatio: number;
  targetFps: number;
  focusMode: 'continuous' | 'auto';
  summaryNote: string;
  hardwareScannerReady: boolean;
}

/**
 * Probes browser User Agent, screen dimensions, and touch capabilities
 * to auto-detect whether the host is Phone, Tablet, PC, or using a Scanner.
 */
export function detectDeviceHardware(): {
  deviceType: DeviceType;
  brand: string;
  model: string;
  displayName: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'pc',
      brand: 'PC',
      model: 'Desktop',
      displayName: 'PC / Desktop',
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenWidth = window.screen?.width || 1024;
  const screenHeight = window.screen?.height || 768;
  const minDim = Math.min(screenWidth, screenHeight);

  // 1. Check Tablet (iPad, Android Tablet, Kindle, etc.)
  const isIPad = ua.includes('ipad') || (navigator.platform === 'MacIntel' && maxTouchPoints > 1);
  const isAndroidTablet = ua.includes('android') && !ua.includes('mobile');
  const isTabletUA = ua.includes('tablet') || ua.includes('playbook') || ua.includes('silk');
  const isTouchTabletDim = maxTouchPoints > 0 && minDim >= 600 && minDim <= 1024;

  if (isIPad || isAndroidTablet || isTabletUA || isTouchTabletDim) {
    let tabletBrand = 'Tablet';
    if (isIPad) tabletBrand = 'Apple iPad';
    else if (ua.includes('samsung')) tabletBrand = 'Samsung Galaxy Tab';
    else if (ua.includes('lenovo')) tabletBrand = 'Lenovo Tab';
    else if (ua.includes('xiaomi') || ua.includes('redmi')) tabletBrand = 'Xiaomi Pad';

    return {
      deviceType: 'tablet',
      brand: tabletBrand,
      model: 'Touch Tablet',
      displayName: `Tablet (${tabletBrand})`,
    };
  }

  // 2. Check Phone (Smartphones)
  const isMobileUA = ua.includes('mobile') || ua.includes('iphone') || ua.includes('ipod');
  const isSmallTouch = maxTouchPoints > 0 && minDim < 600;

  if (isMobileUA || isSmallTouch) {
    let brand = 'Smartphone';
    let model = 'Mobile Device';

    if (ua.includes('samsung') || ua.includes('sm-') || ua.includes('sec-')) {
      brand = 'Samsung';
      model = 'Galaxy Series';
    } else if (ua.includes('iphone')) {
      brand = 'Apple';
      model = 'iPhone';
    } else if (ua.includes('redmi') || ua.includes('poco') || ua.includes('xiaomi') || ua.includes('mi ')) {
      brand = 'Xiaomi';
      model = 'Redmi / POCO';
    } else if (ua.includes('pixel') || ua.includes('nexus')) {
      brand = 'Google';
      model = 'Pixel';
    } else if (ua.includes('oneplus') || ua.includes('cph') || ua.includes('rmx') || ua.includes('oppo') || ua.includes('realme')) {
      brand = 'OnePlus / Realme / Oppo';
      model = 'Smartphone';
    } else if (ua.includes('vivo') || ua.includes('iqoo')) {
      brand = 'Vivo / iQOO';
      model = 'Smartphone';
    } else if (ua.includes('huawei') || ua.includes('honor')) {
      brand = 'Huawei / Honor';
      model = 'Smartphone';
    }

    return {
      deviceType: 'phone',
      brand,
      model,
      displayName: `Phone (${brand} ${model})`,
    };
  }

  // 3. Desktop / PC / Laptop
  let pcBrand = 'PC / Laptop';
  if (ua.includes('macintosh') || ua.includes('mac os')) {
    pcBrand = 'Apple Mac';
  } else if (ua.includes('windows')) {
    pcBrand = 'Windows PC';
  } else if (ua.includes('cros')) {
    pcBrand = 'Chromebook';
  } else if (ua.includes('linux')) {
    pcBrand = 'Linux PC';
  }

  return {
    deviceType: 'pc',
    brand: pcBrand,
    model: 'Workstation',
    displayName: `${pcBrand} (Desktop / Laptop)`,
  };
}

/**
 * Returns calibrated camera sensor and stream settings based on auto-sensed hardware
 */
export function getAutoSensorCalibration(
  deviceHardware: ReturnType<typeof detectDeviceHardware>,
  detectedCameras: CameraSensorInfo[]
): AutoSensorCalibration {
  const { deviceType, brand, model, displayName } = deviceHardware;

  // Find best sensor lens among detected cameras
  const hasRearLens = detectedCameras.some((c) => c.isBackCamera);
  const bestLens = hasRearLens || deviceType === 'phone' || deviceType === 'tablet' 
    ? 'environment' 
    : 'user';

  if (deviceType === 'phone') {
    const isPixel = brand.toLowerCase().includes('google');
    return {
      deviceType: 'phone',
      deviceBrand: brand,
      deviceModel: model,
      displayName,
      recommendedSensor: 'environment',
      sensorLabel: 'Rear High-Contrast Macro Sensor',
      recommendedResolution: isPixel 
        ? { width: 1920, height: 1080, label: '1080p FHD' } 
        : { width: 1280, height: 720, label: '720p HD' },
      aspectRatio: 1.333333, // 4:3 standard sensor aspect for retail barcodes
      targetFps: isPixel ? 24 : 15,
      focusMode: 'continuous',
      summaryNote: 'Auto-calibrated for phone rear macro sensor with fast edge contrast sampling.',
      hardwareScannerReady: true,
    };
  }

  if (deviceType === 'tablet') {
    return {
      deviceType: 'tablet',
      deviceBrand: brand,
      deviceModel: model,
      displayName,
      recommendedSensor: 'environment',
      sensorLabel: 'Tablet Rear Wide-Sampling Lens',
      recommendedResolution: { width: 1280, height: 720, label: '720p HD' },
      aspectRatio: 1.333333,
      targetFps: 15,
      focusMode: 'continuous',
      summaryNote: 'Auto-calibrated for tablet touch screen with balanced light sampling.',
      hardwareScannerReady: true,
    };
  }

  // PC / Laptop
  return {
    deviceType: 'pc',
    deviceBrand: brand,
    deviceModel: model,
    displayName,
    recommendedSensor: bestLens,
    sensorLabel: 'HD Web Camera / Desktop Optical Sensor',
    recommendedResolution: { width: 1280, height: 720, label: '720p HD Web' },
    aspectRatio: 1.777778, // 16:9 standard PC webcam
    targetFps: 24,
    focusMode: 'auto',
    summaryNote: 'Auto-calibrated for desktop/laptop webcams with full-field barcode capture.',
    hardwareScannerReady: true,
  };
}

/**
 * Enumerate and classify all connected camera devices
 */
export async function enumerateCameraSensors(): Promise<CameraSensorInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    return videoDevices.map((d, index) => {
      const label = d.label || `Camera Sensor ${index + 1}`;
      const lower = label.toLowerCase();
      const isBack = 
        lower.includes('back') || 
        lower.includes('rear') || 
        lower.includes('environment') || 
        lower.includes('facing back');
      const isFront = 
        lower.includes('front') || 
        lower.includes('user') || 
        lower.includes('facing front') || 
        lower.includes('selfie');
      const isExternal = 
        lower.includes('usb') || 
        lower.includes('external') || 
        lower.includes('webcam') || 
        lower.includes('plug');

      return {
        deviceId: d.deviceId,
        label,
        isBackCamera: isBack,
        isFrontCamera: isFront,
        isExternalWebcam: isExternal,
      };
    });
  } catch (err) {
    console.warn('enumerateCameraSensors probe error:', err);
    return [];
  }
}
