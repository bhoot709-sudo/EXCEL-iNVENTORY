import React, { useState, useRef, useEffect } from 'react';
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
  CloudCheck,
  CloudOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { InventoryItem, ShopConfig } from '../types';
import { formatNPR, getTodayBS, formatNPTTime } from '../utils/nepalLocale';
import { CloudStatusInfo } from '../services/cloudSync';

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
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  inventory: InventoryItem[];
  shopConfig: ShopConfig;
  customersCount?: number;
  dailyQueriesCount?: number;
  cloudStatus?: CloudStatusInfo;
  onOpenCloudSyncModal?: () => void;
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
  cloudStatus,
  onOpenCloudSyncModal,
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

  // Slide Bar & Scroll State for Tablet & Touch View
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!navRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  // Auto-scroll selected button into view to align with navbar borders on tablet
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector<HTMLButtonElement>(`#${tabsConfig[activeTab]?.elementId}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest'
      });
    }
  }, [activeTab]);

  const handleSlide = (direction: 'left' | 'right') => {
    if (!navRef.current) return;
    const amount = direction === 'left' ? -220 : 220;
    navRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

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
        {/* Top Brand & Actions Bar - Compressed height, responsive font sizes and mobile-friendly layout */}
        <div className="py-1.5 sm:py-2 flex items-center justify-between gap-2 border-b border-slate-100">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shadow-emerald-700/20 shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">
                  {shopConfig.shopName}
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-emerald-200 hidden xs:inline-block shrink-0">
                  Excel POS
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate max-w-[190px] sm:max-w-xs md:max-w-md hidden sm:block">
                Phones, Gadgets, Stock Alerts, Barcodes & Invoices
              </p>
            </div>
          </div>

          {/* Quick KPIs & Action Buttons - Auto-adjusting sizes */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Nepalese BS Date & Time Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]">
              <div className="flex items-center gap-1 font-semibold text-slate-800">
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>{todayBS.formattedBS}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{formatNPTTime(new Date())}</span>
              </div>
            </div>

            {/* Low Stock Indicator Pill */}
            {lowStockCount > 0 ? (
              <button
                onClick={() => onTabChange('inventory')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] sm:text-[11px] font-bold hover:bg-amber-100 transition-colors animate-pulse"
                title="Click to view low stock items"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{lowStockCount} <span className="hidden sm:inline">Low</span></span>
              </button>
            ) : (
              <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                <span>Healthy</span>
              </div>
            )}

            {/* Inventory Valuation Pill */}
            <div className="hidden xl:flex flex-col text-right px-1.5">
              <span className="text-[9px] text-slate-400 uppercase font-semibold">
                Stock Value
              </span>
              <span className="text-[11px] font-bold font-mono text-slate-800">
                {formatNPR(totalCost)}
              </span>
            </div>

            {/* Cloud Sync Status Indicator Pill & Modal Trigger */}
            {cloudStatus && (
              <button
                onClick={onOpenCloudSyncModal}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all ${
                  cloudStatus.state === 'connected'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : cloudStatus.state === 'syncing'
                    ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 animate-pulse'
                    : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                }`}
                title={`Cloud Database: ${cloudStatus.state.toUpperCase()}. Click to inspect multi-device sync status`}
              >
                {cloudStatus.state === 'connected' ? (
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : cloudStatus.state === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-spin" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span className="hidden md:inline">
                  {cloudStatus.state === 'connected' ? 'Cloud Live' :
                   cloudStatus.state === 'syncing' ? 'Syncing...' : 'Offline'}
                </span>
              </button>
            )}

            {/* Import Excel */}
            <button
              onClick={onImportExcel}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] sm:text-xs font-medium transition-colors"
              title="Import .xlsx spreadsheet"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* Scan Barcode button */}
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] sm:text-xs font-bold shadow-2xs transition-colors"
                title="Scan barcode with camera, USB laser gun, or code lookup"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Scan Barcode</span>
                <span className="sm:hidden">Scan</span>
              </button>
            )}

            {/* Export Excel Workbook */}
            <button
              id="header-export-excel-btn"
              onClick={onExportExcel}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] sm:text-xs font-bold shadow-2xs transition-colors"
              title="Download full multi-sheet .xlsx workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Export .xlsx</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation - Slide bar on tablet, aligned with navbar border, flicker-free hover */}
        <div className="relative">
          {/* Left Slide Button for Tablet & Touch Screens */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-2 bg-gradient-to-r from-white via-white/90 to-transparent">
              <button
                type="button"
                onClick={() => handleSlide('left')}
                aria-label="Slide tabs left"
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Right Slide Button for Tablet & Touch Screens */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-2 bg-gradient-to-l from-white via-white/90 to-transparent">
              <button
                type="button"
                onClick={() => handleSlide('right')}
                aria-label="Slide tabs right"
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <nav 
            ref={navRef}
            className="nav-slide-bar flex items-center gap-1 sm:gap-1.5 overflow-x-auto pt-1.5 pb-0 -mb-[1px] select-none scroll-smooth relative"
            aria-label="Main Navigation Tabs"
          >
            {DEFAULT_TAB_KEYS.map((key) => {
              const tab = tabsConfig[key];
              if (!tab) return null;
              const Icon = tab.icon;
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  id={tab.elementId}
                  onClick={() => onTabChange(key)}
                  title={`${tab.label} (${tab.nepaliLabel})`}
                  className={`group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 cursor-pointer -mb-[1px] border-b-2 ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-700 text-white shadow-xs z-10'
                      : 'border-transparent text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80 hover:border-emerald-300'
                  }`}
                >
                  {/* Tab Icon */}
                  <Icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 transition-colors duration-150 ${
                    isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-700'
                  }`} />

                  {/* Dynamic In-Place Label with Auto-Incremental Width & Zero-Flicker Edge Preservation */}
                  <span className="relative inline-grid grid-cols-1 grid-rows-1 items-center justify-items-center py-0.5 tracking-tight pointer-events-none">
                    {/* English anchor to anchor min-width so button never shrinks below English text on hover */}
                    <span className="col-start-1 row-start-1 font-bold whitespace-nowrap opacity-0 pointer-events-none select-none" aria-hidden="true">
                      {tab.label}
                    </span>

                    {/* Dynamic switcher: English at rest, Nepali on hover with auto-incremental width expansion */}
                    <span className="col-start-1 row-start-1 font-bold whitespace-nowrap inline-flex items-center justify-center">
                      <span className="inline group-hover:hidden transition-all duration-150">
                        {tab.label}
                      </span>
                      <span className={`hidden group-hover:inline transition-all duration-150 font-bold ${
                        isActive ? 'text-white' : 'text-emerald-950'
                      }`}>
                        {tab.nepaliLabel}
                      </span>
                    </span>
                  </span>

                  {/* Badge if present */}
                  {tab.badge && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full font-bold transition-colors duration-150 ${tab.badge.className}`}
                    >
                      {tab.badge.text}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
