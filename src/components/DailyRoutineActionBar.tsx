import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  PackagePlus, 
  Tag, 
  Wallet, 
  Clock, 
  Plus, 
  Boxes, 
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Zap,
  History,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  Download,
  X,
  FileText
} from 'lucide-react';
import { ActionLog, ActionCategory } from '../types';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  onOpenNewSale: () => void;
  onOpenRestock: () => void;
  onOpenAddProductCategory: () => void;
  onOpenCustomerDues: () => void;
  onOpenOrderStatusUpdater: () => void;
  onOpenLabelReminders?: () => void;
  onOpenGoogleCalendar?: () => void;
  totalItemsInStock?: number;
  totalItemsRestockedCount?: number;
  pendingLabelRemindersCount?: number;
  lowStockCount?: number;
  customerDuesCount?: number;
  totalDuesAmount?: number;
  pendingOrdersCount?: number;
  categoriesCount?: number;
  actionLogs?: ActionLog[];
  onLogAction?: (entry: {
    category: ActionCategory;
    actionTitle: string;
    description: string;
    staffName?: string;
    source: ActionLog['source'];
    status?: 'SUCCESS' | 'PENDING' | 'CANCELLED';
    metadata?: Record<string, any>;
  }) => void;
  onClearLogs?: () => void;
  onDeleteLog?: (logId: string) => void;
}

