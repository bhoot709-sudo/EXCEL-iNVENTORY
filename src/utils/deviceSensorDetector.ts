/**
 * Auto Sensor Camera & Hardware Detector
 * Accurately detects and limits device classification to:
 * - PC / Laptop (Desktop, Mac, Windows, Linux webcams)
 * - Phone / Mobile (Smartphones)
 * - Tablet (iPad, Android tablets)
 */

export type DeviceType = 'pc' | 'phone' | 'tablet';

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
 * Cleanly probes browser User Agent, screen dimensions, and touch capabilities
 * to classify the device into one of 3 clear types: PC, Phone, or Tablet.
 */
export function detectDeviceHardware(manualOverride?: DeviceType): {
  deviceType: DeviceType;
  brand: string;
  model: string;
  displayName: string;
} {
  if (manualOverride) {
    if (manualOverride === 'phone') {
      return {
        deviceType: 'phone',
        brand: 'Phone',
        model: 'Mobile',
        displayName: 'Phone / Mobile',
      };
    }
    if (manualOverride === 'tablet') {
      return {
        deviceType: 'tablet',
        brand: 'Tablet',
        model: 'Touch Tablet',
        displayName: 'Tablet',
      };
    }
    return {
      deviceType: 'pc',
      brand: 'PC',
      model: 'Desktop / Laptop',
      displayName: 'PC / Laptop',
    };
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'pc',
      brand: 'PC',
      model: 'Desktop / Laptop',
      displayName: 'PC / Laptop',
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenWidth = window.screen?.width || (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const screenHeight = window.screen?.height || (typeof window !== 'undefined' ? window.innerHeight : 768);
  const minDim = Math.min(screenWidth, screenHeight);

  // 1. Tablet Detection (iPad, Android Tablet, etc.)
  const isIPad = ua.includes('ipad') || (navigator.platform === 'MacIntel' && maxTouchPoints > 1);
  const isAndroidTablet = ua.includes('android') && !ua.includes('mobile');
  const isTabletUA = ua.includes('tablet') || ua.includes('playbook') || ua.includes('silk');
  const isTouchTabletDim = maxTouchPoints > 0 && minDim >= 600 && minDim <= 1024;

  if (isIPad || isAndroidTablet || isTabletUA || isTouchTabletDim) {
    return {
      deviceType: 'tablet',
      brand: 'Tablet',
      model: isIPad ? 'iPad' : 'Android Tablet',
      displayName: 'Tablet',
    };
  }

  // 2. Phone / Mobile Detection (Smartphones)
  const isMobileUA = ua.includes('mobile') || ua.includes('iphone') || ua.includes('ipod');
  const isSmallTouch = maxTouchPoints > 0 && minDim < 600;

  if (isMobileUA || isSmallTouch) {
    return {
      deviceType: 'phone',
      brand: 'Phone',
      model: ua.includes('iphone') ? 'iPhone' : 'Mobile Smartphone',
      displayName: 'Phone / Mobile',
    };
  }

  // 3. PC / Laptop / Desktop (Default)
  let osLabel = 'Desktop / Laptop';
  if (ua.includes('macintosh') || ua.includes('mac os')) {
    osLabel = 'Mac Computer';
  } else if (ua.includes('windows')) {
    osLabel = 'Windows PC';
  } else if (ua.includes('linux')) {
    osLabel = 'Linux PC';
  }

  return {
    deviceType: 'pc',
    brand: 'PC',
    model: osLabel,
    displayName: 'PC / Laptop',
  };
}

/**
 * Returns calibrated camera sensor and stream settings based on limited device hardware
 */
export function getAutoSensorCalibration(
  deviceHardware: ReturnType<typeof detectDeviceHardware>,
  detectedCameras: CameraSensorInfo[]
): AutoSensorCalibration {
  const { deviceType, brand, model, displayName } = deviceHardware;

  // On PC / Desktop, prioritize webcam (user facing / default webcam)
  if (deviceType === 'pc') {
    return {
      deviceType: 'pc',
      deviceBrand: brand,
      deviceModel: model,
      displayName,
      recommendedSensor: 'user',
      sensorLabel: 'PC Webcam / USB Camera',
      recommendedResolution: { width: 1280, height: 720, label: '720p HD' },
      aspectRatio: 1.777778, // 16:9 standard PC webcam
      targetFps: 24,
      focusMode: 'auto',
      summaryNote: 'Directly opens PC built-in or USB webcam stream.',
      hardwareScannerReady: true,
    };
  }

  if (deviceType === 'tablet') {
    const hasRearLens = detectedCameras.some((c) => c.isBackCamera);
    return {
      deviceType: 'tablet',
      deviceBrand: brand,
      deviceModel: model,
      displayName,
      recommendedSensor: hasRearLens ? 'environment' : 'environment',
      sensorLabel: 'Tablet Camera',
      recommendedResolution: { width: 1280, height: 720, label: '720p HD' },
      aspectRatio: 1.333333,
      targetFps: 20,
      focusMode: 'continuous',
      summaryNote: 'Calibrated for tablet optical sensors.',
      hardwareScannerReady: true,
    };
  }

  // Phone / Mobile
  return {
    deviceType: 'phone',
    deviceBrand: brand,
    deviceModel: model,
    displayName,
    recommendedSensor: 'environment',
    sensorLabel: 'Phone Rear Camera',
    recommendedResolution: { width: 1280, height: 720, label: '720p HD' },
    aspectRatio: 1.333333, // 4:3
    targetFps: 20,
    focusMode: 'continuous',
    summaryNote: 'Calibrated for phone rear macro camera sensor.',
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
