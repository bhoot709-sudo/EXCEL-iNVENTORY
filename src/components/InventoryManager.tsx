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
  Camera,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Receipt,
  User,
  Copy,
  FileText,
  Layers,
  CheckCircle
} from 'lucide-react';
import { InventoryItem, ProductCategory, ShopConfig, LabelPrintReminder, Invoice } from '../types';
import { Code128Barcode } from './Code128Barcode';
import { SkuQrCode } from './SkuQrCode';
import { StockBarcodeLabelModal } from './StockBarcodeLabelModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ExistingProductMatchModal } from './ExistingProductMatchModal';
import { useToast } from './Toast';
import { formatNPR } from '../utils/nepalLocale';
import { analyzeKeywordForSpike } from '../utils/searchFrequencyTracker';
import { 
  generateUniqueSku, 
  generateBatchUniqueSkus,
  generateUniqueBarcode, 
  getSkuSuggestions, 
  validateSkuUniqueness,
  getUnitSaleInfo,
  expandInventoryToIndividualUnits
} from '../utils/skuGenerator';
import { SkuLabelChecker } from './SkuLabelChecker';

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
  onAddBatchItems?: (items: InventoryItem[]) => void;
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenScanner: () => void;
  onOpenMarketScout?: () => void;
  onOpenLabelReminders?: () => void;
  pendingLabelRemindersCount?: number;
  onAddLabelReminder?: (reminder: Partial<LabelPrintReminder>) => void;
  shopConfig?: ShopConfig;
  invoices?: Invoice[];
  onConvertAllToIndividualItems?: () => void;
  prefilledBarcodeForNewItem?: string | null;
  onClearPrefilledBarcode?: () => void;
  targetEditItemId?: string | null;
  onClearTargetEditItemId?: () => void;
  onOpenRestock?: (item?: InventoryItem) => void;
  onOpenReturn?: (item?: InventoryItem, code?: string) => void;
}

