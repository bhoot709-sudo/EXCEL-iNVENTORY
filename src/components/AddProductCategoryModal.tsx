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
  Trash2
} from 'lucide-react';
import { InventoryItem, ProductCategory } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onAddProduct: (item: InventoryItem) => void;
  onOpenScanner?: () => void;
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
  onOpenScanner,
}: Props) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'product' | 'categories'>('product');

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

  // Auto-generate SKU & Barcode helper
  const handleAutoGenerateCodes = () => {
    const brandPrefix = (brand.trim() || 'GAD').slice(0, 3).toUpperCase();
    const namePrefix = (name.trim() || 'PROD').slice(0, 3).toUpperCase();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setSku(`${brandPrefix}-${namePrefix}-${randNum}`);

    // Generate 12-digit UPC/EAN style barcode
    const genBarcode = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    setBarcode(genBarcode);
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

    const finalBarcode = barcode.trim() || `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    const finalSku = sku.trim() || `${brand.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

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
    toast.success(`Product "${newItem.name}" added to catalog & synchronized!`, 'Product Created');
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">SKU Code</label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateCodes}
                      className="text-[11px] text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. APL-16PM-256-TI"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Barcode / EAN</label>
                    {onOpenScanner && (
                      <button
                        type="button"
                        onClick={onOpenScanner}
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold"
                      >
                        Scan Gun / Camera
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 195949012345"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
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
    </div>
  );
}
