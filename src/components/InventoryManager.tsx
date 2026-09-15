import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Barcode, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Edit3, 
  PackagePlus, 
  Smartphone, 
  Tag, 
  DollarSign, 
  Percent, 
  Printer,
  Sparkles,
  X,
  Camera
} from 'lucide-react';
import { InventoryItem, ProductCategory, ShopConfig } from '../types';
import { Code128Barcode } from './Code128Barcode';
import { StockBarcodeLabelModal } from './StockBarcodeLabelModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useToast } from './Toast';
import { formatNPR } from '../utils/nepalLocale';

const DEFAULT_CATEGORIES: ProductCategory[] = [
  'Smartphones',
  'Tablets',
  'Audio',
  'Wearables',
  'Chargers & Power',
  'Protection & Cases',
  'Cables & Adapters',
];

function highlightMatch(text: string, query: string) {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-200 text-slate-900 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface Props {
  inventory: InventoryItem[];
  onAddItem: (item: InventoryItem) => void;
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenScanner: () => void;
  shopConfig?: ShopConfig;
  prefilledBarcodeForNewItem?: string | null;
  onClearPrefilledBarcode?: () => void;
  targetEditItemId?: string | null;
  onClearTargetEditItemId?: () => void;
}

export function InventoryManager({
  inventory,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onOpenScanner,
  shopConfig,
  prefilledBarcodeForNewItem,
  onClearPrefilledBarcode,
  targetEditItemId,
  onClearTargetEditItemId,
}: Props) {
  const toast = useToast();
  // Persistent search state backed by localStorage
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('retail_inventory_search_query') || '';
    } catch {
      return '';
    }
  });
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'sku'>(() => {
    try {
      return (localStorage.getItem('retail_inventory_search_scope') as 'all' | 'name' | 'sku') || 'all';
    } catch {
      return 'all';
    }
  });

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync search state to localStorage for persistence across reloads & tab switches
  useEffect(() => {
    try {
      localStorage.setItem('retail_inventory_search_query', searchQuery);
    } catch {
      // ignore
    }
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem('retail_inventory_search_scope', searchScope);
    } catch {
      // ignore
    }
  }, [searchScope]);

  // Global keyboard shortcut to focus persistent search (/ or Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelTargetItem, setLabelTargetItem] = useState<InventoryItem | null>(null);
  const [showBarcodeCaptureScanner, setShowBarcodeCaptureScanner] = useState(false);

  // Auto-open Add modal with prefilled barcode when redirected from scan
  useEffect(() => {
    if (prefilledBarcodeForNewItem) {
      setEditingItem(null);
      setName('');
      setBrand('');
      setCategory('Smartphones');
      setSku(`GAD-${Math.floor(1000 + Math.random() * 9000)}`);
      setBarcodeVal(prefilledBarcodeForNewItem);
      setCostPrice(120);
      setSellingPrice(179);
      setStockQuantity(10);
      setReorderLevel(3);
      setSupplier('Tech Supply Direct');
      setImeiRequired(true);
      setShowAddModal(true);
      onClearPrefilledBarcode?.();
    }
  }, [prefilledBarcodeForNewItem, onClearPrefilledBarcode]);

  // Auto-open Edit modal if requested from scan dashboard
  useEffect(() => {
    if (targetEditItemId) {
      const match = inventory.find((i) => i.id === targetEditItemId);
      if (match) {
        handleOpenEdit(match);
      }
      onClearTargetEditItemId?.();
    }
  }, [targetEditItemId, inventory, onClearTargetEditItemId]);

  // Form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Smartphones');
  const [sku, setSku] = useState('');
  const [barcodeVal, setBarcodeVal] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(10);
  const [reorderLevel, setReorderLevel] = useState<number>(3);
  const [supplier, setSupplier] = useState('');
  const [imeiRequired, setImeiRequired] = useState(true);

  // Custom Category State
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('retail_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryCreationError, setCategoryCreationError] = useState<string | null>(null);

  // Compute all unique available categories
  const allCategories = useMemo(() => {
    const combined = Array.from(
      new Set([
        ...DEFAULT_CATEGORIES,
        ...customCategories,
        ...inventory.map((i) => i.category).filter(Boolean),
      ])
    );
    return combined;
  }, [customCategories, inventory]);

  const handleCreateCustomCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryCreationError('Please enter category name (e.g. Gaming Gear, Smart Home)');
      return;
    }
    const alreadyExists = allCategories.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      const existing = allCategories.find((c) => c.toLowerCase() === trimmed.toLowerCase())!;
      setCategory(existing as any);
      setShowCustomCategoryInput(false);
      setNewCategoryName('');
      setCategoryCreationError(null);
      toast.info(`Category "${existing}" already exists and has been selected.`);
      return;
    }

    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    try {
      localStorage.setItem('retail_custom_categories', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setCategory(trimmed as any);
    setNewCategoryName('');
    setShowCustomCategoryInput(false);
    setCategoryCreationError(null);
    toast.success(`Custom category "${trimmed}" created and selected!`, 'New Category');
  };

  // Calculations for Add/Edit Modal
  const modalProfit = Math.max(0, sellingPrice - costPrice);
  const modalMargin = sellingPrice > 0 ? (modalProfit / sellingPrice) * 100 : 0;
  const modalMarkup = costPrice > 0 ? (modalProfit / costPrice) * 100 : 0;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setName('');
    setBrand('');
    setCategory('Smartphones');
    setShowCustomCategoryInput(false);
    setNewCategoryName('');
    setCategoryCreationError(null);
    setSku(`GAD-${Math.floor(1000 + Math.random() * 9000)}`);
    setBarcodeVal(`${Math.floor(100000000000 + Math.random() * 900000000000)}`);
    setCostPrice(100);
    setSellingPrice(149);
    setStockQuantity(8);
    setReorderLevel(3);
    setSupplier('Tech Supply Direct');
    setImeiRequired(true);
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setBrand(item.brand);
    setCategory(item.category);
    setShowCustomCategoryInput(false);
    setNewCategoryName('');
    setCategoryCreationError(null);
    setSku(item.sku);
    setBarcodeVal(item.barcode);
    setCostPrice(item.costPrice);
    setSellingPrice(item.sellingPrice);
    setStockQuantity(item.stockQuantity);
    setReorderLevel(item.reorderLevel);
    setSupplier(item.supplier);
    setImeiRequired(item.imeiRequired);
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brand.trim()) {
      toast.warning('Please fill in product name and brand.');
      return;
    }

    const trimmedSku = sku.trim();
    const trimmedBarcode = barcodeVal.trim();

    // Deduplication check: SKU
    if (trimmedSku) {
      const duplicateSku = inventory.find(
        (i) => (!editingItem || i.id !== editingItem.id) && i.sku.toLowerCase() === trimmedSku.toLowerCase()
      );
      if (duplicateSku) {
        toast.error(
          `Duplicate SKU! SKU "${trimmedSku}" is already assigned to "${duplicateSku.name}".`,
          'Duplicate SKU'
        );
        return;
      }
    }

    // Deduplication check: Barcode
    if (trimmedBarcode) {
      const duplicateBarcode = inventory.find(
        (i) => (!editingItem || i.id !== editingItem.id) && i.barcode.toLowerCase() === trimmedBarcode.toLowerCase()
      );
      if (duplicateBarcode) {
        toast.error(
          `Duplicate Barcode! Barcode "${trimmedBarcode}" is already assigned to "${duplicateBarcode.name}" (SKU: ${duplicateBarcode.sku}).`,
          'Duplicate Barcode'
        );
        return;
      }
    }

    let finalCategory: string = category;
    if (showCustomCategoryInput && newCategoryName.trim()) {
      const trimmed = newCategoryName.trim();
      if (!customCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        const updated = [...customCategories, trimmed];
        setCustomCategories(updated);
        try {
          localStorage.setItem('retail_custom_categories', JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      finalCategory = trimmed;
    }

    if (editingItem) {
      onUpdateItem({
        ...editingItem,
        name: name.trim(),
        brand: brand.trim(),
        category: finalCategory as ProductCategory,
        sku: trimmedSku,
        barcode: trimmedBarcode,
        costPrice,
        sellingPrice,
        stockQuantity,
        reorderLevel,
        supplier: supplier.trim(),
        imeiRequired,
      });
      toast.success(`Updated "${name.trim()}".`);
    } else {
      const newItem: InventoryItem = {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        brand: brand.trim(),
        category: finalCategory as ProductCategory,
        sku: trimmedSku,
        barcode: trimmedBarcode,
        costPrice,
        sellingPrice,
        stockQuantity,
        reorderLevel,
        supplier: supplier.trim(),
        imeiRequired,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      };
      onAddItem(newItem);
      toast.success(`Added "${name.trim()}" to catalog.`);
    }

    setShowAddModal(false);
  };

  const handleQuickRestock = (item: InventoryItem, qty: number) => {
    onUpdateItem({
      ...item,
      stockQuantity: item.stockQuantity + qty,
      lastRestockedDate: new Date().toISOString().split('T')[0],
    });
  };

  // Filters
  const filteredInventory = inventory.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    let matchesSearch = true;

    if (q) {
      if (searchScope === 'name') {
        matchesSearch =
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q);
      } else if (searchScope === 'sku') {
        matchesSearch = item.sku.toLowerCase().includes(q);
      } else {
        // 'all'
        matchesSearch =
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.barcode.includes(q);
      }
    }

    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;

    let matchesStock = true;
    if (filterStockStatus === 'low') {
      matchesStock = item.stockQuantity <= item.reorderLevel && item.stockQuantity > 0;
    } else if (filterStockStatus === 'out') {
      matchesStock = item.stockQuantity <= 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const lowStockCount = inventory.filter((i) => i.stockQuantity <= i.reorderLevel).length;

  return (
    <div className="space-y-4">
      {/* Persistent Sticky Search & Control Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-3 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={
                searchScope === 'name'
                  ? "Search specifically by product name (e.g., iPhone 15, Pixel 9, Galaxy S24)..."
                  : searchScope === 'sku'
                  ? "Search specifically by unique SKU (e.g., APL-IP15P, SAM-S24U, GAD-1001)..."
                  : "Search inventory by product name, unique SKU, brand, or barcode..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all shadow-2xs"
            />
            {/* Clear Button / Keyboard Shortcut indicator */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  title="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Quick Scanner & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={onOpenScanner}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              title="Scan barcode with camera or laser reader"
            >
              <Barcode className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Scan to Search</span>
            </button>

            <button
              onClick={() => {
                setLabelTargetItem(null);
                setShowLabelModal(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
              title="Print Code128 physical stock labels"
            >
              <Barcode className="w-4 h-4 text-emerald-400" />
              <span>Stock Labels</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Phone / Gadget</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Filter Scope (All / Product Name / Unique SKU) + Stock status + Live result count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          {/* Target Scope Pills: All / Product Name / Unique SKU */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-[11px] font-semibold">Filter by:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSearchScope('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  searchScope === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Fields
              </button>
              <button
                type="button"
                onClick={() => setSearchScope('name')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                  searchScope === 'name'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Product Name</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchScope('sku')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                  searchScope === 'sku'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3 h-3 text-emerald-600" />
                <span>Unique SKU</span>
              </button>
            </div>

            {/* Quick SKU prefix tags */}
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-400">
              <span>Quick SKU:</span>
              {['APL', 'SAM', 'GGL', 'AUD', 'CAS'].map((prefix) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => {
                    setSearchScope('sku');
                    setSearchQuery(prefix);
                  }}
                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                    searchQuery === prefix && searchScope === 'sku'
                      ? 'bg-slate-900 text-white border-slate-900 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {prefix}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Stock Level Filters + Counter */}
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setFilterStockStatus('all')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filterStockStatus === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                All ({inventory.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStockStatus('low')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filterStockStatus === 'low'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-amber-700 hover:bg-amber-100/60'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Low ({lowStockCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterStockStatus('out')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  filterStockStatus === 'out'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-100/60'
                }`}
              >
                Out
              </button>
            </div>

            {/* Results Count Badge */}
            <div className="text-[11px] text-slate-500 font-mono-num whitespace-nowrap">
              {filteredInventory.length === inventory.length ? (
                <span>{inventory.length} items</span>
              ) : (
                <span className="font-semibold text-emerald-800">
                  {filteredInventory.length} of {inventory.length} matched
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {['All', ...allCategories].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Inventory Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Product & Brand</th>
                <th className="p-3">Barcode & SKU (Code128)</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Cost ($)</th>
                <th className="p-3 text-right">Selling Price ($)</th>
                <th className="p-3 text-right">Profit & Margin</th>
                <th className="p-3 text-center">Stock Level</th>
                <th className="p-3 text-right">Total Value</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center bg-slate-50/50">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-800 text-sm">No products found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      No inventory records found for &ldquo;<span className="font-semibold text-slate-700">{searchQuery}</span>&rdquo;
                      {searchScope !== 'all' ? ` matching ${searchScope === 'name' ? 'Product Name' : 'Unique SKU'}` : ''}.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchScope('all');
                        setSelectedCategory('All');
                        setFilterStockStatus('all');
                        searchInputRef.current?.focus();
                      }}
                      className="mt-3 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Clear Search & Reset Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const profit = item.sellingPrice - item.costPrice;
                  const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0;
                  const isLow = item.stockQuantity <= item.reorderLevel;
                  const isOut = item.stockQuantity <= 0;
                  const stockVal = item.costPrice * item.stockQuantity;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Name & Brand */}
                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-slate-900">
                          {highlightMatch(item.name, searchQuery)}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-700">
                            {highlightMatch(item.brand, searchQuery)}
                          </span>
                          <span>•</span>
                          <span>Supplier: {item.supplier}</span>
                        </div>
                      </td>

                      {/* Barcode & SKU */}
                      <td className="p-3 text-slate-700">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-num font-bold text-slate-900 text-xs tracking-tight bg-slate-100 px-1.5 py-0.5 rounded">
                              {highlightMatch(item.sku, searchQuery)}
                            </span>
                            <button
                              onClick={() => {
                                setLabelTargetItem(item);
                                setShowLabelModal(true);
                              }}
                              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                              title={`Generate & print Code128 stock labels for ${item.sku}`}
                            >
                              <Barcode className="w-3 h-3 text-emerald-400" />
                              <span>Label</span>
                            </button>
                          </div>

                        {/* Inline Code128 Barcode Visual */}
                        <div
                          onClick={() => {
                            setLabelTargetItem(item);
                            setShowLabelModal(true);
                          }}
                          className="bg-white p-1 rounded border border-slate-200 hover:border-emerald-500 transition-colors cursor-pointer flex justify-center shadow-2xs group"
                          title="Click to open label printer & view full scannable barcode"
                        >
                          <Code128Barcode
                            value={item.sku}
                            height={24}
                            width={1.15}
                            displayValue={false}
                            className="h-6 max-w-[130px] opacity-90 group-hover:opacity-100"
                          />
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono-num flex items-center justify-between">
                          <span>UPC/EAN: {item.barcode}</span>
                          <span className="text-emerald-700 font-medium">Code128</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="p-3 text-right font-mono text-slate-600">
                      {formatNPR(item.costPrice)}
                    </td>

                    {/* Selling */}
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatNPR(item.sellingPrice)}
                    </td>

                    {/* Profit Margin */}
                    <td className="p-3 text-right">
                      <div className="font-mono font-bold text-emerald-800">
                        +{formatNPR(profit)}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            margin >= 35
                              ? 'bg-emerald-100 text-emerald-800'
                              : margin >= 18
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {margin.toFixed(1)}% margin
                        </span>
                      </div>
                    </td>

                    {/* Stock Status */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isOut
                              ? 'text-rose-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-slate-800'
                          }`}
                        >
                          {item.stockQuantity}
                        </span>

                        {isOut ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">
                            OUT OF STOCK
                          </span>
                        ) : isLow ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold animate-pulse">
                            LOW (&le;{item.reorderLevel})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Reorder: {item.reorderLevel}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stock Value */}
                    <td className="p-3 text-right font-mono text-slate-700">
                      {formatNPR(stockVal)}
                    </td>

                    {/* Action Controls */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setLabelTargetItem(item);
                            setShowLabelModal(true);
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title={`Print physical stock label for ${item.sku}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleQuickRestock(item, 5)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                          title="Quick restock +5 units"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="Edit product"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${item.name}" from inventory?`)) {
                              onDeleteItem(item.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Phone / Gadget Item' : 'Add New Inventory Item'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="py-3 space-y-3 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-slate-600 mb-0.5 text-[11px] font-medium">Product Description / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apple iPhone 15 Pro (128GB, Natural Titanium)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-0.5 text-[11px] font-medium">Brand</label>
                  <input
                    type="text"
                    required
                    placeholder="Apple, Samsung, Sony..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-slate-600 text-[11px] font-medium">Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomCategoryInput(!showCustomCategoryInput);
                        setCategoryCreationError(null);
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 transition-colors"
                      title="Add a custom product category"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showCustomCategoryInput ? 'Choose Standard' : '+ Custom Category'}</span>
                    </button>
                  </div>
                  <select
                    value={showCustomCategoryInput ? '__NEW_CUSTOM__' : category}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_CUSTOM__') {
                        setShowCustomCategoryInput(true);
                        setCategoryCreationError(null);
                      } else {
                        setCategory(e.target.value as any);
                        setShowCustomCategoryInput(false);
                        setCategoryCreationError(null);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <optgroup label="Standard Categories">
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="Custom Categories">
                        {customCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Create New">
                      <option value="__NEW_CUSTOM__">➕ + Create New Category...</option>
                    </optgroup>
                  </select>

                  {/* Dropdown Section for Custom Category to Create New Category */}
                  {showCustomCategoryInput && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-emerald-300 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>Create New Custom Category</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomCategoryInput(false);
                            setNewCategoryName('');
                            setCategoryCreationError(null);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Gaming Gear, Smart Home, Drones..."
                          value={newCategoryName}
                          onChange={(e) => {
                            setNewCategoryName(e.target.value);
                            setCategoryCreationError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCreateCustomCategory();
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCustomCategory}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Create</span>
                        </button>
                      </div>

                      {categoryCreationError && (
                        <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{categoryCreationError}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-slate-600 text-[11px] font-medium">Barcode (EAN-13 / UPC)</label>
                    <button
                      type="button"
                      onClick={() => setShowBarcodeCaptureScanner(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                      title="Scan barcode with camera or laser scanner"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan Barcode</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="195949012345"
                      value={barcodeVal}
                      onChange={(e) => setBarcodeVal(e.target.value)}
                      className="w-full pl-2.5 pr-9 py-1.5 border border-slate-200 rounded-lg font-mono-num text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeCaptureScanner(true)}
                      className="absolute right-1 p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Open scanner camera to fill barcode"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-0.5 text-[11px] font-medium">Internal SKU</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono-num font-bold text-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Profit Margin Interactive Calculator */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-emerald-700" />
                    Profit Margin Real-Time Calculator
                  </span>
                  <span className="text-[11px] text-emerald-700">Auto calculated</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-emerald-800 mb-1 font-medium">Wholesale Cost Price (रु)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={costPrice}
                      onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-800 mb-1 font-medium">Retail Selling Price (रु)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Live Computed Metrics */}
                <div className="pt-2 border-t border-emerald-200 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase">Gross Profit</span>
                    <p className="font-bold font-mono text-emerald-800 text-sm">
                      +{formatNPR(modalProfit)}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase">Profit Margin</span>
                    <p className="font-bold font-mono-num text-emerald-800 text-sm">
                      {modalMargin.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase">Cost Markup</span>
                    <p className="font-bold font-mono-num text-emerald-800 text-sm">
                      {modalMarkup.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock and Low Stock Reorder Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Current Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono-num"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Alert triggers when stock &le; this level
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Wholesale Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. Alpha Tech Distribution"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="imeiReq"
                    checked={imeiRequired}
                    onChange={(e) => setImeiRequired(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="imeiReq" className="text-slate-700 font-medium">
                    Require IMEI / Serial recording at POS
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  {editingItem ? 'Save Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Barcode Label Studio Modal (Code128 scannable labels) */}
      <StockBarcodeLabelModal
        isOpen={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        initialItem={labelTargetItem}
        inventory={inventory}
        shopConfig={shopConfig}
      />

      {/* Barcode Scanner Scoped Specifically for Filling Barcode Field */}
      {showBarcodeCaptureScanner && (
        <BarcodeScannerModal
          isOpen={showBarcodeCaptureScanner}
          onClose={() => setShowBarcodeCaptureScanner(false)}
          onBarcodeDetected={(scannedCode) => {
            setBarcodeVal(scannedCode);
            setShowBarcodeCaptureScanner(false);
          }}
          inventory={inventory}
          title="Scan Product Barcode"
          subtitle="Scan with camera, USB laser gun, or quick test to fill barcode field"
          zIndexClass="z-[60]"
        />
      )}
    </div>
  );
}
