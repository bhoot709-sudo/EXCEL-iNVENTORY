import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  AlertTriangle, 
  ShoppingCart, 
  RotateCcw, 
  TrendingUp, 
  Package, 
  Smartphone,
  Users,
  Scan,
  Calendar,
  Clock,
  ClipboardList,
  GripVertical
} from 'lucide-react';
import { InventoryItem, ShopConfig } from '../types';
import { formatNPR, getTodayBS, formatNPTTime } from '../utils/nepalLocale';

type TabKey = 'daily' | 'excel' | 'inventory' | 'pos' | 'customers' | 'returns' | 'monthly';

const DEFAULT_TAB_KEYS: TabKey[] = [
  'daily',
  'excel',
  'inventory',
  'pos',
  'customers',
  'returns',
  'monthly'
];

interface Props {
  activeTab: 'daily' | 'excel' | 'inventory' | 'pos' | 'customers' | 'returns' | 'monthly';
  onTabChange: (tab: 'daily' | 'excel' | 'inventory' | 'pos' | 'customers' | 'returns' | 'monthly') => void;
  inventory: InventoryItem[];
  shopConfig: ShopConfig;
  customersCount?: number;
  dailyQueriesCount?: number;
  onExportExcel: () => void;
  onImportExcel: () => void;
  onOpenScanner?: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  inventory,
  shopConfig,
  customersCount,
  dailyQueriesCount,
  onExportExcel,
  onImportExcel,
  onOpenScanner,
}: Props) {
  const todayBS = getTodayBS();
  const lowStockCount = inventory.filter((i) => i.stockQuantity <= i.reorderLevel).length;
  const totalUnits = inventory.reduce((acc, i) => acc + i.stockQuantity, 0);
  const totalCost = inventory.reduce((acc, i) => acc + i.costPrice * i.stockQuantity, 0);
  const totalRetail = inventory.reduce((acc, i) => acc + i.sellingPrice * i.stockQuantity, 0);
  const avgMargin = totalRetail > 0 ? ((totalRetail - totalCost) / totalRetail) * 100 : 0;

  // Movable / reorderable tab navigation state with local storage persistence
  const [tabOrder, setTabOrder] = useState<TabKey[]>(() => {
    const saved = localStorage.getItem('gadget_nav_tab_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((k): k is TabKey => DEFAULT_TAB_KEYS.includes(k));
          const set = new Set(valid);
          const missing = DEFAULT_TAB_KEYS.filter((k) => !set.has(k));
          return [...valid, ...missing];
        }
      } catch {
        // fallback to default order
      }
    }
    return DEFAULT_TAB_KEYS;
  });

  const [draggedKey, setDraggedKey] = useState<TabKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<TabKey | null>(null);
  const isDragActiveRef = useRef(false);

  const handleDragStart = (e: React.DragEvent, key: TabKey) => {
    isDragActiveRef.current = false;
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleDragOver = (e: React.DragEvent, key: TabKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDrop = (e: React.DragEvent, targetKey: TabKey) => {
    e.preventDefault();
    if (!draggedKey || draggedKey === targetKey) {
      setDraggedKey(null);
      setDragOverKey(null);
      return;
    }
    isDragActiveRef.current = true;
    setTabOrder((prev) => {
      const fromIndex = prev.indexOf(draggedKey);
      const toIndex = prev.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      try {
        localStorage.setItem('gadget_nav_tab_order', JSON.stringify(next));
      } catch {}
      return next;
    });
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDragOverKey(null);
    setTimeout(() => {
      isDragActiveRef.current = false;
    }, 150);
  };

  const handleResetOrder = () => {
    setTabOrder(DEFAULT_TAB_KEYS);
    try {
      localStorage.removeItem('gadget_nav_tab_order');
    } catch {}
  };

  const isCustomOrder = tabOrder.some((k, i) => k !== DEFAULT_TAB_KEYS[i]);

  // Tab configurations with unified labels, subtitles, and badges
  const tabsConfig: Record<TabKey, {
    elementId: string;
    label: string;
    nepaliLabel: string;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: { text: string | number; className: string };
  }> = {
    daily: {
      elementId: 'tab-daily-records',
      label: 'Daily Register',
      nepaliLabel: 'दैनिक दर्ता',
      subtitle: 'दैनिक रेकर्ड',
      icon: ClipboardList,
      badge: dailyQueriesCount !== undefined && dailyQueriesCount > 0 ? {
        text: dailyQueriesCount,
        className: 'bg-emerald-500 text-white font-mono'
      } : undefined
    },
    excel: {
      elementId: 'tab-excel-grid',
      label: 'Excel Sheet Grid',
      nepaliLabel: 'एक्सेल सिट ग्रिड',
      subtitle: 'Formulas',
      icon: FileSpreadsheet
    },
    inventory: {
      elementId: 'tab-inventory',
      label: 'Inventory & Stocks',
      nepaliLabel: 'स्टक तथा सामान',
      icon: Smartphone,
      badge: lowStockCount > 0 ? {
        text: lowStockCount,
        className: 'bg-amber-500 text-white font-mono'
      } : undefined
    },
    pos: {
      elementId: 'tab-pos-billing',
      label: 'POS Billing & Cashier',
      nepaliLabel: 'पीओएस बिलिङ क्यासियर',
      icon: ShoppingCart
    },
    customers: {
      elementId: 'tab-customers',
      label: 'Customers & Loyalty',
      nepaliLabel: 'ग्राहक तथा लोयल्टी',
      icon: Users,
      badge: customersCount !== undefined && customersCount > 0 ? {
        text: customersCount,
        className: 'bg-emerald-800 text-white font-mono'
      } : undefined
    },
    returns: {
      elementId: 'tab-returns',
      label: 'Returns & RMA',
      nepaliLabel: 'सामान फिर्ता तथा वारेन्टी',
      icon: RotateCcw
    },
    monthly: {
      elementId: 'tab-monthly-report',
      label: 'Monthly Sales Report',
      nepaliLabel: 'मासिक बिक्री प्रतिवेदन',
      icon: TrendingUp
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Brand & Actions Bar */}
        <div className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-emerald-700/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {shopConfig.shopName}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                  Excel POS & Inventory
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Phones, Gadgets, Stock Alerts, Barcodes, Dynamic QR & Billing Invoices
              </p>
            </div>
          </div>

          {/* Quick KPIs & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Nepalese BS Date & Time Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>{todayBS.formattedBS} ({todayBS.dayOfWeekNepali})</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{formatNPTTime(new Date())}</span>
              </div>
            </div>

            {/* Low Stock Indicator Pill */}
            {lowStockCount > 0 ? (
              <button
                onClick={() => onTabChange('inventory')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-colors animate-pulse"
                title="Click to view low stock items"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{lowStockCount} Low Stock</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
                <span>Stock Healthy</span>
              </div>
            )}

            {/* Inventory Valuation Pill */}
            <div className="hidden lg:flex flex-col text-right px-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Stock Value (Wholesale)
              </span>
              <span className="text-xs font-bold font-mono text-slate-800">
                {formatNPR(totalCost)} ({avgMargin.toFixed(0)}% margin)
              </span>
            </div>

            {/* Import Excel */}
            <button
              onClick={onImportExcel}
              className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              title="Import .xlsx spreadsheet"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* Scan Barcode button */}
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                title="Scan barcode with camera, USB laser gun, or code lookup"
              >
                <Scan className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Scan Barcode</span>
                <span className="sm:hidden">Scan</span>
              </button>
            )}

            {/* Export Excel Workbook */}
            <button
              id="header-export-excel-btn"
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              title="Download full multi-sheet .xlsx workbook"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export .xlsx</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with Movable Tabs and Unified Hover Feedback Spans */}
        <nav 
          className="flex items-center gap-2 overflow-x-auto md:overflow-visible py-2.5 pb-3 scrollbar-thin select-none relative"
          aria-label="Main Navigation Tabs"
        >
          {tabOrder.map((key) => {
            const tab = tabsConfig[key];
            if (!tab) return null;
            const Icon = tab.icon;
            const isActive = activeTab === key;
            const isDragged = draggedKey === key;
            const isDragOver = dragOverKey === key && draggedKey !== key;

            return (
              <button
                key={key}
                id={tab.elementId}
                draggable
                onDragStart={(e) => handleDragStart(e, key)}
                onDragOver={(e) => handleDragOver(e, key)}
                onDrop={(e) => handleDrop(e, key)}
                onDragEnd={handleDragEnd}
                onClick={(e) => {
                  if (isDragActiveRef.current) {
                    e.preventDefault();
                    return;
                  }
                  onTabChange(key);
                }}
                title={`${tab.label} — ${tab.nepaliLabel} • Click to switch tab • Drag to rearrange`}
                className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-150 cursor-grab active:cursor-grabbing ${
                  isDragged
                    ? 'opacity-40 scale-95 ring-2 ring-dashed ring-emerald-500 bg-emerald-50/50'
                    : isDragOver
                    ? 'ring-2 ring-emerald-600 ring-offset-2 bg-emerald-100/80 scale-[1.03] shadow-md z-10'
                    : isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80 hover:shadow-xs border border-transparent hover:border-emerald-200/70 active:scale-[0.98]'
                }`}
              >
                {/* Grip Handle for Movable feedback */}
                <GripVertical
                  className={`w-3.5 h-3.5 -ml-1 transition-all duration-200 ${
                    isActive
                      ? 'opacity-40 text-white group-hover:opacity-80'
                      : 'opacity-20 text-slate-400 group-hover:opacity-75 group-hover:text-emerald-700'
                  }`}
                  aria-hidden="true"
                />

                {/* Tab Icon */}
                <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />

                {/* Tab Text - Only English at rest, zero Nepali translation shown when pointer is removed */}
                <span className="relative inline-flex items-center py-0.5 tracking-tight">
                  <span className="font-bold">{tab.label}</span>

                  {/* Unified animated hover underline accent for rich visual feedback */}
                  <span
                    className={`absolute -bottom-1 left-0 h-[2px] rounded-full transition-all duration-200 ${
                      isActive
                        ? 'w-full bg-white/80'
                        : 'w-0 group-hover:w-full bg-emerald-600'
                    }`}
                  />
                </span>

                {/* Floating Nepali Translation Tooltip - Strictly hidden when pointer removed, only visible while pointer hovers */}
                <div className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-50 px-2.5 py-1 bg-slate-900 text-emerald-300 text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80 flex items-center gap-1.5">
                  <span className="font-bold text-emerald-300">{tab.nepaliLabel}</span>
                  <span className="text-[10px] text-slate-400">({tab.label})</span>
                </div>

                {/* Badge if present */}
                {tab.badge && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-bold transition-transform duration-150 group-hover:scale-105 ${tab.badge.className}`}
                  >
                    {tab.badge.text}
                  </span>
                )}
              </button>
            );
          })}

          {/* Reset order button if customized */}
          {isCustomOrder && (
            <button
              onClick={handleResetOrder}
              className="group relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-emerald-800 hover:bg-emerald-50/60 rounded-xl transition-colors ml-1 whitespace-nowrap border border-transparent hover:border-emerald-200/50 cursor-pointer"
              title="नेभिगेसन क्रम पूर्वनिर्धारित बनाउनुहोस् (Reset Order)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Reset Order</span>
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-50 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap border border-slate-700/80">
                क्रम रिसेट गर्नुहोस्
              </div>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
