import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  MapPin,
  TrendingUp,
  RefreshCw,
  Plus,
  Check,
  Zap,
  ShoppingBag,
  ExternalLink,
  Info,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Flame,
  CheckCircle2,
  AlertCircle,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Store,
  Tag,
  CheckCircle,
  Percent,
  Compass,
  Navigation,
  Smartphone,
  Watch,
  Headphones,
  Cpu,
  Truck,
  Phone,
  Clock
} from 'lucide-react';
import { InventoryItem, MarketScoutReport, MarketScoutTrendingItem, ProductCategory } from '../types';
import { useToast } from './Toast';
import { analyzeKeywordForSpike, extractSpikesFromReport } from '../utils/searchFrequencyTracker';

interface MarketScoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingInventory: InventoryItem[];
  onImportItems: (items: Partial<InventoryItem>[], sourceNotes: string) => void;
}

// Popular sample suggestions for quick tap
const POPULAR_LOCATION_SUGGESTIONS = [
  'New Road & Tamrakar Complex, Kathmandu',
  'Kumaripati & Jawalakhel, Lalitpur',
  'Mahabouddha Wholesale Hub, Kathmandu',
  'Lakeside & Mahendrapool, Pokhara',
  'Shahid Chowk & Lions Chowk, Narayangarh',
  'Traffic Chowk & Golpark, Butwal',
  'Main Road, Biratnagar',
  'Bhanu Chowk, Dharan',
  'Mukti Chowk, Birtamode',
  'Suryabinayak, Bhaktapur',
];

const DOMAIN_QUICK_FILTERS = [
  { id: 'All', label: 'All In & Around Area', icon: Compass },
  { id: 'Smartphones', label: 'Phones & Flagships', icon: Smartphone },
  { id: 'Wearables & Smartwatches', label: 'Flagship Wearables', icon: Watch },
  { id: 'Gadgets & Audio', label: 'Gadgets & Smart Tech', icon: Headphones },
  { id: 'Digital Accessories', label: 'Digital Accessories', icon: Zap },
];

