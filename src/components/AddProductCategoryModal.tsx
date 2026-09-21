import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Tag, 
  FolderPlus, 
  Sparkles, 
  Barcode, 
  DollarSign, 
  Percent, 
  ShieldCheck, 
  X, 
  Check, 
  Package, 
  Layers,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Wand2,
  RefreshCw,
  Info
} from 'lucide-react';
import { InventoryItem, ProductCategory, ActionLog, ActionCategory, LabelPrintReminder } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { useToast } from './Toast';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ExistingProductMatchModal } from './ExistingProductMatchModal';
import { 
  generateUniqueSku, 
  generateUniqueBarcode, 
  validateSkuUniqueness,
  validateSkuRealTime,
  getSkuSuggestions,
  isValidSkuPattern
} from '../utils/skuGenerator';
import { SkuLabelChecker } from './SkuLabelChecker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onAddProduct: (item: InventoryItem) => void;
  onAddBatchProducts?: (items: InventoryItem[]) => void;
  onUpdateProduct?: (item: InventoryItem) => void;
  onOpenRestock?: (item: InventoryItem) => void;
  onOpenReturn?: (item: InventoryItem) => void;
  onOpenScanner?: () => void;
  onAddLabelReminder?: (reminder: Partial<LabelPrintReminder>) => void;
  onLogAction?: (entry: {
    category: ActionCategory;
    actionTitle: string;
    description: string;
    staffName?: string;
    source: ActionLog['source'];
    status?: 'SUCCESS' | 'PENDING' | 'CANCELLED';
    metadata?: Record<string, any>;
  }) => void;
}

const DEFAULT_CATEGORIES: string[] = [
  'Smartphones',
  'Tablets',
  'Audio',
  'Wearables',
  'Chargers & Power',
  'Protection & Cases',
  'Cables & Adapters',
];

