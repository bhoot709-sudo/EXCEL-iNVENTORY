import React, { useState, useMemo } from 'react';
import { 
  PackagePlus, 
  Search, 
  AlertTriangle, 
  Check, 
  X, 
  ArrowRight, 
  Boxes, 
  TrendingUp, 
  History, 
  Plus, 
  Minus,
  Sparkles,
  Barcode
} from 'lucide-react';
import { InventoryItem } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onRestockItem: (itemId: string, additionalQuantity: number, newCostPrice?: number, supplier?: string) => void;
  onBatchRestock?: (restocks: Array<{ itemId: string; quantity: number; costPrice?: number }>) => void;
}

export function QuickRestockModal({
  isOpen,
  onClose,
  inventory,
  onRestockItem,
}: Props) {
  const toast = useToast();
  const [filterMode, setFilterMode] = useState<'low-stock' | 'all'>('low-stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Form states for active item being restocked
  const [addQty, setAddQty] = useState<number>(5);
  const [costPrice, setCostPrice] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [restockNote, setRestockNote] = useState<string>('');

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => item.stockQuantity <= item.reorderLevel);
  }, [inventory]);

  const displayedItems = useMemo(() => {
    let list = filterMode === 'low-stock' ? lowStockItems : inventory;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.barcode.includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filterMode, lowStockItems, inventory, searchQuery]);

  const activeItem = useMemo(() => {
    if (!selectedItemId) {
      return displayedItems.length > 0 ? displayedItems[0] : null;
    }
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [selectedItemId, displayedItems, inventory]);

  // Sync selected item fields when active item changes
  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setCostPrice(item.costPrice.toString());
    setSupplierName(item.supplier || '');
    setAddQty(5);
  };

  const handleApplyRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    if (addQty <= 0) {
      toast.warning('Please enter a restock quantity greater than 0.');
      return;
    }

    const updatedCost = costPrice ? parseFloat(costPrice) : undefined;
    onRestockItem(activeItem.id, addQty, updatedCost, supplierName.trim() || undefined);
    
    toast.success(
      `Restocked +${addQty} units for ${activeItem.name}. New Stock: ${activeItem.stockQuantity + addQty}`,
      'Inventory Restocked'
    );

    // If there are other low stock items, advance to next, or finish
    const remaining = lowStockItems.filter((i) => i.id !== activeItem.id);
    if (remaining.length > 0) {
      handleSelectItem(remaining[0]);
    } else {
      setSelectedItemId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Quick Stock Restock</h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                  Daily Routine Task
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Replenish inventory stock, update wholesale cost prices, and clear low stock alerts.
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

        {/* Content Split: Left items list, Right restock form */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Column: Product Selection & Low Stock Filter */}
          <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col min-h-0 bg-slate-50/30">
            {/* Filter Tabs & Search */}
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMode('low-stock')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'low-stock'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Stock ({lowStockItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>All Catalog ({inventory.length})</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search item by name, barcode, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {displayedItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Check className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700">No Low Stock Items Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {filterMode === 'low-stock'
                      ? 'All inventory items are currently above their reorder thresholds.'
                      : 'No items matching your search query.'}
                  </p>
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isSelected = activeItem?.id === item.id;
                  const isLow = item.stockQuantity <= item.reorderLevel;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white hover:bg-slate-100/80 border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-mono text-slate-600 font-semibold">{item.sku}</span>
                          <span>•</span>
                          <span>{item.brand}</span>
                          <span>•</span>
                          <span className="font-mono font-medium">{formatNPR(item.costPrice)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold inline-block ${
                          item.stockQuantity === 0
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.stockQuantity} in stock
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Threshold: {item.reorderLevel}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Restock Input Form */}
          <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
            {activeItem ? (
              <form onSubmit={handleApplyRestock} className="space-y-5">
                {/* Active Item Overview Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Selected Product
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                      {activeItem.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="font-mono text-slate-700 font-semibold">{activeItem.sku}</span>
                      <span>•</span>
                      <span>{activeItem.brand}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 bg-slate-200/60 rounded text-[10px] text-slate-700">
                        {activeItem.category}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Current Stock</span>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {activeItem.stockQuantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Restock Qty</span>
                      <span className="font-mono font-bold text-sm text-blue-600">
                        +{addQty}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">New Total</span>
                      <span className="font-mono font-bold text-sm text-emerald-700">
                        {activeItem.stockQuantity + addQty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Restock Quantity Input & Quick Preset Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Units to Add to Stock
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAddQty((q) => Math.max(1, q - 1))}
                      className="p-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-mono font-bold text-base py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setAddQty((q) => q + 1)}
                      className="p-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Chips */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {[5, 10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddQty(preset)}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors ${
                          addQty === preset
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purchase Cost & Supplier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Purchase Cost (रु)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Wholesale unit cost"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier / Vendor
                    </label>
                    <input
                      type="text"
                      placeholder="Wholesale distributor"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Restock Summary Calculation */}
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Estimated Wholesale Value:</span>
                  <span className="font-mono font-bold text-blue-900">
                    {formatNPR((costPrice ? parseFloat(costPrice) : activeItem.costPrice) * addQty)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm Restock (+{addQty} units)</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Boxes className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-600">Select a Product to Restock</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Choose an item from the left column to replenish its stock count and update wholesale records.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {lowStockItems.length} low-stock alerts currently pending in catalog
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
