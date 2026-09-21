import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Flame, 
  TrendingUp, 
  Zap, 
  MapPin, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { playSpikeNotificationAudio } from '../utils/searchFrequencyTracker';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'spike';

export interface SpikeAlertPayload {
  keyword: string;
  location: string;
  surgePercent?: number;
  searchVolume?: 'VERY HIGH' | 'HIGH' | 'TRENDING' | 'STEADY' | string;
  category?: string;
  priceRange?: string;
  demandSummary?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  spikeData?: SpikeAlertPayload;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number, spikeData?: SpikeAlertPayload) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  spikeAlert: (spikeData: SpikeAlertPayload, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration = 4000, spikeData?: SpikeAlertPayload) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastMessage = { id, type, title, message, duration, spikeData };

      // Defer state update to next tick to ensure safety if called from within another component's render or reducer
      setTimeout(() => {
        setToasts((prev) => [...prev, newToast]);
      }, 0);

      // Trigger harmonic audio chime on spike alert
      if (type === 'spike') {
        playSpikeNotificationAudio();
      }

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string) => showToast(msg, 'success', title), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast(msg, 'error', title, 5000), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast(msg, 'warning', title, 4500), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast(msg, 'info', title), [showToast]);
  
  const spikeAlert = useCallback(
    (spikeData: SpikeAlertPayload, duration = 7000) => {
      const surgeStr = spikeData.surgePercent ? `+${spikeData.surgePercent}% Search Frequency Surge` : 'Search Volume Spike';
      const title = `🔥 Local Search Spike Alert`;
      const message = `High demand spike detected for "${spikeData.keyword}" in ${spikeData.location}. (${surgeStr})`;
      showToast(message, 'spike', title, duration, spikeData);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, spikeAlert }}>
      {children}
      {/* Toast Render Overlay */}
      <div 
        id="app-toast-container"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-3"
      >
        {toasts.map((toast) => {
          if (toast.type === 'spike' && toast.spikeData) {
            const data = toast.spikeData;
            return (
              <div
                key={toast.id}
                className="pointer-events-auto relative overflow-hidden rounded-2xl border border-amber-500/50 dark:border-amber-400/50 bg-gradient-to-br from-slate-900 via-amber-950/90 to-slate-900 text-white p-4 shadow-2xl shadow-amber-950/40 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 ring-1 ring-amber-400/30"
                role="alert"
              >
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-start gap-3">
                  {/* Surging Flame Icon with Pulse Ring */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-600/30">
                      <Flame className="w-5 h-5 text-amber-100 fill-amber-300 animate-pulse" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/30 text-rose-300 border border-rose-400/40 flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5 text-rose-300" />
                          <span>Search Frequency Spike</span>
                        </span>
                        {data.surgePercent && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            +{data.surgePercent}% Surge
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeToast(toast.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label="Dismiss toast"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Spiking Keyword Title */}
                    <div>
                      <h4 className="text-sm font-black text-amber-200 leading-snug break-words">
                        "{data.keyword}"
                      </h4>
                      <p className="text-[11px] text-slate-300 flex items-center gap-1 font-medium mt-0.5">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Surging in <strong>{data.location}</strong></span>
                        {data.category && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{data.category}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Price / Demand Summary */}
                    {data.demandSummary && (
                      <p className="text-[11px] text-slate-300/90 leading-tight line-clamp-2 bg-black/30 p-2 rounded-lg border border-white/5">
                        {data.demandSummary}
                      </p>
                    )}

                    {/* Action Bar */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {data.priceRange ? (
                        <span className="text-[11px] font-bold text-emerald-400">
                          Est: {data.priceRange}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Live Local Grounding
                        </span>
                      )}

                      {data.onAction && (
                        <button
                          type="button"
                          onClick={() => {
                            data.onAction?.();
                            removeToast(toast.id);
                          }}
                          className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-black rounded-lg text-[11px] flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          <span>{data.actionLabel || 'Explore Restock'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          let bgClasses = 'bg-white border-slate-200 text-slate-800';
          let icon = <Info className="w-5 h-5 text-blue-500 shrink-0" />;

          if (toast.type === 'success') {
            bgClasses = 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-900/10';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          } else if (toast.type === 'error') {
            bgClasses = 'bg-rose-50/95 border-rose-200 text-rose-950 shadow-rose-900/10';
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
          } else if (toast.type === 'warning') {
            bgClasses = 'bg-amber-50/95 border-amber-200 text-amber-950 shadow-amber-900/10';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          } else {
            bgClasses = 'bg-slate-900 text-white border-slate-800 shadow-slate-950/20';
            icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-xs transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${bgClasses}`}
              role="alert"
            >
              {icon}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-bold leading-none mb-1">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs leading-relaxed break-words font-medium">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg) => console.log(msg),
      success: (msg) => console.log('SUCCESS:', msg),
      error: (msg) => console.error('ERROR:', msg),
      warning: (msg) => console.warn('WARNING:', msg),
      info: (msg) => console.info('INFO:', msg),
      spikeAlert: (spike) => console.log('SPIKE ALERT:', spike),
    };
  }
  return context;
}