export function AddProductCategoryModal({
  isOpen,
  onClose,
  inventory,
  onAddProduct,
  onAddBatchProducts,
  onUpdateProduct,
  onOpenRestock,
  onOpenReturn,
  onOpenScanner,
  onAddLabelReminder,
  onLogAction,
}: Props) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'product' | 'categories'>('product');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [matchedProductPopup, setMatchedProductPopup] = useState<InventoryItem | null>(null);
  const [matchedScanCode, setMatchedScanCode] = useState<string>('');

  // Batch Item Tracking State
  const [batchMode, setBatchMode] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState(5);
  const [batchSkus, setBatchSkus] = useState<string[]>([]);

  // Dynamic Categories gathered from inventory + defaults
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('gadget_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [newCategoryInput, setNewCategoryInput] = useState('');

  // All unique active categories
  const allCategories = useMemo(() => {
    const catSet = new Set<string>(DEFAULT_CATEGORIES);
    customCategories.forEach((c) => catSet.add(c));
    inventory.forEach((item) => {
      if (item.category) catSet.add(item.category);
    });
    return Array.from(catSet);
  }, [customCategories, inventory]);

  // New Product Form States
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<string>('Smartphones');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [reorderLevel, setReorderLevel] = useState('3');
  const [imeiRequired, setImeiRequired] = useState(false);
  const [supplier, setSupplier] = useState('');

  // Calculate Profit and Margin Preview
  const costNum = parseFloat(costPrice) || 0;
  const sellNum = parseFloat(sellingPrice) || 0;
  const profitPerUnit = sellNum - costNum;
  const marginPercent = sellNum > 0 ? (profitPerUnit / sellNum) * 100 : 0;

  // Real-time SKU format and uniqueness validation
  const skuValidation = useMemo(() => {
    return validateSkuRealTime(sku, undefined, inventory);
  }, [sku, inventory]);

  // Suggested unique SKU presets based on brand, category, and name
  const skuSuggestions = useMemo(() => {
    return getSkuSuggestions(brand || 'Gadget', category, name || 'Item', inventory);
  }, [brand, category, name, inventory]);

  // Auto-generate SKU & Barcode helper
  const handleAutoGenerateCodes = () => {
    const genSku = generateUniqueSku(brand || 'Gadget', category, name || 'Item', inventory, { style: 'smart' });
    setSku(genSku);

    // Generate unique EAN/UPC style barcode
    const genBarcode = generateUniqueBarcode(inventory);
    setBarcode(genBarcode);
    toast.success(`Generated unique SKU: ${genSku} & Barcode: ${genBarcode}`);
  };

  // Check QR or barcode with all inventory items, auto-fill, and ask restock/return popup
  const handleCheckAndProcessBarcode = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    const matched = inventory.find(
      (i) =>
        (i.barcode && i.barcode.trim().toLowerCase() === clean.toLowerCase()) ||
        (i.sku && i.sku.trim().toLowerCase() === clean.toLowerCase())
    );

    if (matched) {
      setName(matched.name);
      setBrand(matched.brand);
      setCategory(matched.category);
      setCostPrice(matched.costPrice.toString());
      setSellingPrice(matched.sellingPrice.toString());
      setStockQuantity(matched.stockQuantity.toString());
      setReorderLevel(matched.reorderLevel.toString());
      setSupplier(matched.supplier || '');
      setSku(matched.sku);
      setBarcode(matched.barcode);
      setImeiRequired(Boolean(matched.imeiRequired));

      setMatchedScanCode(clean);
      setMatchedProductPopup(matched);
      toast.info(`Found existing item "${matched.name}". Details auto-filled.`, 'Catalog Match');
    } else {
      setBarcode(clean);
      toast.success(`Barcode "${clean}" recorded.`, 'Barcode Scanned');
    }
  };

  // Add Custom Category handler
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    if (allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.warning(`Category "${trimmed}" already exists.`);
      return;
    }

    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    localStorage.setItem('gadget_custom_categories', JSON.stringify(updated));
    setCategory(trimmed);
    setNewCategoryInput('');
    toast.success(`Added new category "${trimmed}".`, 'Category Added');

    if (onLogAction) {
      onLogAction({
        category: 'CATEGORY',
        actionTitle: `Created Category: ${trimmed}`,
        description: `Registered new product category "${trimmed}" in inventory catalog.`,
        source: 'PRODUCT_MODAL',
        metadata: { categoryName: trimmed },
      });
    }
  };

  // Submit Product Form
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brand.trim()) {
      toast.warning('Please provide at least a Product Name and Brand.');
      return;
    }

    if (sellNum <= 0) {
      toast.warning('Selling price must be greater than 0.');
      return;
    }

    const finalBarcode = barcode.trim() || generateUniqueBarcode(inventory);

    // BATCH MODE: Add multiple individual unit items of same product with same barcode
    if (batchMode && batchSkus.length > 0) {
      const existingSkuSet = new Set(inventory.map((i) => i.sku.trim().toLowerCase()));
      for (const bSku of batchSkus) {
        if (existingSkuSet.has(bSku.trim().toLowerCase())) {
          toast.error(`Duplicate SKU in batch: "${bSku}". Please click Regenerate to get fresh unique SKUs.`, 'Duplicate SKU');
          return;
        }
      }

      const createdItems: InventoryItem[] = batchSkus.map((bSku, idx) => ({
        id: `prod-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        sku: bSku.toUpperCase(),
        barcode: finalBarcode,
        name: name.trim(),
        brand: brand.trim(),
        category: category as ProductCategory,
        costPrice: costNum,
        sellingPrice: sellNum,
        stockQuantity: 1, // each individual unit
        reorderLevel: 1,
        imeiRequired,
        supplier: supplier.trim() || 'Wholesale Distributor',
        lastRestockedDate: new Date().toISOString().split('T')[0],
      }));

      if (onAddBatchProducts) {
        onAddBatchProducts(createdItems);
      } else {
        createdItems.forEach((item) => onAddProduct(item));
      }

      toast.success(
        `Added batch of ${createdItems.length} units of "${createdItems[0]?.name}" with unique SKUs and shared barcode!`,
        'Batch Registered'
      );
      onClose();
      return;
    }

    // SINGLE ITEM MODE
    const finalSku = (sku.trim() || generateUniqueSku(brand, category, name, inventory)).toUpperCase();

    // Validate SKU uniqueness
    const skuValidation = validateSkuUniqueness(finalSku, undefined, inventory);
    if (!skuValidation.isValid) {
      toast.error(skuValidation.error || 'Duplicate SKU detected!', 'SKU Conflict');
      return;
    }

    // Shared barcode notification (same product model or batch)
    if (finalBarcode) {
      const duplicateBarcode = inventory.find(
        (i) => i.barcode && i.barcode.toLowerCase() === finalBarcode.toLowerCase()
      );
      if (duplicateBarcode) {
        toast.info(
          `Product shares barcode "${finalBarcode}" with "${duplicateBarcode.name}". Unique SKU "${finalSku}" guarantees distinct inventory tracking.`,
          'Shared Barcode'
        );
      }
    }

    const newItem: InventoryItem = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sku: finalSku,
      barcode: finalBarcode,
      name: name.trim(),
      brand: brand.trim(),
      category: category as ProductCategory,
      costPrice: costNum,
      sellingPrice: sellNum,
      stockQuantity: parseInt(stockQuantity) || 0,
      reorderLevel: parseInt(reorderLevel) || 3,
      imeiRequired,
      supplier: supplier.trim() || 'Wholesale Distributor',
      lastRestockedDate: new Date().toISOString().split('T')[0],
    };

    onAddProduct(newItem);

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

    toast.success(`Product "${newItem.name}" added! 🏷️ Labels queued for printing & stickering.`, 'Product Created');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">New Product & Category Manager</h3>
                <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-200">
                  Daily Routine Task
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Register new inventory items, generate barcodes, and organize product categories.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Add Product vs Manage Categories */}
        <div className="px-6 pt-3 border-b border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('product')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'product'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>+ Add New Product</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Categories ({allCategories.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'product' ? (
            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {/* Product Name & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apple iPhone 16 Pro Max (256GB, Desert Titanium)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Brand / Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apple, Samsung, Anker, Sony"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Category
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                    >
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setActiveTab('categories')}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                      title="Add custom category"
                    >
                      + New
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing & Profit Margin Preview */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Wholesale Cost (रु)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 150000"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Retail Selling Price (रु) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="e.g. 175000"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold text-emerald-800 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Live Margin Calculation */}
                <div className="flex items-center justify-between text-xs px-2 py-1 bg-white rounded-lg border border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Percent className="w-3.5 h-3.5 text-violet-600" />
                    <span>Unit Margin:</span>
                    <span className={`font-mono font-bold ${profitPerUnit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {marginPercent.toFixed(1)}% ({formatNPR(profitPerUnit)} profit)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Calculated on Selling Price</span>
                </div>
              </div>

              {/* Inventory Stock & Thresholds */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reorder Alert
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="Wholesale Importer"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* SKU & Barcode Generator */}
              <div className="space-y-3 pt-1">
                {/* SKU Code Input with Labeling Checker (Single & Batch Modes) */}
                <SkuLabelChecker
                  sku={sku}
                  onChangeSku={setSku}
                  barcode={barcode}
                  brand={brand}
                  category={category}
                  name={name}
                  inventory={inventory}
                  batchMode={batchMode}
                  onToggleBatchMode={setBatchMode}
                  batchQuantity={batchQuantity}
                  onChangeBatchQuantity={setBatchQuantity}
                  batchSkus={batchSkus}
                  onUpdateBatchSkus={setBatchSkus}
                />

                {/* Barcode / EAN Scanner Input */}
                <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Barcode / EAN (Optical Code)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Scan Camera</span>
                      </button>
                      {onOpenScanner && (
                        <button
                          type="button"
                          onClick={onOpenScanner}
                          className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold"
                        >
                          Gun Scanner
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="e.g. 195949012345 (Enter to check catalog)"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCheckAndProcessBarcode(barcode);
                        }
                      }}
                      className="w-full px-3 py-2 pr-9 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeScanner(true)}
                      className="absolute right-2 p-1 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                      title="Scan barcode with camera"
                    >
                      <Camera className="w-4 h-4 text-emerald-700" />
                    </button>
                  </div>

                  {/* Inline Notice if code matches an existing inventory item */}
                  {(() => {
                    const clean = barcode.trim();
                    if (!clean) return null;
                    const matched = inventory.find(
                      (i) =>
                        (i.barcode && i.barcode.toLowerCase() === clean.toLowerCase()) ||
                        (i.sku && i.sku.toLowerCase() === clean.toLowerCase())
                    );
                    if (!matched) return null;
                    return (
                      <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2 animate-fadeIn">
                        <div className="text-[11px] text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Catalog Match: <strong>{matched.name}</strong> ({matched.stockQuantity} in stock)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCheckAndProcessBarcode(matched.barcode || matched.sku)}
                          className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
                        >
                          Autofill & Options
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Serial / IMEI Checkbox */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="imeiToggle"
                  checked={imeiRequired}
                  onChange={(e) => setImeiRequired(e.target.checked)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                />
                <label htmlFor="imeiToggle" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold block text-slate-900">Require IMEI / Serial Number Tracking</span>
                  <span className="text-[11px] text-slate-500">
                    Mandatory for smartphones, tablets, and high-value serialized electronics.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save & Add Product to Inventory</span>
                </button>
              </div>
            </form>
          ) : (
            /* Tab 2: Category Management */
            <div className="space-y-5">
              {/* New Category Input */}
              <form onSubmit={handleCreateCategory} className="p-4 bg-violet-50/70 border border-violet-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-violet-950">Add New Product Category</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Used Phones, Screen Guards, Smart Home, Drones..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Category</span>
                  </button>
                </div>
              </form>

              {/* Active Categories List */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Current Product Categories ({allCategories.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allCategories.map((cat) => {
                    const count = inventory.filter((i) => i.category === cat).length;
                    const isCustom = customCategories.includes(cat);

                    return (
                      <div
                        key={cat}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                          <span className="text-xs font-bold text-slate-800">{cat}</span>
                          {isCustom && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium">
                              Custom
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Total active products: <strong className="text-slate-800">{inventory.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Barcode Camera Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScannerModal
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onBarcodeDetected={(scannedCode) => {
            setShowBarcodeScanner(false);
            handleCheckAndProcessBarcode(scannedCode);
          }}
          inventory={inventory}
          title="Scan Product Barcode"
          subtitle="Scan with camera to check catalog, autofill details, or register a new barcode"
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
            if (onUpdateProduct) {
              onUpdateProduct({
                ...matchedProductPopup,
                stockQuantity: matchedProductPopup.stockQuantity + qty,
                lastRestockedDate: new Date().toISOString().split('T')[0],
              });
              toast.success(`Restocked +${qty} units of "${matchedProductPopup.name}".`);
            }
            onClose();
          }}
          onOpenFullRestock={() => {
            setMatchedProductPopup(null);
            onClose();
            onOpenRestock?.(matchedProductPopup);
          }}
          onProcessReturn={() => {
            setMatchedProductPopup(null);
            onClose();
            onOpenReturn?.(matchedProductPopup);
          }}
          onContinueEditing={() => {
            setMatchedProductPopup(null);
          }}
        />
      )}
    </div>
  );
}
