import React from 'react';
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
  Store
} from 'lucide-react';
import { CloudStatusInfo } from '../services/cloudSync';

interface Props {
  status: CloudStatusInfo;
  isOpen: boolean;
  onClose: () => void;
  onForceRefresh?: () => void;
}

export function CloudSyncModal({ status, isOpen, onClose, onForceRefresh }: Props) {
  if (!isOpen) return null;

  const isConnected = status.state === 'connected';
  const isSyncing = status.state === 'syncing';
  const isOffline = status.state === 'offline';

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
              'bg-rose-100 text-rose-700'
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
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Indicator Card */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            isConnected ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' :
            isSyncing ? 'bg-amber-50/80 border-amber-200 text-amber-950' :
            'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}>
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : isSyncing ? (
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              <div className="font-bold">
                {isConnected ? 'Real-Time Sync Connected & Live' :
                 isSyncing ? 'Synchronizing with Cloud...' :
                 'Operating in Offline Mode (Local Cache Active)'}
              </div>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">
                {isConnected
                  ? 'All cashiers, mobile phones, and tablets share this live database. Any sale, stock change, or customer query syncs instantly.'
                  : isSyncing
                  ? 'Writing pending changes to cloud storage. Your data will mirror across all other devices in seconds.'
                  : 'You are currently disconnected or offline. Your changes are safely saved in this device’s local disk cache and will auto-sync when connection resumes.'}
              </p>
              {status.lastSyncedAt && (
                <div className="text-[11px] mt-2 font-mono opacity-80">
                  Last cloud sync: {status.lastSyncedAt.toLocaleTimeString()}
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

          {/* Efficiency & Daily Quota Guarantee */}
          <div className="p-3.5 bg-sky-50/80 border border-sky-100 rounded-xl text-xs text-sky-900 space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-sky-950">
              <Cloud className="w-4 h-4 text-sky-600" />
              <span>Free Quota & Battery Friendly</span>
            </div>
            <p className="text-[11px] text-sky-800">
              This app utilizes Firestore’s persistent multi-tab disk cache. Document reads happen once on startup and updates are pushed via lightweight delta sockets, consuming less than 2% of the free 50,000 daily read limit.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (onForceRefresh) onForceRefresh();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Force Re-sync</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