export function DailyRoutineActionBar({
  onOpenNewSale,
  onOpenRestock,
  onOpenAddProductCategory,
  onOpenCustomerDues,
  onOpenOrderStatusUpdater,
  onOpenLabelReminders,
  onOpenGoogleCalendar,
  totalItemsInStock,
  totalItemsRestockedCount = 0,
  pendingLabelRemindersCount = 0,
  lowStockCount = 0,
  customerDuesCount = 0,
  totalDuesAmount = 0,
  pendingOrdersCount = 0,
  categoriesCount = 7,
  actionLogs = [],
  onLogAction,
  onClearLogs,
  onDeleteLog,
}: Props) {
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCategory, setManualCategory] = useState<ActionCategory>('GENERAL_ACTION');
  const [manualStaff, setManualStaff] = useState('Counter Staff');

  // Trigger handlers with automatic logging
  const handleActionClick = (
    type: 'sale' | 'restock' | 'product' | 'dues' | 'order',
    callback: () => void
  ) => {
    if (onLogAction) {
      if (type === 'sale') {
        onLogAction({
          category: 'ROUTINE_LAUNCH',
          actionTitle: 'Launched New Sale (POS Terminal)',
          description: 'Opened POS terminal cashier for retail bill checkout & QR payments.',
          source: 'DAILY_ROUTINE_BAR',
          metadata: { actionType: 'New Sale POS' },
        });
      } else if (type === 'restock') {
        onLogAction({
          category: 'ROUTINE_LAUNCH',
          actionTitle: 'Opened Quick Restock Console',
          description: `Accessed restock console (${lowStockCount} items currently at low stock).`,
          source: 'DAILY_ROUTINE_BAR',
          metadata: { lowStockCount },
        });
      } else if (type === 'product') {
        onLogAction({
          category: 'ROUTINE_LAUNCH',
          actionTitle: 'Opened Product & Category Creator',
          description: `Accessed product SKU/barcode creation tool (${categoriesCount} existing categories).`,
          source: 'DAILY_ROUTINE_BAR',
          metadata: { categoriesCount },
        });
      } else if (type === 'dues') {
        onLogAction({
          category: 'ROUTINE_LAUNCH',
          actionTitle: 'Opened Customer Dues Ledger (उधारो)',
          description: `Opened credit ledger (${customerDuesCount} pending accounts, total ${formatNPR(totalDuesAmount)}).`,
          source: 'DAILY_ROUTINE_BAR',
          metadata: { customerDuesCount, totalDuesAmount },
        });
      } else if (type === 'order') {
        onLogAction({
          category: 'ROUTINE_LAUNCH',
          actionTitle: 'Opened Order Status & Customer Inquiries',
          description: `Opened inquiry status updater (${pendingOrdersCount} pending pre-orders/quotes).`,
          source: 'DAILY_ROUTINE_BAR',
          metadata: { pendingOrdersCount },
        });
      }
    }
    callback();
  };

  // Filtered Action Logs
  const filteredLogs = useMemo(() => {
    return actionLogs.filter((log) => {
      const matchCat = categoryFilter === 'ALL' || log.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        log.actionTitle.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        (log.staffName && log.staffName.toLowerCase().includes(q)) ||
        (log.metadata?.customerName && String(log.metadata.customerName).toLowerCase().includes(q)) ||
        (log.metadata?.itemName && String(log.metadata.itemName).toLowerCase().includes(q)) ||
        (log.metadata?.invoiceNumber && String(log.metadata.invoiceNumber).toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [actionLogs, categoryFilter, searchQuery]);

  // Handle Export Logs to CSV file for future reference
  const handleExportLogs = () => {
    if (actionLogs.length === 0) return;

    const headers = ['ID', 'Date', 'Time', 'BS Date', 'Category', 'Action Title', 'Description', 'Staff', 'Source', 'Status', 'Details'];
    const rows = actionLogs.map((log) => [
      `"${log.id}"`,
      `"${log.date}"`,
      `"${log.time}"`,
      `"${log.bsDate || ''}"`,
      `"${log.category}"`,
      `"${log.actionTitle.replace(/"/g, '""')}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.staffName || ''}"`,
      `"${log.source}"`,
      `"${log.status}"`,
      `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Action_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit manual log note
  const handleAddManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    if (onLogAction) {
      onLogAction({
        category: manualCategory,
        actionTitle: manualTitle.trim(),
        description: manualDesc.trim() || 'Manual counter action note recorded.',
        staffName: manualStaff.trim() || 'Counter Staff',
        source: 'MANUAL',
        status: 'SUCCESS',
      });
    }

    setManualTitle('');
    setManualDesc('');
    setShowManualLogModal(false);
  };

  const getCategoryBadgeClass = (category: ActionCategory) => {
    switch (category) {
      case 'SALE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'RESTOCK':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PRODUCT':
      case 'CATEGORY':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'DUE_SETTLEMENT':
      case 'CREDIT_ENTRY':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ORDER_UPDATE':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ROUTINE_LAUNCH':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-200';
    }
  };

  return (
    <div id="daily-routine-action-bar" className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4 transition-colors">
      {/* Top Banner Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-2xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-2">
              <span>Daily Routine Quick Tasks</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide uppercase">
                One-Click Actions
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Action Logging Active
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Essential day-to-day retail operations: instant sales, restocks, new products, credit ledger & orders.
            </p>
          </div>
        </div>

        {/* Right Header Controls: Action Logs Toggle & Export */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {onOpenLabelReminders && (
            <button
              type="button"
              onClick={onOpenLabelReminders}
              title="Barcode & Selling Price Label Printing Queue (स्टिकर रिमाइन्डर)"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                pendingLabelRemindersCount > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 animate-pulse'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-slate-950" />
              <span>Stickering Queue</span>
              {pendingLabelRemindersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-slate-950 text-amber-300 font-mono text-[10px] font-black">
                  {pendingLabelRemindersCount}
                </span>
              )}
            </button>
          )}

          {onOpenGoogleCalendar && (
            <button
              type="button"
              onClick={onOpenGoogleCalendar}
              title="Open Google Calendar Schedules & Restock Reminders (गुगल क्यालेन्डर)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Calendar</span>
            </button>
          )}

          {actionLogs.length > 0 && (
            <button
              type="button"
              onClick={handleExportLogs}
              title="Download action history report (CSV)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Export Log</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowManualLogModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Log Note</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
              showLogs 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Action Logs</span>
            <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-900 font-mono text-[10px] font-black">
              {actionLogs.length}
            </span>
            {showLogs ? (
              <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 transition-transform" />
            )}
          </button>
        </div>
      </div>

      {/* 5 Routine Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. New Sale (POS) */}
        <button
          type="button"
          onClick={() => handleActionClick('sale', onOpenNewSale)}
          className="group text-left p-3.5 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono">
              POS Terminal
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors flex items-center justify-between">
              <span>New Sale</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Start fresh retail bill & QR payment
            </p>
          </div>
        </button>

        {/* 2. Restocks */}
        <button
          type="button"
          onClick={() => handleActionClick('restock', onOpenRestock)}
          className="group text-left p-3.5 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-blue-50/40 to-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1">
              {totalItemsInStock !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100/90 text-blue-900 font-mono">
                  {totalItemsInStock} in stock
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                lowStockCount > 0 
                  ? 'bg-amber-100 text-amber-800 animate-pulse' 
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {lowStockCount > 0 ? `${lowStockCount} Low` : 'Optimal'}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors flex items-center justify-between">
              <span>Restock Items</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              {totalItemsRestockedCount > 0
                ? `+${totalItemsRestockedCount} restocked today • Click to add stock`
                : 'Replenish depleted inventory'}
            </p>
          </div>
        </button>

        {/* 3. Add Product & Categories */}
        <button
          type="button"
          onClick={() => handleActionClick('product', onOpenAddProductCategory)}
          className="group text-left p-3.5 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-violet-50/40 to-white hover:border-violet-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-violet-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Tag className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-violet-800 bg-violet-100/80 px-2 py-0.5 rounded-md">
              {categoriesCount} Categories
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-violet-700 transition-colors flex items-center justify-between">
              <span>+ Product & Category</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Create SKU, barcode & category
            </p>
          </div>
        </button>

        {/* 4. Due Amounts on Customers (उधारो) */}
        <button
          type="button"
          onClick={() => handleActionClick('dues', onOpenCustomerDues)}
          className="group text-left p-3.5 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-amber-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md font-mono">
              {customerDuesCount} Pending
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors flex items-center justify-between">
              <span>Customer Dues (उधारो)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 font-mono">
              {totalDuesAmount > 0 ? `${formatNPR(totalDuesAmount)} due` : 'Zero outstanding dues'}
            </p>
          </div>
        </button>

        {/* 5. Order Status Updater */}
        <button
          type="button"
          onClick={() => handleActionClick('order', onOpenOrderStatusUpdater)}
          className="group text-left p-3.5 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-indigo-50/40 to-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              pendingOrdersCount > 0
                ? 'bg-rose-100 text-rose-800 animate-pulse'
                : 'bg-indigo-100 text-indigo-800'
            }`}>
              {pendingOrdersCount} Inquiries
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors flex items-center justify-between">
              <span>Order Status Updater</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Update pre-orders, repairs & quotes
            </p>
          </div>
        </button>
      </div>

      {/* Expandable Action Logs & Reference History Section */}
      {showLogs && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3.5">
          {/* Action Log Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-700">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Action History & Audit Trail</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Saved in Cloud & Browser
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Every action performed from routine tasks & cashier operations is safely recorded.
                </p>
              </div>
            </div>

            {/* Clear All Logs */}
            {actionLogs.length > 0 && onClearLogs && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all action history logs?')) {
                    onClearLogs();
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors self-start sm:self-auto"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All Logs</span>
              </button>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action logs by name, item, customer, invoice or staff..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ROUTINE_LAUNCH', label: 'Launches' },
                { id: 'SALE', label: 'Sales' },
                { id: 'RESTOCK', label: 'Restocks' },
                { id: 'PRODUCT', label: 'Products' },
                { id: 'DUE_SETTLEMENT', label: 'Dues' },
                { id: 'ORDER_UPDATE', label: 'Orders' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCategoryFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                    categoryFilter === pill.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Log Entries List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Action Logs Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchQuery || categoryFilter !== 'ALL'
                    ? 'No records match your active search or filter.'
                    : 'Click any routine action button above or complete a sale to record your first action!'}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="group p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 mt-0.5 ${getCategoryBadgeClass(
                        log.category
                      )}`}
                    >
                      {log.category.replace('_', ' ')}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 leading-snug">
                          {log.actionTitle}
                        </span>
                        {log.metadata?.amount && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            {formatNPR(log.metadata.amount)}
                          </span>
                        )}
                        {log.metadata?.quantity && (
                          <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            +{log.metadata.quantity} units
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                        {log.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1 font-mono font-medium text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {log.time} • {log.date}
                        </span>
                        {log.bsDate && (
                          <span className="text-red-700/80 font-medium">
                            {log.bsDate}
                          </span>
                        )}
                        {log.staffName && (
                          <span className="text-slate-500">
                            By: <strong className="text-slate-700">{log.staffName}</strong>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Saved
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delete individual log item */}
                  {onDeleteLog && (
                    <button
                      type="button"
                      onClick={() => onDeleteLog(log.id)}
                      title="Remove record"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-md transition-opacity self-end sm:self-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Manual Quick Log Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Manual Action Log</h3>
                  <p className="text-xs text-slate-500">Log an offline event or staff note for future reference.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualLogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualLog} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Received new shipment, Cash drawer recount..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as ActionCategory)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="GENERAL_ACTION">General Action</option>
                    <option value="RESTOCK">Restock / Inventory</option>
                    <option value="SALE">Cashier / Sale</option>
                    <option value="DUE_SETTLEMENT">Credit / Dues</option>
                    <option value="ORDER_UPDATE">Order / Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Staff Member</label>
                  <input
                    type="text"
                    value={manualStaff}
                    onChange={(e) => setManualStaff(e.target.value)}
                    placeholder="Staff name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description & Details</label>
                <textarea
                  rows={3}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Provide reference details or notes..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualLogModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