export function InventoryManager({
  inventory,
  invoices = [],
  onConvertAllToIndividualItems,
  onAddItem,
  onAddBatchItems,
  onUpdateItem,
  onDeleteItem,
  onOpenScanner,
  onOpenMarketScout,
  onOpenLabelReminders,
  pendingLabelRemindersCount = 0,
  onAddLabelReminder,
  shopConfig,
  prefilledBarcodeForNewItem,
  onClearPrefilledBarcode,
  targetEditItemId,
  onClearTargetEditItemId,
  onOpenRestock,
  onOpenReturn,
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
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'in_stock' | 'sold' | 'low' | 'out'>('all');
  const [viewMode, setViewMode] = useState<'individual' | 'grouped'>('individual');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelTargetItem, setLabelTargetItem] = useState<InventoryItem | null>(null);
  const [showBarcodeCaptureScanner, setShowBarcodeCaptureScanner] = useState(false);
  const [matchedProductPopup, setMatchedProductPopup] = useState<InventoryItem | null>(null);
  const [matchedScanCode, setMatchedScanCode] = useState<string>('');

  // Handle checking barcode or QR code with all inventory items, auto-filling and triggering restock/return popup
  const handleCheckAndProcessBarcode = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    // Check against all inventory items
    const existing = inventory.find(
      (i) =>
        (i.barcode && i.barcode.trim().toLowerCase() === clean.toLowerCase()) ||
        (i.sku && i.sku.trim().toLowerCase() === clean.toLowerCase())
    );

    if (existing) {
      // 1. Auto-fill all details
      setName(existing.name);
      setBrand(existing.brand);
      setCategory(existing.category);
      setCostPrice(existing.costPrice);
      setSellingPrice(existing.sellingPrice);
      setStockQuantity(existing.stockQuantity);
      setReorderLevel(existing.reorderLevel);
      setSupplier(existing.supplier);
      setSku(existing.sku);
      setBarcodeVal(existing.barcode);
      setImeiRequired(existing.imeiRequired);
      setEditingItem(existing);

      // 2. Open the regarding popup to restock or return
      setMatchedScanCode(clean);
      setMatchedProductPopup(existing);
      toast.info(`Found existing product "${existing.name}". Details auto-filled.`, 'Catalog Match');
    } else {
      setBarcodeVal(clean);
      toast.success(`Barcode "${clean}" recorded for new product.`, 'New Barcode');
    }
  };

  // Auto-open Add modal with prefilled barcode when redirected from scan
  useEffect(() => {
    if (prefilledBarcodeForNewItem) {
      const match = inventory.find(
        (i) =>
          (i.barcode && i.barcode.trim().toLowerCase() === prefilledBarcodeForNewItem.trim().toLowerCase()) ||
          (i.sku && i.sku.trim().toLowerCase() === prefilledBarcodeForNewItem.trim().toLowerCase())
      );
      if (match) {
        handleOpenEdit(match);
        setMatchedScanCode(prefilledBarcodeForNewItem);
        setMatchedProductPopup(match);
        toast.info(`Found existing item "${match.name}". Details loaded.`, 'Catalog Match');
      } else {
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
      }
      onClearPrefilledBarcode?.();
    }
  }, [prefilledBarcodeForNewItem, onClearPrefilledBarcode, inventory]);

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

  // Batch Item Tracking State (Same Barcode, Distinct Unique SKUs)
  const [batchMode, setBatchMode] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState(5);
  const [batchSkus, setBatchSkus] = useState<string[]>([]);

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
    setBatchMode(false);
    setBatchQuantity(5);
    setBatchSkus([]);
    const initialSmartSku = generateUniqueSku('', 'Smartphones', '', inventory, { style: 'smart' });
    const initialUniqueBarcode = generateUniqueBarcode(inventory);
    setSku(initialSmartSku);
    setBarcodeVal(initialUniqueBarcode);
    setCostPrice(1000);
    setSellingPrice(1499);
    setStockQuantity(5);
    setReorderLevel(2);
    setSupplier('Wholesale Electronics Distributor');
    setImeiRequired(true);
    setShowAddModal(true);
  };

  const handleGenerateSku = (style: 'smart' | 'compact' | 'serial' = 'smart') => {
    const newSku = generateUniqueSku(brand || 'Gadget', category, name || 'Product', inventory, { style });
    setSku(newSku);
    const newBarcode = generateUniqueBarcode(inventory);
    setBarcodeVal(newBarcode);
    toast.success(`Generated unique SKU: "${newSku}" and barcode: "${newBarcode}"`, 'Code Generated');
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setBrand(item.brand);
    setCategory(item.category);
    setShowCustomCategoryInput(false);
    setNewCategoryName('');
    setCategoryCreationError(null);
    setBatchMode(false);
    setBatchQuantity(5);
    setBatchSkus([]);
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

    const trimmedBarcode = barcodeVal.trim() || generateUniqueBarcode(inventory);

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

    // BATCH MODE: Add multiple individual unit items of same product with same barcode
    if (!editingItem && batchMode && batchSkus.length > 0) {
      // Validate all batch SKUs uniqueness against inventory catalog
      const existingSkuSet = new Set(inventory.map((i) => i.sku.trim().toLowerCase()));
      for (const bSku of batchSkus) {
        if (existingSkuSet.has(bSku.trim().toLowerCase())) {
          toast.error(`Duplicate SKU in batch: "${bSku}". Please click Regenerate to get fresh unique SKUs.`, 'Duplicate SKU');
          return;
        }
      }

      const createdItems: InventoryItem[] = batchSkus.map((bSku, idx) => ({
        id: `prod-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        brand: brand.trim(),
        category: finalCategory as ProductCategory,
        sku: bSku.toUpperCase(),
        barcode: trimmedBarcode,
        costPrice,
        sellingPrice,
        stockQuantity: 1, // each individual unit is separately tagged
        reorderLevel: 1,
        supplier: supplier.trim() || 'Wholesale Distributor',
        imeiRequired,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      }));

      if (onAddBatchItems) {
        onAddBatchItems(createdItems);
      } else {
        createdItems.forEach((item) => onAddItem(item));
      }

      setShowAddModal(false);
      return;
    }

    // SINGLE ITEM MODE
    const trimmedSku = (sku.trim() || generateUniqueSku(brand, finalCategory, name, inventory)).toUpperCase();

    // Validate SKU uniqueness
    const skuValidation = validateSkuUniqueness(trimmedSku, editingItem?.id, inventory);
    if (!skuValidation.isValid) {
      toast.error(skuValidation.error || 'Duplicate SKU detected!', 'SKU Conflict');
      return;
    }

    // Check shared barcode (allowed for same product model / batches)
    if (trimmedBarcode) {
      const duplicateBarcode = inventory.find(
        (i) => (!editingItem || i.id !== editingItem.id) && i.barcode && i.barcode.toLowerCase() === trimmedBarcode.toLowerCase()
      );
      if (duplicateBarcode) {
        toast.info(
          `Product shares barcode "${trimmedBarcode}" with "${duplicateBarcode.name}". Unique SKU "${trimmedSku}" guarantees distinct item tracking.`,
          'Shared Product Barcode'
        );
      }
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
        supplier: supplier.trim() || 'Wholesale Distributor',
        imeiRequired,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      };
      onAddItem(newItem);

      // Auto-queue label printing & stickering reminder
      if (onAddLabelReminder) {
        onAddLabelReminder({
          itemId: newItem.id,
          itemName: newItem.name,
          brand: newItem.brand,
          category: newItem.category,
          sku: newItem.sku,
          barcode: newItem.barcode,
          sellingPrice: newItem.sellingPrice,
          costPrice: newItem.costPrice,
          quantityNeeded: newItem.stockQuantity > 0 ? newItem.stockQuantity : 1,
          source: 'NEW_PRODUCT',
          status: 'PENDING',
        });
      }

      toast.success(
        `Added "${name.trim()}"! 🏷️ ${newItem.stockQuantity || 1} Barcode & Price labels queued for stickering.`,
        'Product Created'
      );
    }

    setShowAddModal(false);
  };

  const handleQuickRestock = (item: InventoryItem, qty: number) => {
    const newBatchSkus = generateBatchUniqueSkus(
      qty,
      item.brand,
      item.category,
      item.name,
      inventory,
      { isRestock: true, batchTag: 'RESTOCK' }
    );

    if (item.stockQuantity === 0) {
      onUpdateItem({
        ...item,
        stockQuantity: 1,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      });
      const remainingSkus = newBatchSkus.slice(1);
      if (remainingSkus.length > 0) {
        const extraItems: InventoryItem[] = remainingSkus.map((sku, idx) => ({
          ...item,
          id: `prod-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          sku,
          stockQuantity: 1,
          lastRestockedDate: new Date().toISOString().split('T')[0],
        }));
        if (onAddBatchItems) {
          onAddBatchItems(extraItems);
        } else {
          extraItems.forEach((it) => onAddItem(it));
        }
      }
    } else {
      const newItems: InventoryItem[] = newBatchSkus.map((sku, idx) => ({
        ...item,
        id: `prod-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        sku,
        stockQuantity: 1,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      }));
      if (onAddBatchItems) {
        onAddBatchItems(newItems);
      } else {
        newItems.forEach((it) => onAddItem(it));
      }
    }

    if (onAddLabelReminder) {
      onAddLabelReminder({
        itemId: item.id,
        itemName: item.name,
        brand: item.brand,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice,
        quantityNeeded: qty,
        source: 'RESTOCK',
        status: 'PENDING',
      });
    }

    toast.success(
      `Restocked +${qty} physical units for "${item.name}" with unique SKUs. 🏷️ Added ${qty} labels to reminder queue.`,
      'Restocked'
    );
  };

  // Filters (memoized for high performance catalog browsing)
  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter((item) => {
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
      if (filterStockStatus === 'in_stock') {
        matchesStock = item.stockQuantity > 0;
      } else if (filterStockStatus === 'sold') {
        matchesStock = item.stockQuantity <= 0;
      } else if (filterStockStatus === 'low') {
        matchesStock = item.stockQuantity <= item.reorderLevel && item.stockQuantity > 0;
      } else if (filterStockStatus === 'out') {
        matchesStock = item.stockQuantity <= 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inventory, searchQuery, searchScope, selectedCategory, filterStockStatus]);

  const inStockCount = useMemo(() => {
    return inventory.filter((i) => i.stockQuantity > 0).length;
  }, [inventory]);

  const soldCount = useMemo(() => {
    return inventory.filter((i) => i.stockQuantity <= 0).length;
  }, [inventory]);

  const lowStockCount = useMemo(() => {
    return inventory.filter((i) => i.stockQuantity <= i.reorderLevel && i.stockQuantity > 0).length;
  }, [inventory]);

  // Total unique product item types (models) available in inventory stock
  const totalItemTypes = useMemo(() => {
    const types = new Set(
      inventory.map((item) => (item.barcode && item.barcode.trim()) || item.name.trim().toLowerCase())
    );
    return types.size;
  }, [inventory]);

  const inStockItemTypes = useMemo(() => {
    const inStock = inventory.filter((item) => item.stockQuantity > 0);
    const types = new Set(
      inStock.map((item) => (item.barcode && item.barcode.trim()) || item.name.trim().toLowerCase())
    );
    return types.size;
  }, [inventory]);

  // Exact SKU or Barcode Match Detection
  const cleanSearchQuery = searchQuery.trim().toLowerCase();
  const exactMatchItem = useMemo(() => {
    if (!cleanSearchQuery) return null;
    return inventory.find(
      (item) =>
        (item.sku && item.sku.trim().toLowerCase() === cleanSearchQuery) ||
        (item.barcode && item.barcode.trim().toLowerCase() === cleanSearchQuery)
    );
  }, [inventory, cleanSearchQuery]);

  const exactMatchSaleInfo = useMemo(() => {
    if (!exactMatchItem) return null;
    return getUnitSaleInfo(exactMatchItem.sku, exactMatchItem.id, invoices);
  }, [exactMatchItem, invoices]);

  // Check if any inventory items are grouped (stockQuantity > 1)
  const hasGroupedItems = useMemo(() => {
    return inventory.some((i) => i.stockQuantity > 1);
  }, [inventory]);

  // Grouped products aggregation for "Grouped" view mode
  const groupedProducts = useMemo(() => {
    const groups: {
      [key: string]: {
        key: string;
        name: string;
        brand: string;
        category: string;
        barcode: string;
        costPrice: number;
        sellingPrice: number;
        totalStock: number;
        inStockUnits: InventoryItem[];
        soldUnits: InventoryItem[];
        items: InventoryItem[];
      };
    } = {};

    filteredInventory.forEach((item) => {
      const groupKey = (item.barcode && item.barcode.trim()) || item.name.trim().toLowerCase();
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          name: item.name,
          brand: item.brand,
          category: item.category,
          barcode: item.barcode,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          totalStock: 0,
          inStockUnits: [],
          soldUnits: [],
          items: [],
        };
      }

      const qty = Math.max(0, item.stockQuantity);
      groups[groupKey].totalStock += qty;

      if (qty === 0) {
        groups[groupKey].soldUnits.push(item);
        groups[groupKey].items.push(item);
      } else if (qty === 1) {
        groups[groupKey].inStockUnits.push(item);
        groups[groupKey].items.push(item);
      } else {
        // Unpack multi-quantity items into exact individual physical units each with unique SKU
        const unpacked = expandInventoryToIndividualUnits([item]);
        unpacked.forEach((unitItem) => {
          groups[groupKey].inStockUnits.push(unitItem);
          groups[groupKey].items.push(unitItem);
        });
      }
    });

    return Object.values(groups);
  }, [filteredInventory]);

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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                  const loc = shopConfig?.address || 'New Road, Kathmandu, Nepal';
                  const spike = analyzeKeywordForSpike(searchQuery.trim(), loc);
                  if (spike.isSpike && spike.alert) {
                    toast.spikeAlert({
                      keyword: spike.alert.keyword,
                      location: spike.alert.location,
                      surgePercent: spike.alert.surgePercent,
                      searchVolume: spike.alert.searchVolume,
                      category: spike.alert.category,
                      priceRange: spike.alert.priceRange,
                      demandSummary: spike.alert.demandSummary,
                      actionLabel: onOpenMarketScout ? 'Scout Market' : undefined,
                      onAction: onOpenMarketScout,
                    });
                  }
                }
              }}
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

            {onOpenLabelReminders && (
              <button
                type="button"
                onClick={onOpenLabelReminders}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                  pendingLabelRemindersCount > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black animate-pulse'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
                title={`Stickering Reminder Queue: ${pendingLabelRemindersCount} pending (नयाँ तथा पुनः स्टक सामानको मूल्य र बारकोड स्टिकर)`}
              >
                <Tag className="w-4 h-4" />
                <span>Stickering Queue</span>
                {pendingLabelRemindersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 font-mono text-[10px] font-black">
                    {pendingLabelRemindersCount}
                  </span>
                )}
              </button>
            )}

            {onOpenMarketScout && (
              <button
                onClick={onOpenMarketScout}
                className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
                title="AI Market Trends & Sourcing Scout (बजार माग र उत्पादन खोजी)"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
                <span>Market Scout</span>
              </button>
            )}

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

          {/* Right side: View Mode Toggle + Stock Level Filters + Counter */}
          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setViewMode('individual')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  viewMode === 'individual'
                    ? 'bg-slate-900 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="List each physical unit as an individual item with a unique SKU"
              >
                <Tag className="w-3 h-3 text-emerald-400" />
                <span>Individual Units</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-slate-900 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Group units by product model barcode (${totalItemTypes} total item types available in inventory stock)`}
              >
                <Layers className="w-3 h-3 text-amber-400" />
                <span>Grouped ({totalItemTypes} Types)</span>
              </button>
            </div>

            {/* Stock Level Filter Pills */}
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
                onClick={() => setFilterStockStatus('in_stock')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filterStockStatus === 'in_stock'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-100/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>In Stock ({inStockCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterStockStatus('sold')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filterStockStatus === 'sold'
                    ? 'bg-purple-600 text-white font-bold shadow-2xs'
                    : 'text-purple-700 hover:bg-purple-100/60'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>Sold ({soldCount})</span>
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
            </div>

            {/* Results Count Badge */}
            <div className="text-[11px] text-slate-500 font-mono-num whitespace-nowrap">
              {filteredInventory.length === inventory.length ? (
                <span>{inventory.length} units</span>
              ) : (
                <span className="font-semibold text-emerald-800">
                  {filteredInventory.length} of {inventory.length} matched
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Unit Stock Enforcement Banner if grouped items exist */}
      {hasGroupedItems && onConvertAllToIndividualItems && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-indigo-100/70 to-blue-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-indigo-950 text-sm">Convert All Stock to Individual Unique SKUs</div>
              <div className="text-indigo-800 text-xs">
                Some inventory records have batched quantities. Expand them so every physical item in stock gets its own individual unique SKU and scannable barcode for warranty and billing trace.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onConvertAllToIndividualItems}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5"
          >
            <Tag className="w-3.5 h-3.5 text-indigo-200" />
            <span>Generate Individual Unit SKUs</span>
          </button>
        </div>
      )}

      {/* Scanned / Exact SKU or Barcode Match Highlight Card */}
      {exactMatchItem && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-100/60 to-emerald-500/10 rounded-2xl border-2 border-amber-500 shadow-md animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" /> Exact Scanned / Matched Unit
                </span>
                {exactMatchItem.stockQuantity > 0 ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    Available In Stock (1 Unit)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    Sold / Billed Unit
                  </span>
                )}
                <span className="text-xs font-mono font-bold bg-slate-900 text-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-400" />
                  SKU: {exactMatchItem.sku}
                </span>
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>{exactMatchItem.name}</span>
                  <span className="text-xs text-slate-500 font-normal">
                    ({exactMatchItem.brand} • {exactMatchItem.category})
                  </span>
                </h4>
              </div>

              {/* Exact Lifecycle: Date Entered if Available vs Date of Billing & Customer if Sold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-xs">
                {exactMatchItem.stockQuantity > 0 ? (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 shadow-2xs flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-700">Date Entered in Stock</div>
                      <div className="font-bold text-slate-900 text-sm">
                        {exactMatchItem.lastRestockedDate || 'Registered in Inventory'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl bg-white border border-purple-200 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-purple-700">Date of Billing</div>
                        <div className="font-bold text-slate-900 text-sm">
                          {exactMatchSaleInfo?.billingDate || 'Recorded on Invoice'}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-purple-200 shadow-2xs flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-purple-700">Customer Associated</div>
                        <div className="font-bold text-slate-900 text-sm truncate max-w-[170px]" title={exactMatchSaleInfo?.customerName}>
                          {exactMatchSaleInfo?.customerName || 'Retail Customer'}
                          {exactMatchSaleInfo?.customerPhone && (
                            <span className="text-slate-500 font-normal text-xs ml-1">({exactMatchSaleInfo.customerPhone})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {exactMatchSaleInfo?.invoiceNumber && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Invoice Number</div>
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            #{exactMatchSaleInfo.invoiceNumber}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Model Barcode</div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{exactMatchItem.barcode}</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Price & Margin</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {formatNPR(exactMatchItem.sellingPrice)}{' '}
                      <span className="text-[11px] text-emerald-700 font-semibold font-mono">
                        (+{formatNPR(exactMatchItem.sellingPrice - exactMatchItem.costPrice)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions for Scanned Item */}
            <div className="flex sm:flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLabelTargetItem(exactMatchItem);
                  setShowLabelModal(true);
                }}
                className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Unit Barcode Label</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenEdit(exactMatchItem)}
                className="w-full px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Product Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stickering Reminder Alert Banner */}
      {pendingLabelRemindersCount > 0 && onOpenLabelReminders && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 rounded-2xl shadow-sm border border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-950 text-amber-400 rounded-xl shrink-0 font-black shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-950 flex items-center gap-2">
                <span>{pendingLabelRemindersCount} Product(s) Need Labels Printed & Stickered</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black uppercase tracking-wide">
                  Action Required
                </span>
              </h3>
              <p className="text-xs text-slate-900/90 font-medium">
                New or restocked inventory has been registered with unique SKUs, barcodes, and retail selling prices. Print barcode stickers to apply on physical boxes before shelving.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLabelReminders}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-amber-300 rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Stickering Queue</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </button>
        </div>
      )}

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
        {viewMode === 'grouped' && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-700" /> Grouped Catalog View
              </span>
              <span className="font-bold text-slate-800">
                {totalItemTypes} Total Item Types Available in Inventory Stock
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-700 font-semibold">
                {inStockItemTypes} Item Types Currently in Stock
              </span>
            </div>
            <div className="text-[11px] font-mono font-semibold text-slate-500">
              Showing {groupedProducts.length} filtered model types
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          {viewMode === 'grouped' ? (
            /* Grouped by Product Model View */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Model & Brand</th>
                  <th className="p-3">Model Barcode</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-center">Total In Stock</th>
                  <th className="p-3">Individual Unit SKUs (Each Physical Unit)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {groupedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center bg-slate-50/50">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">No products found</p>
                      <p className="text-xs text-slate-500 mt-1">Try resetting filters or searching another model.</p>
                    </td>
                  </tr>
                ) : (
                  groupedProducts.map((grp) => {
                    const profit = grp.sellingPrice - grp.costPrice;
                    const margin = grp.sellingPrice > 0 ? (profit / grp.sellingPrice) * 100 : 0;
                    return (
                      <tr key={grp.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 max-w-xs">
                          <div className="font-bold text-slate-900 text-sm">{grp.name}</div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{grp.brand}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                            {grp.barcode}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                            {grp.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">{formatNPR(grp.costPrice)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(grp.sellingPrice)}</td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono font-bold text-xs ${
                              grp.totalStock > 0 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${grp.totalStock > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                              {grp.totalStock} {grp.totalStock === 1 ? 'Unit' : 'Units'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 tracking-tight">
                              {grp.inStockUnits.length} SKUs in-stock{grp.soldUnits.length > 0 ? ` • ${grp.soldUnits.length} sold` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 max-w-md">
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50/90 rounded-lg border border-slate-200 shadow-inner">
                            {grp.items.map((unit, unitIdx) => {
                              const unitSale = getUnitSaleInfo(unit.sku, unit.id, invoices);
                              const isSold = unit.stockQuantity <= 0 || unitSale?.isSold;
                              return (
                                <button
                                  key={`${unit.id}-${unit.sku}-${unitIdx}`}
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery(unit.sku);
                                    setViewMode('individual');
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                    isSold
                                      ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
                                      : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/60 shadow-2xs'
                                  }`}
                                  title={
                                    isSold
                                      ? `[SOLD UNIT] Sold to ${unitSale?.customerName || 'Customer'} on ${unitSale?.billingDate || 'N/A'} (Inv: ${unitSale?.invoiceNumber || 'N/A'})`
                                      : `[IN-STOCK UNIT #${unitIdx + 1}] SKU: ${unit.sku} • Cost: रु ${unit.costPrice} • Added: ${unit.lastRestockedDate || 'Available'}`
                                  }
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSold ? 'bg-purple-600' : 'bg-emerald-500'}`} />
                                  <span className="truncate">{unit.sku}</span>
                                  {isSold ? (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-sans font-semibold">Sold</span>
                                  ) : (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-sans font-semibold">U{unitIdx + 1}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              if (grp.items[0]) {
                                setLabelTargetItem(grp.items[0]);
                                setShowLabelModal(true);
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 ml-auto shadow-2xs transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Print Labels</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* Individual Unique Unit Registry View (Every physical item listed with unique SKU & status) */
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product & Brand</th>
                  <th className="p-3">Individual Unique SKU & Barcode</th>
                  <th className="p-3">Unit Status & Lifecycle (Entered / Billed)</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right">Profit & Margin</th>
                  <th className="p-3 text-center">Unit Stock</th>
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
                      <p className="font-bold text-slate-800 text-sm">No inventory units found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        No inventory unit records found for &ldquo;<span className="font-semibold text-slate-700">{searchQuery}</span>&rdquo;
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
                  filteredInventory.map((item, itemIdx) => {
                    const profit = item.sellingPrice - item.costPrice;
                    const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0;
                    const isOut = item.stockQuantity <= 0;
                    const isLow = item.stockQuantity <= item.reorderLevel && !isOut;
                    const cleanQ = searchQuery.trim().toLowerCase();
                    const isExactMatch = Boolean(
                      cleanQ && (
                        (item.sku && item.sku.trim().toLowerCase() === cleanQ) ||
                        (item.barcode && item.barcode.trim().toLowerCase() === cleanQ)
                      )
                    );
                    const unitSale = getUnitSaleInfo(item.sku, item.id, invoices);

                    return (
                      <tr
                        key={`${item.id}-${item.sku || 'sku'}-${itemIdx}`}
                        id={`inventory-item-${item.id}`}
                        className={`transition-colors ${
                          isExactMatch
                            ? 'bg-amber-100/90 ring-2 ring-amber-500 shadow-md font-medium'
                            : isOut
                            ? 'bg-rose-50/25 hover:bg-slate-50'
                            : isLow
                            ? 'bg-amber-50/20 hover:bg-slate-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Name & Brand */}
                        <td className="p-3 max-w-xs">
                          {isExactMatch && (
                            <div className="mb-1">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-2xs inline-flex items-center gap-1 animate-bounce">
                                <Sparkles className="w-3 h-3 text-slate-950" /> Exact Scanned Match
                              </span>
                            </div>
                          )}
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

                        {/* Barcode & Unique Unit SKU */}
                        <td className="p-3 text-slate-700 min-w-[210px]">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`font-mono font-bold text-xs tracking-tight px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                                isExactMatch
                                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs'
                                  : 'bg-slate-900 text-amber-300 border-slate-900'
                              }`}>
                                <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{highlightMatch(item.sku, searchQuery)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.sku);
                                  toast.success(`Copied SKU: ${item.sku}`);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                title="Copy Unique SKU"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setLabelTargetItem(item);
                                  setShowLabelModal(true);
                                }}
                                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ml-auto shrink-0"
                                title={`Print physical label for unit ${item.sku}`}
                              >
                                <Printer className="w-3 h-3 text-emerald-600" />
                                <span>Label</span>
                              </button>
                            </div>

                            {/* Inline Scannable Small QR Code */}
                            <div
                              onClick={() => {
                                setLabelTargetItem(item);
                                setShowLabelModal(true);
                              }}
                              className="bg-white p-1.5 rounded-lg border border-slate-200 hover:border-emerald-500 transition-colors cursor-pointer flex items-center gap-2 shadow-2xs group hover:bg-emerald-50/20"
                              title="Click to preview & print physical SKU QR label"
                            >
                              <div className="p-0.5 bg-white rounded border border-slate-100 shadow-2xs shrink-0 group-hover:border-emerald-300">
                                <SkuQrCode
                                  value={item.sku}
                                  size={36}
                                  margin={0}
                                  className="block"
                                  title={`SKU: ${item.sku}`}
                                />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400 font-mono text-[9px] truncate">Model: {highlightMatch(item.barcode, searchQuery)}</span>
                                  <span className="text-emerald-700 font-bold text-[9px] bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60">QR SKU</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5 group-hover:text-emerald-800">
                                  Instant Scan & Print
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Unit Status & Lifecycle (Entered Date vs Billing Date & Customer) */}
                        <td className="p-3 min-w-[190px]">
                          {item.stockQuantity > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                In Stock (Unit #1)
                              </span>
                              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  Entered:{' '}
                                  <span className="font-bold text-slate-900">
                                    {item.lastRestockedDate || 'Available in Stock'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[11px] w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                                Sold / Billed Unit
                              </span>
                              {unitSale ? (
                                <div className="text-[11px] space-y-0.5 mt-0.5">
                                  <div className="text-slate-600 flex items-center gap-1">
                                    <Receipt className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>
                                      Billed: <span className="font-bold text-slate-900">{unitSale.billingDate}</span>
                                    </span>
                                  </div>
                                  <div className="text-slate-600 flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span className="truncate max-w-[140px] font-medium text-slate-900" title={unitSale.customerName}>
                                      {unitSale.customerName}
                                      {unitSale.customerPhone && (
                                        <span className="text-slate-500 font-normal"> ({unitSale.customerPhone})</span>
                                      )}
                                    </span>
                                  </div>
                                  {unitSale.invoiceNumber && (
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      Inv #{unitSale.invoiceNumber}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400">Sold (Out of stock)</div>
                              )}
                            </div>
                          )}
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
                            {item.stockQuantity > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                                1 Unit
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                                0 (Sold)
                              </span>
                            )}
                          </div>
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
                              title={`Print physical stock label for unit ${item.sku}`}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleQuickRestock(item, 1)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                              title="Add +1 unit"
                            >
                              +1
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
                                if (confirm(`Delete unit "${item.name}" (${item.sku}) from inventory?`)) {
                                  onDeleteItem(item.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete unit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{editingItem ? 'Edit Phone / Gadget Item' : 'Add New Inventory Item'}</span>
                {editingItem && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Existing Item Auto-filled
                  </span>
                )}
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
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                      title="Scan barcode with camera or laser scanner (auto-checks existing items)"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-semibold text-emerald-700 hover:text-emerald-900">Scan Barcode</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="195949012345"
                      value={barcodeVal}
                      onChange={(e) => setBarcodeVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCheckAndProcessBarcode(barcodeVal);
                        }
                      }}
                      className="w-full pl-2.5 pr-9 py-1.5 border border-slate-200 rounded-lg font-mono-num text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeCaptureScanner(true)}
                      className="absolute right-1 p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Open scanner camera to fill barcode"
                    >
                      <Camera className="w-4 h-4 text-emerald-700 hover:text-emerald-900 transition-colors" />
                    </button>
                  </div>

                  {/* Inline Notice if typed code matches an existing inventory item */}
                  {(() => {
                    const clean = barcodeVal.trim();
                    if (!clean) return null;
                    const matched = inventory.find(
                      (i) =>
                        (!editingItem || i.id !== editingItem.id) &&
                        ((i.barcode && i.barcode.toLowerCase() === clean.toLowerCase()) ||
                         (i.sku && i.sku.toLowerCase() === clean.toLowerCase()))
                    );
                    if (!matched) return null;
                    return (
                      <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2 animate-fadeIn">
                        <div className="text-[11px] text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Matches: <strong>{matched.name}</strong> ({matched.stockQuantity} in stock)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCheckAndProcessBarcode(matched.barcode || matched.sku)}
                          className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
                        >
                          Autofill & Options
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Unique SKU & Labeling Checker (Single & Batch Modes) */}
                <SkuLabelChecker
                  sku={sku}
                  onChangeSku={setSku}
                  barcode={barcodeVal}
                  brand={brand}
                  category={category}
                  name={name}
                  inventory={inventory}
                  currentItemId={editingItem?.id}
                  isEditing={!!editingItem}
                  batchMode={batchMode}
                  onToggleBatchMode={setBatchMode}
                  batchQuantity={batchQuantity}
                  onChangeBatchQuantity={setBatchQuantity}
                  batchSkus={batchSkus}
                  onUpdateBatchSkus={setBatchSkus}
                />
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
            setShowBarcodeCaptureScanner(false);
            handleCheckAndProcessBarcode(scannedCode);
          }}
          inventory={inventory}
          title="Scan Product Barcode"
          subtitle="Scan with camera, USB laser gun, or quick test to check inventory or fill barcode"
          zIndexClass="z-[75]"
        />
      )}

      {/* Regarding Popup Modal when Scanned/Checked Barcode Matches Existing Item */}
      {matchedProductPopup && (
        <ExistingProductMatchModal
          isOpen={Boolean(matchedProductPopup)}
          onClose={() => setMatchedProductPopup(null)}
          item={matchedProductPopup}
          scannedCode={matchedScanCode}
          onRestock={(qty) => {
            handleQuickRestock(matchedProductPopup, qty);
            setShowAddModal(false);
          }}
          onOpenFullRestock={() => {
            setMatchedProductPopup(null);
            setShowAddModal(false);
            onOpenRestock?.(matchedProductPopup);
          }}
          onProcessReturn={() => {
            setMatchedProductPopup(null);
            setShowAddModal(false);
            onOpenReturn?.(matchedProductPopup, matchedScanCode);
          }}
          onContinueEditing={() => {
            setMatchedProductPopup(null);
          }}
        />
      )}
    </div>
  );
}
