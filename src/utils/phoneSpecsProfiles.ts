export interface PhoneCameraSpecs {
  id: string;
  name: string;
  brand: string;
  modelSeries: string;
  recommendedResolution: { width: number; height: number };
  aspectRatio: number;
  targetFps: number;
  facingMode: 'environment' | 'user';
  focusMode?: 'continuous' | 'auto' | 'macro';
  description: string;
  tuningNotes: string;
}

export interface CustomPhoneCameraSpecs {
  enabled: boolean;
  resolution: '1080p' | '720p' | '480p' | '360p' | 'auto';
  aspectRatio: '4:3' | '16:9' | '1:1';
  fps: 10 | 15 | 24 | 30;
  facingMode: 'environment' | 'user';
}

export const PHONE_SPECS_PROFILES: PhoneCameraSpecs[] = [
  {
    id: 'samsung-galaxy',
    name: 'Samsung Galaxy (S, A, M, Note, Z)',
    brand: 'Samsung',
    modelSeries: 'Galaxy S21/S22/S23/S24, A-Series (A14/A34/A54), M/F/Note/Z Fold & Flip',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'Optimized for Samsung One UI Camera Abstraction Layer with continuous macro autofocus and balanced 720p HD frame rate.',
    tuningNotes: 'Enforces ideal environment rear sensor to bypass Samsung wide-angle camera misrouting.',
  },
  {
    id: 'xiaomi-redmi-poco',
    name: 'Xiaomi / Redmi / POCO',
    brand: 'Xiaomi',
    modelSeries: 'Redmi Note 11/12/13, POCO X/F/M Series, Xiaomi 12/13/14 (MIUI & HyperOS)',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'Configured for Xiaomi MIUI & HyperOS video pipeline with standard 4:3 reticle sampling.',
    tuningNotes: 'Prevents MIUI aggressive memory management from terminating barcode worker threads.',
  },
  {
    id: 'google-pixel',
    name: 'Google Pixel (6, 7, 8, 9, a-Series)',
    brand: 'Google',
    modelSeries: 'Pixel 6/7/8/9 and Pixel 6a/7a/8a',
    recommendedResolution: { width: 1920, height: 1080 },
    aspectRatio: 1.777778,
    targetFps: 24,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'High-definition 1080p Full HD mode tailored for Google Camera2 API with fast 24fps barcode detection.',
    tuningNotes: 'Utilizes Pixel primary sensor for ultra-sharp 1D barcode edge contrast.',
  },
  {
    id: 'oneplus-oppo-realme',
    name: 'OnePlus / Realme / Oppo',
    brand: 'OnePlus / Oppo',
    modelSeries: 'OnePlus Nord/10/11/12, Realme C/GT/Number series, Oppo Reno (ColorOS/OxygenOS)',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'Calibrated for ColorOS & OxygenOS camera driver constraints with low-latency frame buffer.',
    tuningNotes: 'Locks rear primary lens and avoids ultra-wide lens blur on small retail stickers.',
  },
  {
    id: 'vivo-iqoo',
    name: 'Vivo / iQOO',
    brand: 'Vivo',
    modelSeries: 'Vivo V/Y/T/X Series, iQOO Neo/Z (Funtouch OS / OriginOS)',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'Optimized for Funtouch OS with stable exposure and standard barcode scanning frame sizing.',
    tuningNotes: 'Ensures consistent light meter sampling on glossy phone boxes and screen protectors.',
  },
  {
    id: 'apple-iphone',
    name: 'Apple iPhone / iPad',
    brand: 'Apple',
    modelSeries: 'iPhone 11/12/13/14/15/16 Pro/Max/Plus & iPad',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'iOS WebKit Safari video tag constraints with inline video playback and auto-orientation.',
    tuningNotes: 'Uses playsinline and user-activation event chaining for iOS WebKit compliance.',
  },
  {
    id: 'budget-lightweight',
    name: 'Budget / Older Android Phone',
    brand: 'Budget Android',
    modelSeries: 'Entry-level phones with Android Go, Android 9-11, or low RAM (< 3GB)',
    recommendedResolution: { width: 640, height: 480 },
    aspectRatio: 1.333333,
    targetFps: 10,
    facingMode: 'environment',
    focusMode: 'auto',
    description: 'Low-CPU lightweight 480p mode with reduced 10 FPS scanning to prevent browser freezing on budget phones.',
    tuningNotes: 'Reduces canvas image buffer size by 65% for instant responsiveness on entry-level hardware.',
  },
  {
    id: 'universal-auto',
    name: 'Universal Mobile Auto-Detect',
    brand: 'Universal',
    modelSeries: 'All other Android, HarmonyOS, KaiOS, and mobile devices',
    recommendedResolution: { width: 1280, height: 720 },
    aspectRatio: 1.333333,
    targetFps: 15,
    facingMode: 'environment',
    focusMode: 'continuous',
    description: 'Adaptive multi-tier fallback that detects phone capabilities dynamically and adjusts constraints.',
    tuningNotes: 'Automatically degrades from 1080p -> 720p -> 480p -> basic video stream if hardware rejects constraints.',
  },
];

/**
 * Detects the most likely phone profile based on the browser User Agent string.
 */
export function detectPhoneProfile(): PhoneCameraSpecs {
  if (typeof navigator === 'undefined') {
    return PHONE_SPECS_PROFILES[0];
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const vendor = (navigator.vendor || '').toLowerCase();

  if (ua.includes('samsung') || ua.includes('sm-') || ua.includes('sec-')) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'samsung-galaxy') || PHONE_SPECS_PROFILES[0];
  }

  if (
    ua.includes('redmi') ||
    ua.includes('poco') ||
    ua.includes('xiaomi') ||
    ua.includes('mi ') ||
    ua.includes('m20') ||
    ua.includes('m21') ||
    ua.includes('2201') ||
    ua.includes('2301')
  ) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'xiaomi-redmi-poco') || PHONE_SPECS_PROFILES[1];
  }

  if (ua.includes('pixel') || ua.includes('nexus')) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'google-pixel') || PHONE_SPECS_PROFILES[2];
  }

  if (
    ua.includes('oneplus') ||
    ua.includes('cph') ||
    ua.includes('rmx') ||
    ua.includes('oppo') ||
    ua.includes('realme')
  ) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'oneplus-oppo-realme') || PHONE_SPECS_PROFILES[3];
  }

  if (ua.includes('vivo') || ua.includes('v20') || ua.includes('v21') || ua.includes('v22') || ua.includes('iqoo')) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'vivo-iqoo') || PHONE_SPECS_PROFILES[4];
  }

  if (ua.includes('iphone') || ua.includes('ipad') || (vendor.includes('apple') && ua.includes('safari'))) {
    return PHONE_SPECS_PROFILES.find((p) => p.id === 'apple-iphone') || PHONE_SPECS_PROFILES[5];
  }

  return PHONE_SPECS_PROFILES.find((p) => p.id === 'universal-auto') || PHONE_SPECS_PROFILES[7];
}