export function MarketScoutModal({
  isOpen,
  onClose,
  existingInventory,
  onImportItems,
}: MarketScoutModalProps) {
  const toast = useToast();

  // Freeform custom location state
  const [customLocation, setCustomLocation] = useState('New Road & Tamrakar Complex, Kathmandu, Nepal');
  const [productQuery, setProductQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [groundingMode, setGroundingMode] = useState<'search' | 'maps'>('search');

  // In-View Filter states
  const [viewSearchTerm, setViewSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'MUST HAVE' | 'HIGH PROFIT' | 'TREND EXPLORER'>('ALL');
  const [marginFilter, setMarginFilter] = useState<'ALL' | 'HIGH_30' | 'SUPER_50'>('ALL');
  const [priceRangeFilter, setPriceRangeFilter] = useState<'ALL' | 'BUDGET_UNDER_2K' | 'MID_2K_10K' | 'PREMIUM_OVER_10K'>('ALL');
  const [dealerFilter, setDealerFilter] = useState<string>('ALL');

  // Data states
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MarketScoutReport | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [importedItemIds, setImportedItemIds] = useState<Set<string>>(new Set());

  const activeLocation = customLocation.trim() || 'New Road, Kathmandu, Nepal';

  const fetchScoutReport = async (overrideQuery?: string, overrideCategory?: string, overrideGrounding?: 'search' | 'maps') => {
    setLoading(true);
    try {
      const q = typeof overrideQuery === 'string' ? overrideQuery : productQuery;
      const cat = overrideCategory || selectedCategory;
      const mode = overrideGrounding || groundingMode;
      const response = await fetch('/api/market-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: activeLocation,
          category: cat === 'All' ? 'All' : cat,
          searchQuery: q.trim(),
          groundingMode: mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market scout intelligence');
      }

      const data: MarketScoutReport = await response.json();
      setReport(data);

      // Analyze newly searched keyword or report items for search frequency spikes
      const trimmedQuery = q.trim();
      if (trimmedQuery.length >= 2) {
        const spikeCheck = analyzeKeywordForSpike(trimmedQuery, activeLocation, cat);
        if (spikeCheck.isSpike && spikeCheck.alert) {
          toast.spikeAlert({
            keyword: spikeCheck.alert.keyword,
            location: spikeCheck.alert.location,
            surgePercent: spikeCheck.alert.surgePercent,
            searchVolume: spikeCheck.alert.searchVolume,
            category: spikeCheck.alert.category,
            priceRange: spikeCheck.alert.priceRange,
            demandSummary: spikeCheck.alert.demandSummary,
            actionLabel: 'Filter in Report',
            onAction: () => setViewSearchTerm(spikeCheck.alert!.keyword),
          });
        }
      } else if (data) {
        const spikes = extractSpikesFromReport(data);
        if (spikes.length > 0) {
          const topSpike = spikes[0];
          toast.spikeAlert({
            keyword: topSpike.keyword,
            location: topSpike.location,
            surgePercent: topSpike.surgePercent,
            searchVolume: topSpike.searchVolume,
            category: topSpike.category,
            priceRange: topSpike.priceRange,
            demandSummary: topSpike.demandSummary,
            actionLabel: 'Highlight Item',
            onAction: () => setViewSearchTerm(topSpike.keyword),
          });
        }
      }

      // Initialize default quantities
      const initialQtys: Record<string, number> = {};
      data.trendingItems?.forEach((item) => {
        initialQtys[item.id] = item.recommendedInitialStock || 5;
      });
      setItemQuantities(initialQtys);
      // Select all by default
      setSelectedItemIds(new Set(data.trendingItems?.map((i) => i.id) || []));
    } catch (err) {
      console.warn('Scout fetch warning, using fallback response:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !report) {
      fetchScoutReport();
    }
  }, [isOpen]);

  // Filter loaded trending items in real-time
  const displayedItems = useMemo(() => {
    if (!report?.trendingItems) return [];
    return report.trendingItems.filter((item) => {
      // 1. Search text filter
      if (viewSearchTerm.trim()) {
        const term = viewSearchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(term);
        const matchesBrand = item.brand.toLowerCase().includes(term);
        const matchesCategory = item.category.toLowerCase().includes(term);
        const matchesDemand = item.demandReason.toLowerCase().includes(term);
        const matchesSource = item.priceSource?.toLowerCase().includes(term);
        if (!matchesName && !matchesBrand && !matchesCategory && !matchesDemand && !matchesSource) {
          return false;
        }
      }

      // 2. Category filter from top chips
      if (selectedCategory !== 'All') {
        const itemCat = item.category.toLowerCase();
        const selCat = selectedCategory.toLowerCase();
        if (selCat.includes('phone') && !itemCat.includes('phone') && !itemCat.includes('smart')) {
          return false;
        }
        if (selCat.includes('wearable') && !itemCat.includes('wear') && !itemCat.includes('watch')) {
          return false;
        }
        if (selCat.includes('audio') && !itemCat.includes('audio') && !itemCat.includes('gadget') && !itemCat.includes('smart')) {
          return false;
        }
        if (selCat.includes('accessories') && !itemCat.includes('access') && !itemCat.includes('power') && !itemCat.includes('charg') && !itemCat.includes('case')) {
          return false;
        }
      }

      // 3. Priority filter
      if (priorityFilter !== 'ALL' && item.stockPriority !== priorityFilter) {
        return false;
      }

      // 4. Margin filter
      if (marginFilter === 'HIGH_30' && item.profitMarginPercent < 30) return false;
      if (marginFilter === 'SUPER_50' && item.profitMarginPercent < 50) return false;

      // 5. Price range filter
      if (priceRangeFilter === 'BUDGET_UNDER_2K' && item.estimatedRetailPrice >= 2000) return false;
      if (priceRangeFilter === 'MID_2K_10K' && (item.estimatedRetailPrice < 2000 || item.estimatedRetailPrice > 10000)) return false;
      if (priceRangeFilter === 'PREMIUM_OVER_10K' && item.estimatedRetailPrice <= 10000) return false;

      // 6. Regional Dealer filter
      if (dealerFilter !== 'ALL') {
        const itemDealer = item.regionalDealer?.toLowerCase() || '';
        const itemHub = item.marketHub?.toLowerCase() || '';
        const sel = dealerFilter.toLowerCase();
        if (!itemDealer.includes(sel) && !itemHub.includes(sel)) {
          return false;
        }
      }

      return true;
    });
  }, [report, viewSearchTerm, selectedCategory, priorityFilter, marginFilter, priceRangeFilter, dealerFilter]);

  if (!isOpen) return null;

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQtyChange = (id: string, delta: number) => {
    setItemQuantities((prev) => {
      const current = prev[id] || 1;
      const updated = Math.max(1, current + delta);
      return { ...prev, [id]: updated };
    });
  };

  const checkExistingMatch = (item: MarketScoutTrendingItem): InventoryItem | undefined => {
    const norm = item.name.toLowerCase().trim();
    return existingInventory.find(
      (inv) =>
        inv.name.toLowerCase().trim() === norm ||
        (inv.barcode && item.barcode && inv.barcode.trim() === item.barcode.trim())
    );
  };

  const buildInventoryItemPartial = (item: MarketScoutTrendingItem, qty: number): Partial<InventoryItem> => {
    const existing = checkExistingMatch(item);
    return {
      name: item.name,
      brand: item.brand,
      category: item.category as ProductCategory,
      sku: item.suggestedSku || `SKU-${Date.now().toString().slice(-5)}`,
      stockQuantity: (existing ? existing.stockQuantity : 0) + qty,
      costPrice: item.estimatedCostPrice,
      sellingPrice: item.estimatedRetailPrice,
      reorderLevel: 3,
      barcode: item.barcode || `${Date.now()}`,
      imeiRequired: Boolean(item.imeiRequired),
      supplier: `Market Scout (${item.priceSource || report?.location || 'Nepal Wholesale'})`,
      lastRestockedDate: new Date().toISOString().split('T')[0],
    };
  };

  const handleImportSingle = (item: MarketScoutTrendingItem) => {
    const qty = itemQuantities[item.id] || item.recommendedInitialStock || 5;
    const partial = buildInventoryItemPartial(item, qty);
    onImportItems([partial], `Market Scout Sourcing: ${item.name} (${item.priceSource})`);
    setImportedItemIds((prev) => new Set([...prev, item.id]));
  };

  const handleImportSelected = () => {
    if (!report || selectedItemIds.size === 0) return;
    const itemsToImport = report.trendingItems
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => {
        const qty = itemQuantities[item.id] || item.recommendedInitialStock || 5;
        return buildInventoryItemPartial(item, qty);
      });

    onImportItems(itemsToImport, `Bulk Market Scout Import from ${report.location}`);
    setImportedItemIds((prev) => new Set([...prev, ...selectedItemIds]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
        
        {/* Modal Header with Live Grounding Signals */}
        <div className="px-5 py-4 sm:px-6 sm:py-4 bg-gradient-to-r from-teal-800 via-emerald-800 to-indigo-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20 shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  Real-Time Market Search & Local Demand Scout
                </h2>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  Google & G-Maps Grounded
                </span>
              </div>
              <p className="text-xs text-teal-100/90 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Gathering real-time frequent keywords on Phones, Gadgets, Flagship Wearables & Digital Accessories in and around your area</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg font-bold cursor-pointer"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Custom Location Search & Grounding Engine Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 shrink-0 space-y-3">
          
          {/* Main Search Controls: Custom Location Input & Product Query */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            
            {/* Custom Location Search Field (Replacing preset dropdown) */}
            <div className="lg:col-span-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Search Location (Any Area, Chowk, City or Landmark):
                </label>
                <div className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400">
                  <Navigation className="w-3 h-3" />
                  <span>In & Around Search</span>
                </div>
              </div>

              <div className="relative">
                <input
                  id="custom-location-search-input"
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchScoutReport()}
                  placeholder="e.g. Kumaripati Lalitpur, Tamrakar Complex New Road, Lakeside Pokhara, Shahid Chowk Narayangarh..."
                  className="w-full text-xs font-semibold pl-9 pr-24 py-2.5 rounded-xl border border-teal-500/80 dark:border-teal-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none shadow-xs"
                />
                <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3 top-3" />
                
                {/* Clear / Detect indicator */}
                {customLocation && (
                  <button
                    onClick={() => setCustomLocation('')}
                    className="absolute right-2.5 top-2.5 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Target Product Query / Keyword Filter */}
            <div className="lg:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Target Product / Query (Optional):
              </label>
              <div className="relative">
                <input
                  id="product-keyword-search-input"
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchScoutReport()}
                  placeholder="e.g. Apple Watch Ultra, Redmi Note 14, 65W GaN, ANC earbuds..."
                  className="w-full text-xs font-medium pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>

            {/* Scan Action Button */}
            <div className="lg:col-span-2 flex items-end">
              <button
                id="market-scout-scan-btn"
                onClick={() => fetchScoutReport()}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Scouting Area...' : 'Scout Live Keywords'}</span>
              </button>
            </div>
          </div>

          {/* Quick Location Suggestions Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Quick Hubs:
            </span>
            {POPULAR_LOCATION_SUGGESTIONS.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setCustomLocation(loc + ', Nepal');
                  fetchScoutReport(productQuery, selectedCategory, groundingMode);
                }}
                className={`px-2.5 py-0.5 rounded-lg whitespace-nowrap font-semibold border transition-all cursor-pointer ${
                  customLocation.includes(loc.split(' ')[0])
                    ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                    : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                }`}
              >
                {loc.split(',')[0]}
              </button>
            ))}
          </div>

          {/* Second Row: Four Domain Pillars (Phones, Wearables, Gadgets, Accessories) & Grounding Mode */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/60">
            
            {/* Category Pillars */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar w-full md:w-auto">
              <span className="font-bold text-slate-600 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Retail Focus:
              </span>
              {DOMAIN_QUICK_FILTERS.map((pill) => {
                const IconComponent = pill.icon;
                const isSelected = selectedCategory === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setSelectedCategory(pill.id);
                      fetchScoutReport(productQuery, pill.id, groundingMode);
                    }}
                    className={`px-3 py-1 rounded-xl whitespace-nowrap text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Grounding Mode Toggle: Google Search vs Google Maps Proximity */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">Grounding:</span>
              <button
                onClick={() => {
                  setGroundingMode('search');
                  fetchScoutReport(productQuery, selectedCategory, 'search');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  groundingMode === 'search'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Google Search</span>
              </button>
              <button
                onClick={() => {
                  setGroundingMode('maps');
                  fetchScoutReport(productQuery, selectedCategory, 'maps');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  groundingMode === 'maps'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>Google Maps Proximity</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-4 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 animate-bounce shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                Scanning Real-Time Google & Google Maps Keywords in & around {activeLocation}...
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Gathering real-time frequent keywords regarding phones, flagship wearables, smart gadgets, and digital accessories cross-referenced with official Nepal distributor MRPs and Daraz catalog.
              </p>
            </div>
          ) : report ? (
            <>
              {/* Executive Summary & Keyword Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Summary Card */}
                <div className="lg:col-span-2 p-4 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 dark:from-teal-950/40 dark:to-emerald-950/30 border border-teal-200/80 dark:border-teal-800/50 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-teal-900 dark:text-teal-200">
                        Live Search Intelligence & Price Benchmark ({report.location})
                      </h3>
                    </div>
                    {report.query && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-200/60 dark:bg-teal-800/50 text-teal-900 dark:text-teal-100">
                        Query: "{report.query}"
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                    {report.marketSummary}
                  </p>

                  {/* Sources Consulted Tag Strip */}
                  {report.sourcesConsulted && report.sourcesConsulted.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-teal-200/50 dark:border-teal-800/40 flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Grounded In:
                      </span>
                      {report.sourcesConsulted.map((src, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800/80 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800 font-semibold"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {report.note && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>{report.note}</span>
                    </div>
                  )}
                </div>

                {/* Top Search Keywords in and around Area */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-rose-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Frequent Search Keywords In & Around
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        Live
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {report.topSearchKeywords?.map((kw, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setProductQuery(kw);
                            fetchScoutReport(kw);
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-900/60 font-semibold shadow-2xs transition-all cursor-pointer text-left"
                          title="Click to scout this keyword"
                        >
                          #{kw}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                    💡 Click any keyword to scout real-time pricing & inventory opportunity.
                  </p>
                </div>
              </div>

              {/* Regional Authorized Dealers & Sourcing Network Directory */}
              {report.regionalDealersList && report.regionalDealersList.length > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md border border-indigo-800/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                          Regional Authorized Sourcing & Wholesale Network ({report.location.split(',')[0]})
                        </h4>
                        <p className="text-[11px] text-slate-300">
                          {report.regionalLogisticsInsight || `Verified local supply hubs, authorized brand importers & express lead times for ${report.location.split(',')[0]}.`}
                        </p>
                      </div>
                    </div>

                    {dealerFilter !== 'ALL' && (
                      <button
                        onClick={() => setDealerFilter('ALL')}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 border border-emerald-400/30 transition-all cursor-pointer"
                      >
                        Showing: {dealerFilter.split('(')[0]} (Reset)
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {report.regionalDealersList.map((dealer, idx) => {
                      const isFilterActive = dealerFilter !== 'ALL' && (dealer.name.includes(dealerFilter) || dealer.hubLocation.includes(dealerFilter));
                      return (
                        <div
                          key={idx}
                          onClick={() => setDealerFilter(isFilterActive ? 'ALL' : dealer.name)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                            isFilterActive
                              ? 'bg-indigo-900/90 border-emerald-400 shadow-sm ring-1 ring-emerald-400/50'
                              : 'bg-white/10 hover:bg-white/15 border-white/10 hover:border-emerald-400/40'
                          }`}
                          title="Click to filter products supplied by this dealer"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1.5 mb-1">
                              <span className="text-xs font-black text-white leading-tight">
                                {dealer.name}
                              </span>
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                                {dealer.dealerType.split(' ')[0]}
                              </span>
                            </div>

                            <p className="text-[11px] text-indigo-200 flex items-center gap-1 font-medium">
                              <MapPin className="w-3 h-3 text-teal-300 shrink-0" />
                              <span>{dealer.hubLocation}</span>
                            </p>

                            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-300 flex-wrap">
                              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                                <Clock className="w-3 h-3" />
                                {dealer.averageLeadTime}
                              </span>
                              <span className="flex items-center gap-1 text-slate-300">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {dealer.contactPhone}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 truncate max-w-[140px]">
                              {dealer.keyBrandsCovered?.join(', ')}
                            </span>
                            <span className="text-amber-300 font-bold">
                              {dealer.creditTerms}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sourcing Advice Banner */}
              {report.sourcingAdvice && report.sourcingAdvice.length > 0 && (
                <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50">
                  <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 mb-1.5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Retail Sourcing & Margin Playbook for {report.location.split(',')[0]}:
                  </h4>
                  <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-indigo-950 dark:text-indigo-200">
                    {report.sourcingAdvice.map((advice, i) => (
                      <li key={i} className="flex items-start gap-2 bg-white/70 dark:bg-slate-800/60 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="font-medium leading-relaxed">{advice}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Real-time In-View Filter Controls Bar */}
              <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                
                {/* Search in Results */}
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={viewSearchTerm}
                    onChange={(e) => setViewSearchTerm(e.target.value)}
                    placeholder="Search loaded results (e.g. Apple Watch, GaN, Redmi, Daraz)..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>

                {/* Priority, Margin, Price & Dealer Filters */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-slate-500">Priority:</span>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as any)}
                      className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="MUST HAVE">Must Have Flagships</option>
                      <option value="HIGH PROFIT">High Profit Margin</option>
                      <option value="TREND EXPLORER">Trending Smart Tech</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-slate-500">Margin:</span>
                    <select
                      value={marginFilter}
                      onChange={(e) => setMarginFilter(e.target.value as any)}
                      className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Margins</option>
                      <option value="HIGH_30">&gt; 30% Net Profit</option>
                      <option value="SUPER_50">&gt; 50% Super Margin</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[11px] font-bold text-slate-500">Price:</span>
                    <select
                      value={priceRangeFilter}
                      onChange={(e) => setPriceRangeFilter(e.target.value as any)}
                      className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Prices</option>
                      <option value="BUDGET_UNDER_2K">Under Rs. 2,000</option>
                      <option value="MID_2K_10K">Rs. 2,000 - 10,000</option>
                      <option value="PREMIUM_OVER_10K">Above Rs. 10,000</option>
                    </select>
                  </div>

                  {report.regionalDealersList && report.regionalDealersList.length > 0 && (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                      <span className="text-[11px] font-bold text-slate-500">Dealer:</span>
                      <select
                        value={dealerFilter}
                        onChange={(e) => setDealerFilter(e.target.value)}
                        className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
                      >
                        <option value="ALL">All Dealers</option>
                        {report.regionalDealersList.map((d, i) => (
                          <option key={i} value={d.name}>{d.name.split('(')[0]}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Trending Products Grid */}
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      Trending Items in and around {report.location.split(',')[0]} ({displayedItems.length} of {report.trendingItems?.length || 0})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Prices verified against official Nepal brand stores, Gadgets in Nepal, and Daraz Nepal Mall.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedItemIds.size === displayedItems.length) {
                          setSelectedItemIds(new Set());
                        } else {
                          setSelectedItemIds(new Set(displayedItems.map((i) => i.id)));
                        }
                      }}
                      className="text-xs px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold cursor-pointer"
                    >
                      {selectedItemIds.size === displayedItems.length ? 'Deselect All' : 'Select All'}
                    </button>

                    <button
                      onClick={handleImportSelected}
                      disabled={selectedItemIds.size === 0}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Import Selected ({selectedItemIds.size}) to Stock</span>
                    </button>
                  </div>
                </div>

                {displayedItems.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No products matched your active filter.
                    </p>
                    <button
                      onClick={() => {
                        setViewSearchTerm('');
                        setSelectedCategory('All');
                        setPriorityFilter('ALL');
                        setMarginFilter('ALL');
                        setPriceRangeFilter('ALL');
                      }}
                      className="mt-2 text-xs font-bold text-teal-600 hover:underline cursor-pointer"
                    >
                      Clear In-View Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedItems.map((item, idx) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const isImported = importedItemIds.has(item.id);
                      const existingMatch = checkExistingMatch(item);
                      const qty = itemQuantities[item.id] || item.recommendedInitialStock || 5;

                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-white dark:bg-slate-800/95 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                              : 'bg-white/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                          }`}
                        >
                          {/* Top Metadata */}
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectItem(item.id)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {item.category}
                                </span>
                                {item.marketHub && (
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3 text-teal-500" />
                                    {item.marketHub}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.stockPriority === 'MUST HAVE' && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-rose-500" /> Must Have
                                  </span>
                                )}
                                {item.stockPriority === 'HIGH PROFIT' && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-emerald-600" /> High Margin
                                  </span>
                                )}
                                {item.stockPriority === 'TREND EXPLORER' && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500" /> Trending
                                  </span>
                                )}
                              </div>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                              {item.name}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center justify-between flex-wrap gap-1">
                              <span>Brand: <strong className="text-slate-800 dark:text-slate-200">{item.brand}</strong></span>
                              {item.suggestedSku && (
                                <span className="text-[11px] text-slate-400 font-mono">SKU: {item.suggestedSku}</span>
                              )}
                            </p>

                            {/* Verified Price Source Badge & Direct Reference Link */}
                            <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Verified Source: <span className="text-teal-700 dark:text-teal-300">{item.priceSource || 'Official Nepal Distributor'}</span></span>
                              </div>

                              <div className="flex items-center gap-2">
                                {item.liveAvailability && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                    {item.liveAvailability}
                                  </span>
                                )}
                                {item.sourceUrl && (
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-bold"
                                    title="Open reference portal"
                                  >
                                    <span>Web</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Regional Dealer & Lead Time Strip */}
                            {(item.regionalDealer || item.regionalLeadTime) && (
                              <div className="mt-1.5 p-2 rounded-lg bg-slate-900 text-slate-100 border border-indigo-900/40 flex items-center justify-between gap-2 flex-wrap text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="font-bold text-slate-200 truncate">
                                    {item.regionalDealer || 'Regional Authorized Depot'}
                                  </span>
                                </div>
                                {item.regionalLeadTime && (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                    <Clock className="w-3 h-3" />
                                    {item.regionalLeadTime}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Demand Reason & Regional Factor */}
                            <div className="mt-2 p-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                              <div>
                                <span className="font-bold text-teal-900 dark:text-teal-200">Demand Driver: </span>
                                {item.demandReason}
                              </div>
                              {item.regionalDemandProfile && (
                                <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                  <Compass className="w-3 h-3 shrink-0 text-indigo-500" />
                                  <span>Regional Profile: {item.regionalDemandProfile}</span>
                                </div>
                              )}
                            </div>

                            {/* Financials / Margin Breakdown */}
                            <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-center">
                              <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Dealer Cost</div>
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Rs. {item.estimatedCostPrice.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Retail MRP</div>
                                <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                                  Rs. {item.estimatedRetailPrice.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-bold text-emerald-600">Net Margin</div>
                                <div className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                  +{item.profitMarginPercent}%
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Bottom: Stock Status & Action Buttons */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                            
                            {/* Existing Status */}
                            <div className="text-[11px]">
                              {existingMatch ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                                  <Package className="w-3.5 h-3.5" />
                                  In Catalog (Stock: {existingMatch.stockQuantity})
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400 font-medium">
                                  New Product Opportunity
                                </span>
                              )}
                            </div>

                            {/* Quantity selector & Add Button */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 px-1 py-0.5">
                                <button
                                  onClick={() => handleQtyChange(item.id, -1)}
                                  className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {qty}
                                </span>
                                <button
                                  onClick={() => handleQtyChange(item.id, 1)}
                                  className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                onClick={() => handleImportSingle(item)}
                                disabled={isImported}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                                  isImported
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95'
                                }`}
                              >
                                {isImported ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> Add to Stock
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p>No market report loaded yet. Click "Scout Live Keywords" above.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs text-slate-600 dark:text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">
              Live intelligence grounded with Google Search, Google Maps & Official Brand Stores (Nepal)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
