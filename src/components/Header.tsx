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
  ChevronRight,
  Sparkles,
  Zap,
  Sun,
  Moon,
  Tag
} from 'lucide-react';
import { InventoryItem, ShopConfig, TabKey } from '../types';
import { formatNPR, getTodayBS, formatNPTTime } from '../utils/nepalLocale';
import { CloudStatusInfo } from '../services/cloudSync';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_TAB_KEYS: TabKey[] = [
  'daily',
  'excel',
  'inventory',
  'pos',
  'customers',
  'returns',
  'monthly',
  'calendar'
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
  onOpenMarketScout?: () => void;
  onOpenLabelReminders?: () => void;
  pendingLabelRemindersCount?: number;
  isDark?: boolean;
  onToggleTheme?: () => void;
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
  onOpenMarketScout,
  onOpenLabelReminders,
  pendingLabelRemindersCount = 0,
  isDark: isDarkProp,
  onToggleTheme,
}: Props) {
  const { isDark: contextIsDark, toggleTheme: contextToggleTheme } = useTheme();
  const isDark = isDarkProp ?? contextIsDark;
  const toggleTheme = onToggleTheme ?? contextToggleTheme;

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
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
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
    const amount = direction === 'left' ? -260 : 260;
    navRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Tab configurations with responsive labels, rich Nepali descriptions, and badges
  const tabsConfig: Record<TabKey, {
    elementId: string;
    label: string;
    shortLabel: string;
    nepaliLabel: string;
    nepaliDescription: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: { text: string | number; className: string };
  }> = {
    daily: {
      elementId: 'tab-daily-records',
      label: 'Daily Register',
      shortLabel: 'Daily',
      nepaliLabel: 'दैनिक दर्ता',
      nepaliDescription: 'दैनिक बिक्री, ग्राहक सोधपुछ र नगद हिसाब दर्ता',
      icon: ClipboardList,
      badge: dailyQueriesCount !== undefined && dailyQueriesCount > 0 ? {
        text: dailyQueriesCount,
        className: 'bg-emerald-500 text-white font-mono'
      } : undefined
    },
    excel: {
      elementId: 'tab-excel-grid',
      label: 'Excel Sheet Grid',
      shortLabel: 'Excel',
      nepaliLabel: 'एक्सेल सिट ग्रिड',
      nepaliDescription: 'एक्सेल जस्तै प्रत्यक्ष सेल सम्पादन, हिसाब र फर्मुला',
      icon: FileSpreadsheet
    },
    inventory: {
      elementId: 'tab-inventory',
      label: 'Inventory & Stocks',
      shortLabel: 'Inventory',
      nepaliLabel: 'स्टक तथा सामान',
      nepaliDescription: 'फोन, ग्याजेट, बारकोड, रिअर्डर र गोदाम मौज्दात',
      icon: Smartphone,
      badge: lowStockCount > 0 ? {
        text: lowStockCount,
        className: 'bg-amber-500 text-white font-mono'
      } : undefined
    },
    pos: {
      elementId: 'tab-pos-billing',
      label: 'POS Billing & Cashier',
      shortLabel: 'POS',
      nepaliLabel: 'पीओएस बिलिङ क्यासियर',
      nepaliDescription: 'द्रुत गतिमा भ्याट बिलिङ, बारकोड स्क्यान र क्युआर भुक्तानी',
      icon: ShoppingCart
    },
    customers: {
      elementId: 'tab-customers',
      label: 'Customers & Loyalty',
      shortLabel: 'Customers',
      nepaliLabel: 'ग्राहक तथा लोयल्टी',
      nepaliDescription: 'ग्राहकहरूको फोन, ठेगाना, बाँकी हिसाब र लोयल्टी रिवार्ड',
      icon: Users,
      badge: customersCount !== undefined && customersCount > 0 ? {
        text: customersCount,
        className: 'bg-emerald-800 text-white font-mono'
      } : undefined
    },
    returns: {
      elementId: 'tab-returns',
      label: 'Returns & RMA',
      shortLabel: 'Returns',
      nepaliLabel: 'सामान फिर्ता तथा वारेन्टी',
      nepaliDescription: 'ग्राहक फिर्ता, वारेन्टी दाबी र सामान सट्टापट्टा',
      icon: RotateCcw
    },
    monthly: {
      elementId: 'tab-monthly-report',
      label: 'Monthly Sales Report',
      shortLabel: 'Reports',
      nepaliLabel: 'मासिक प्रतिवेदन',
      nepaliDescription: 'मासिक नाफा-नोक्सान, बिक्री विश्लेषण, चार्ट तथा अडिट',
      icon: TrendingUp
    },
    calendar: {
      elementId: 'tab-google-calendar',
      label: 'Google Calendar',
      shortLabel: 'Calendar',
      nepaliLabel: 'गुगल क्यालेन्डर',
      nepaliDescription: 'स्टक आगमन, ग्राहक फलो-अप र तालिका कार्यक्रम',
      icon: Calendar
    }
  };

  return (
    <header 
      id="main-app-header"
      className="bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-md transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Top Brand & Actions Bar - Strictly contained within bounds so no component crosses the right border */}
        <div className="py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-200/90 dark:border-slate-800 w-full min-w-0 max-w-full">
          {/* Brand Identity & Shop Overview - Fully visible logo & label with proper word spacing */}
          <div 
            id="header-brand-identity"
            className="flex items-center gap-2 sm:gap-2.5 shrink min-w-0 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/30 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-transparent border border-emerald-200/70 dark:border-emerald-800/60 select-none"
          >
            {/* Logo Box - Well-proportioned, visible and responsive */}
            <div 
              id="header-store-logo"
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-950 text-white flex items-center justify-center font-black shadow-xs shadow-emerald-900/20 ring-2 ring-emerald-400/40 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 shrink-0 select-none group cursor-pointer relative overflow-hidden"
              title="WELCOME  MOBILE  ZONE - Nepali Phone & Gadget POS System"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Zap className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-emerald-200 drop-shadow group-hover:scale-110 group-hover:text-white transition-all duration-200" />
            </div>

            {/* Prominent Store Label - Clean, bold, fully visible */}
            <div className="min-w-0">
              <h1 
                id="header-store-name"
                className="text-sm xs:text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-normal drop-shadow-2xs leading-snug uppercase truncate"
              >
                Billing and Records
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5 hidden xs:block">
                Phones, Gadgets & Invoices
                <span className="hidden 2xl:inline text-emerald-800 dark:text-emerald-400 font-bold ml-1.5">
                  (नेपाली फोन तथा ग्याजेट)
                </span>
              </p>
            </div>
          </div>

          {/* Quick Status KPIs & Action Buttons - Strictly contained, responsive and never overflows right border */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            {/* System Status Indicators Group */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Nepalese BS Date & Time Pill */}
              <div 
                className="hidden 2xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/90 dark:border-slate-700 text-xs shadow-2xs transition-colors cursor-default"
                title={`Bikram Sambat BS Calendar: ${todayBS.formattedBS} (काठमाडौं समय: ${formatNPTTime(new Date())})`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{todayBS.formattedBS}</span>
                </div>
                <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-mono text-xs font-semibold">
                  <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  <span>{formatNPTTime(new Date())}</span>
                </div>
              </div>

              {/* Low Stock Indicator Pill - Compact badge */}
              {lowStockCount > 0 ? (
                <button
                  onClick={() => onTabChange('inventory')}
                  className="group flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-2xs transition-colors cursor-pointer"
                  title={`Low Stock Alert: ${lowStockCount} items need reordering (न्यून स्टक सामान)`}
                  aria-label={`Low Stock Alert: ${lowStockCount} items`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-mono text-xs font-bold">{lowStockCount}</span>
                </button>
              ) : null}

              {/* Cloud Sync Status Indicator - ICON ONLY as requested */}
              {cloudStatus && (
                <button
                  onClick={onOpenCloudSyncModal}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-colors cursor-pointer shadow-2xs shrink-0 ${
                    cloudStatus.state === 'connected'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      : cloudStatus.state === 'syncing'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 animate-pulse'
                      : cloudStatus.isNetworkOnline
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                  }`}
                  title={`Cloud Database: ${cloudStatus.state.toUpperCase()} (${cloudStatus.state === 'connected' ? 'क्लाउड लाइभ' : cloudStatus.state === 'syncing' ? 'सिङ्क हुँदै' : cloudStatus.isNetworkOnline ? 'लोकल क्यास' : 'अफलाइन'})`}
                  aria-label={`Cloud Database Status: ${cloudStatus.state}`}
                >
                  {cloudStatus.state === 'connected' ? (
                    <CloudCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : cloudStatus.state === 'syncing' ? (
                    <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
                  ) : cloudStatus.isNetworkOnline ? (
                    <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <CloudOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                </button>
              )}
            </div>

            {/* Subtle Divider */}
            <div className="h-5 sm:h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Action Tools Group with Theme Toggle & Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Theme Toggle (Light / Dark Mode) Button - ICON ONLY as requested */}
              <button
                id="header-theme-toggle-btn"
                type="button"
                onClick={toggleTheme}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer select-none shrink-0"
                title={isDark ? "Switch to Light Mode (लाइट मोड)" : "Switch to Dark Mode (डार्क मोड)"}
                aria-label="Toggle theme between light and dark modes"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform duration-200 shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:-rotate-12 transition-transform duration-200 shrink-0" />
                )}
              </button>

              {/* Import Excel Button - Icon with tooltip, label on large desktop */}
              <button
                onClick={onImportExcel}
                className="w-8 h-8 sm:w-9 sm:h-9 md:w-auto md:px-2.5 md:py-1.5 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Import .xlsx spreadsheet (एक्सेल सिट आयात)"
                aria-label="Import Excel file"
              >
                <Upload className="w-4 h-4 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">Import</span>
              </button>

              {/* Scan Barcode Button - Icon with tooltip, label on large desktop */}
              {onOpenScanner && (
                <button
                  onClick={onOpenScanner}
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-auto md:px-2.5 md:py-1.5 flex items-center justify-center gap-1.5 bg-slate-900 dark:bg-slate-950 hover:bg-slate-800 dark:hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs border border-slate-800 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                  title="Scan barcode with camera or scanner (बारकोड स्क्यान)"
                  aria-label="Scan barcode"
                >
                  <Scan className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="hidden lg:inline whitespace-nowrap">Scan</span>
                </button>
              )}

              {/* AI Market Trends & Inventory Scout Button */}
              {onOpenMarketScout && (
                <button
                  id="header-market-scout-btn"
                  onClick={onOpenMarketScout}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-2xs border border-teal-600/40 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95"
                  title="Market Trends & Inventory Scout (बजार माग र नयाँ उत्पादन खोज)"
                  aria-label="Market Trends and Inventory Scout"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Market Scout</span>
                </button>
              )}

              {/* Barcode & Price Labels Stickering Queue Button */}
              {onOpenLabelReminders && (
                <button
                  id="header-labels-queue-btn"
                  onClick={onOpenLabelReminders}
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold shadow-2xs border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 ${
                    pendingLabelRemindersCount > 0
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 animate-pulse'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200'
                  }`}
                  title={`Label Printing & Stickering Queue: ${pendingLabelRemindersCount} pending (बारकोड र मूल्य स्टिकर रिमाइन्डर)`}
                  aria-label="Label Printing and Stickering Queue"
                >
                  <Tag className={`w-4 h-4 ${pendingLabelRemindersCount > 0 ? 'text-slate-950 font-bold' : 'text-amber-500'} shrink-0`} />
                  <span className="hidden sm:inline whitespace-nowrap">Labels</span>
                  {pendingLabelRemindersCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] font-mono font-black">
                      {pendingLabelRemindersCount}
                    </span>
                  )}
                </button>
              )}

              {/* Export Excel Workbook Button */}
              <button
                id="header-export-excel-btn"
                onClick={onExportExcel}
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                title="Download complete multi-sheet Excel workbook (एक्सेल डाउनलोड)"
                aria-label="Export Excel spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Clean in-button hover label translations with Zero Layout Shift */}
        <div className="relative pt-1 sm:pt-1.5">
          {/* Left Slide Button for Tablet & Touch Screens */}
          {canScrollLeft && (
            <div className="absolute left-0 top-1 bottom-0 z-20 flex items-center pr-2 bg-gradient-to-r from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 dark:to-transparent">
              <button
                type="button"
                onClick={() => handleSlide('left')}
                aria-label="Slide tabs left"
                title="बायाँ सार्नुहोस्"
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}

          {/* Right Slide Button for Tablet & Touch Screens */}
          {canScrollRight && (
            <div className="absolute right-0 top-1 bottom-0 z-20 flex items-center pl-2 bg-gradient-to-l from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 dark:to-transparent">
              <button
                type="button"
                onClick={() => handleSlide('right')}
                aria-label="Slide tabs right"
                title="दायाँ सार्नुहोस्"
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}

          {/* Navigation Tab Bar with In-Button Dynamic Translation Override on Hover (Zero Layout Shift) */}
          <nav 
            ref={navRef}
            className="nav-slide-bar flex items-center gap-1.5 sm:gap-2 overflow-x-auto pt-2 pb-0 -mb-[2px] select-none scroll-smooth relative"
            aria-label="Main Navigation Tabs"
          >
            {DEFAULT_TAB_KEYS.map((key) => {
              const tab = tabsConfig[key];
              if (!tab) return null;
              const Icon = tab.icon;
              const isActive = activeTab === key;

              return (
                <div key={key} className="shrink-0">
                  <button
                    id={tab.elementId}
                    onClick={() => onTabChange(key)}
                    title={`${tab.label} (${tab.nepaliLabel})`}
                    className={`group relative flex items-center justify-center shrink-0 min-w-max gap-2 px-3.5 sm:px-4.5 md:px-5 py-2.5 sm:py-3 rounded-t-xl font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer -mb-[2px] border-b-[3px] ${
                      isActive
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-700 dark:bg-emerald-600 text-white shadow-md z-10'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white hover:bg-emerald-50/90 dark:hover:bg-slate-800/80 hover:border-emerald-400 dark:hover:border-emerald-500'
                    }`}
                  >
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 md:w-[20px] md:h-[20px] shrink-0 transition-colors duration-150 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400'
                    }`} />

                    {/* In-Button Dynamic Label: Overrides label with clean and exact translation on hover without ANY resizing or layout shift */}
                    <span className="inline-grid grid-cols-1 grid-rows-1 items-center text-xs sm:text-sm md:text-[14.5px] tracking-tight whitespace-nowrap">
                      {/* Default English Label */}
                      <span className="col-start-1 row-start-1 text-center transition-opacity duration-150 group-hover:opacity-0 pointer-events-none whitespace-nowrap">
                        <span className="hidden md:inline">{tab.label}</span>
                        <span className="md:hidden">{tab.shortLabel}</span>
                      </span>

                      {/* Clean & Exact Hover Nepali Translation Override */}
                      <span className={`col-start-1 row-start-1 text-center transition-opacity duration-150 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap font-black ${
                        isActive ? 'text-white' : 'text-emerald-950 dark:text-emerald-300'
                      }`}>
                        {tab.nepaliLabel}
                      </span>
                    </span>

                    {/* Badge if present */}
                    {tab.badge && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full font-black shrink-0 transition-colors duration-150 shadow-2xs ${tab.badge.className}`}
                      >
                        {tab.badge.text}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
