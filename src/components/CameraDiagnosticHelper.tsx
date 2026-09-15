import React, { useState, useEffect } from 'react';
import {
  Camera,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldAlert,
  HelpCircle,
  Lock,
  Globe,
  Monitor
} from 'lucide-react';
import { detectPhoneProfile } from '../utils/phoneSpecsProfiles';

export interface CameraDiagnosticReport {
  isSecureContext: boolean;
  isIframe: boolean;
  hasMediaDevicesSupport: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported';
  camerasFound: number;
  isMobileDevice: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  activeError: string | null;
}

interface Props {
  activeError?: string | null;
  onRetryCamera?: () => void;
  onRequestPermission?: () => void;
  defaultExpanded?: boolean;
}

export function CameraDiagnosticHelper({
  activeError,
  onRetryCamera,
  onRequestPermission,
  defaultExpanded = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded || !!activeError);
  const [activeInstructionTab, setActiveInstructionTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [report, setReport] = useState<CameraDiagnosticReport>({
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
    isIframe: false,
    hasMediaDevicesSupport: false,
    permissionStatus: 'prompt',
    camerasFound: 0,
    isMobileDevice: false,
    isAndroid: false,
    isIOS: false,
    activeError: activeError || null,
  });

  const runDiagnostics = async () => {
    setIsProbing(true);
    try {
      const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
      const isAndroid = ua.includes('android');
      const isIOS = /iphone|ipad|ipod/.test(ua);
      const isMobile = isAndroid || isIOS || /mobi|tablet/.test(ua);

      // Default instruction tab to detected platform
      if (isAndroid) {
        setActiveInstructionTab('android');
      } else if (isIOS) {
        setActiveInstructionTab('ios');
      } else {
        setActiveInstructionTab('desktop');
      }

      const hasSupport = !!(
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      );

      let permStatus: 'granted' | 'denied' | 'prompt' | 'unsupported' = 'prompt';
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as any });
          permStatus = status.state as 'granted' | 'denied' | 'prompt';
        } catch {
          // Permissions API for camera not implemented on all mobile browsers
          permStatus = 'unsupported';
        }
      } else {
        permStatus = 'unsupported';
      }

      // If active error specifically mentions denied permission, override status
      if (
        activeError &&
        (activeError.toLowerCase().includes('denied') ||
          activeError.toLowerCase().includes('notallowederror'))
      ) {
        permStatus = 'denied';
      }

      let camCount = 0;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          camCount = devices.filter((d) => d.kind === 'videoinput').length;
        } catch {
          camCount = 0;
        }
      }

      setReport({
        isSecureContext: isSecure,
        isIframe: inIframe,
        hasMediaDevicesSupport: hasSupport,
        permissionStatus: permStatus,
        camerasFound: camCount,
        isMobileDevice: isMobile,
        isAndroid,
        isIOS,
        activeError: activeError || null,
      });
    } finally {
      setIsProbing(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [activeError]);

  // Expand automatically if an error occurs
  useEffect(() => {
    if (activeError) {
      setIsExpanded(true);
    }
  }, [activeError]);

  const hasPermissionIssue =
    report.permissionStatus === 'denied' ||
    (report.activeError && report.activeError.toLowerCase().includes('denied'));

  const hasNoCameraHardware =
    report.camerasFound === 0 &&
    report.permissionStatus !== 'denied' &&
    (report.activeError?.toLowerCase().includes('notfound') || report.activeError?.toLowerCase().includes('no camera'));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all shadow-2xs">
      {/* Header bar / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {hasPermissionIssue ? (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          ) : hasNoCameraHardware ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              Mobile Camera Diagnostics & Access Help
              {hasPermissionIssue && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-rose-100 text-rose-800">
                  Permission Denied
                </span>
              )}
              {report.isIframe && (
                <span className="px-1.5 py-0.2 text-[10px] font-medium rounded bg-amber-100 text-amber-800">
                  Preview Frame
                </span>
              )}
            </span>
            <p className="text-[11px] text-slate-500">
              {hasPermissionIssue
                ? 'Camera access is blocked by browser settings — tap for steps to unblock'
                : 'Check camera permissions, hardware availability, and mobile setup'}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 px-2 py-0.5 rounded bg-emerald-50">
          {isExpanded ? 'Hide Help' : 'Troubleshoot'}
        </span>
      </button>

      {/* Expanded Diagnostic & Instructions Body */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200 space-y-3">
          {/* Diagnostic Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Permission State */}
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-[10px] font-medium text-slate-400 block">Permission</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {report.permissionStatus === 'granted' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700 text-[11px]">Granted</span>
                  </>
                ) : report.permissionStatus === 'denied' ? (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="font-bold text-rose-700 text-[11px]">Blocked / Denied</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-bold text-amber-700 text-[11px]">Prompt Required</span>
                  </>
                )}
              </div>
            </div>

            {/* Hardware Cameras Found */}
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-[10px] font-medium text-slate-400 block">Camera Lens</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Camera className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="font-bold text-slate-800 text-[11px]">
                  {report.camerasFound > 0
                    ? `${report.camerasFound} Detected`
                    : report.permissionStatus === 'denied'
                    ? 'Blocked by Permission'
                    : 'None Detected'}
                </span>
              </div>
            </div>

            {/* Preview Frame Environment */}
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-[10px] font-medium text-slate-400 block">Window Mode</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {report.isIframe ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-bold text-amber-700 text-[11px]">In Preview iFrame</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700 text-[11px]">Standalone Tab</span>
                  </>
                )}
              </div>
            </div>

            {/* Security Context (HTTPS required by mobile browsers) */}
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
              <span className="text-[10px] font-medium text-slate-400 block">Security Context</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {report.isSecureContext ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700 text-[11px]">HTTPS Secure</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="font-bold text-rose-700 text-[11px]">Insecure (HTTP)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detected Phone Hardware Specs Profile Card */}
          {(() => {
            const profile = detectPhoneProfile();
            return (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900">Detected Phone Hardware: </span>
                    <span className="text-emerald-800 font-semibold">{profile.name}</span>
                    <span className="text-[11px] text-slate-500 block">
                      Recommended: {profile.recommendedResolution.height}p @ {profile.targetFps}fps • {profile.tuningNotes}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                  {profile.brand}
                </span>
              </div>
            );
          })()}

          {/* Special Warning if inside iFrame */}
          {report.isIframe && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Mobile iFrame Restriction:</strong> Mobile Chrome & Firefox block camera stream requests inside embedded preview frames. Opening the app in a standalone tab allows direct camera access.
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Standalone Tab
              </button>
            </div>
          )}

          {/* Step-by-step Instructions for Enabling Camera Access */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                How to Enable Camera in Mobile Settings:
              </span>

              {/* Platform Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveInstructionTab('android')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    activeInstructionTab === 'android'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-emerald-600" /> Android
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInstructionTab('ios')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    activeInstructionTab === 'ios'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-indigo-600" /> iPhone / iPad
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInstructionTab('desktop')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    activeInstructionTab === 'desktop'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Monitor className="w-3 h-3 text-slate-600" /> Desktop
                  </span>
                </button>
              </div>
            </div>

            {/* Android Instructions */}
            {activeInstructionTab === 'android' && (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Tap the Address Bar icon in Chrome</p>
                    <p className="text-[11px] text-slate-500">
                      Tap the <strong>Page Info icon</strong> (the lock 🔒 or sliders icon) located directly to the left of the website URL.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Allow Camera Permissions</p>
                    <p className="text-[11px] text-slate-500">
                      Select <strong>Permissions</strong> → <strong>Camera</strong> → Toggle to <strong>Allow</strong> (or tap <strong>Reset permissions</strong>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Verify Android OS App Permissions</p>
                    <p className="text-[11px] text-slate-500">
                      Go to your phone’s <strong>Settings → Apps → Chrome → Permissions → Camera</strong> and select <strong>"Allow only while using the app"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Ensure no other app is using the camera</p>
                    <p className="text-[11px] text-slate-500">
                      If the Android Camera app or a video calling app is running in the background, close it from your Recent Apps switcher.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Safari Instructions */}
            {activeInstructionTab === 'ios' && (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Tap the 'aA' Page Settings Icon</p>
                    <p className="text-[11px] text-slate-500">
                      In the Safari bottom or top address bar, tap the <strong>aA</strong> icon on the left.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Website Settings → Camera</p>
                    <p className="text-[11px] text-slate-500">
                      Tap <strong>Website Settings</strong>, find <strong>Camera</strong>, and change it from <em>Deny</em> or <em>Ask</em> to <strong>Allow</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Check iOS Global Settings</p>
                    <p className="text-[11px] text-slate-500">
                      Open iOS <strong>Settings → Safari → Camera</strong> and ensure it is set to <strong>Ask</strong> or <strong>Allow</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Chrome Instructions */}
            {activeInstructionTab === 'desktop' && (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Click the Site Settings Icon</p>
                    <p className="text-[11px] text-slate-500">
                      Click the <strong>Tune / Settings</strong> icon (or Padlock) to the left of the URL in the browser address bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Toggle Camera Permission</p>
                    <p className="text-[11px] text-slate-500">
                      Ensure <strong>Camera</strong> is switched to <strong>On / Allow</strong>, then refresh the page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runDiagnostics}
                disabled={isProbing}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                Re-check Diagnostics
              </button>

              {onRetryCamera && (
                <button
                  type="button"
                  onClick={onRetryCamera}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Retry Starting Camera
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3 text-slate-500" />
              Open in Standalone Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
