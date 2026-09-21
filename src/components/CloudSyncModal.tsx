import React, { useState } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Smartphone, 
  FileText, 
  Users, 
  RotateCcw, 
  ClipboardList,
  Store,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import { CloudStatusInfo, cloudSync } from '../services/cloudSync';

interface Props {
  status: CloudStatusInfo;
  isOpen: boolean;
  onClose: () => void;
  onForceRefresh?: () => void;
}

export function CloudSyncModal({ status, isOpen, onClose, onForceRefresh }: Props) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const isNetworkOnline = status.isNetworkOnline;
  const isConnected = status.state === 'connected';
  const isSyncing = status.state === 'syncing';
  const isOffline = status.state === 'offline';

  const handleManualReconnect = async () => {
    setIsReconnecting(true);
    setReconnectResult(null);
    try {
      const res = await cloudSync.reconnect();
      setReconnectResult(res);
      if (onForceRefresh) {
        onForceRefresh();
      }
    } catch (e: any) {
      setReconnectResult({ success: false, message: e?.message || 'Reconnect error' });
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isConnected ? 'bg-emerald-100 text-emerald-700' :
              isSyncing ? 'bg-amber-100 text-amber-700' :
              !isNetworkOnline ? 'bg-slate-100 text-slate-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {isConnected ? <CloudCheck className="w-5 h-5" /> :
               isSyncing ? <RefreshCw className="w-5 h-5 animate-spin" /> :
               <CloudOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Multi-Device Cloud Sync</h3>
              <p className="text-xs text-slate-500">Google Cloud Firestore • Real-time across phones & PCs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Connection Status Overview Dual Pill */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              isNetworkOnline 
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {isNetworkOnline ? (
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Device Internet:</span>
                <span className="text-xs font-bold font-mono">
                  {isNetworkOnline ? 'Active & Online' : 'No Connection'}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              isConnected 
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
                : isSyncing 
                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <Cloud className={`w-4 h-4 shrink-0 ${
                isConnected ? 'text-emerald-600' : isSyncing ? 'text-amber-600 animate-pulse' : 'text-slate-500'
              }`} />
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Cloud Database:</span>
                <span className="text-xs font-bold font-mono">
                  {isConnected ? 'Live Socket Connected' : isSyncing ? 'Synchronizing / Reconnecting' : 'Local Disk Cache'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Diagnostic Card */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            isConnected ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' :
            isSyncing ? 'bg-amber-50/80 border-amber-200 text-amber-950' :
            !isNetworkOnline ? 'bg-slate-100/90 border-slate-300 text-slate-900' :
            'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}>
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : isSyncing ? (
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm flex-1">
              <div className="font-bold flex items-center justify-between">
                <span>
                  {isConnected ? 'Real-Time Sync Connected & Live' :
                   isSyncing ? 'Synchronizing with Cloud Database...' :
                   isNetworkOnline ? 'Online (Re-establishing Cloud Channel)' :
                   'Offline Mode (Local Cache Active)'}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">
                {isConnected
                  ? 'All cashiers, mobile phones, and tablets share this live database. Any sale, stock change, or customer query syncs instantly.'
                  : isSyncing
                  ? 'Verifying changes with Google Cloud Firestore. Your catalog, bills, and customers will sync in real time.'
                  : isNetworkOnline
                  ? 'Your device internet is active. The cloud socket was refreshed or paused and is reconnecting. Your data is safely protected in local cache.'
                  : 'You are currently disconnected from the internet. Your changes are safely saved in this device’s local disk cache and will auto-sync when connection resumes.'}
              </p>

              {status.lastSyncedAt && (
                <div className="text-[11px] mt-2 font-mono opacity-80">
                  Last cloud sync: {status.lastSyncedAt.toLocaleTimeString()}
                </div>
              )}

              {/* Action button if online but needing quick reconnect */}
              {isNetworkOnline && !isConnected && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleManualReconnect}
                    disabled={isReconnecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isReconnecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    {isReconnecting ? 'Connecting to Cloud...' : 'Reconnect & Verify Cloud Sync'}
                  </button>
                </div>
              )}

              {reconnectResult && (
                <div className={`mt-2 text-[11px] font-medium p-2 rounded-lg border ${
                  reconnectResult.success 
                    ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900' 
                    : 'bg-amber-100/70 border-amber-300 text-amber-900'
                }`}>
                  {reconnectResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Collection Health & Counts */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Live Cloud Records
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span>Inventory Catalog</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {status.counts.inventory} items
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Sales Invoices</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {status.counts.invoices} bills
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Customer CRM</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {status.counts.customers}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span>Daily Queries</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {status.counts.dailyQueries}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  <span>RMA Returns</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {status.counts.returns}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>Shop Settings</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Synced
                </span>
              </div>
            </div>
          </div>

          {/* Efficiency & Multi-Device Sync Explanation */}
          <div className="p-3.5 bg-sky-50/80 border border-sky-100 rounded-xl text-xs text-sky-900 space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-sky-950">
              <Cloud className="w-4 h-4 text-sky-600" />
              <span>Offline-First Persistence with Real-Time Cloud Delta</span>
            </div>
            <p className="text-[11px] text-sky-800">
              All inventory edits, barcodes, and receipts are saved instantly to local browser disk storage so your shop never slows down even during internet drops. When online, changes mirror in real time to Google Cloud Firestore across all cashier phones and PCs.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleManualReconnect}
            disabled={isReconnecting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isReconnecting ? 'Reconnecting...' : 'Force Re-sync'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
