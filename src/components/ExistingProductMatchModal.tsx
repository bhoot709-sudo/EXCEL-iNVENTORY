import React, { useState } from 'react';
import { 
  CheckCircle2, 
  PackagePlus, 
  RotateCcw, 
  Edit3, 
  X, 
  Tag, 
  Barcode, 
  Smartphone, 
  Check, 
  ArrowRight,
  TrendingUp,
  Layers
} from 'lucide-react';
import { InventoryItem } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { Code128Barcode } from './Code128Barcode';

export interface ExistingProductMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
  scannedCode?: string;
  onRestock: (qty: number) => void;
  onOpenFullRestock?: () => void;
  onProcessReturn: () => void;
  onContinueEditing: () => void;
}

export function ExistingProductMatchModal({
  isOpen,
  onClose,
  item,
  scannedCode,
  onRestock,
  onOpenFullRestock,
  onProcessReturn,
  onContinueEditing,
}: ExistingProductMatchModalProps) {
  const [customQty, setCustomQty] = useState<number>(5);
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);

  if (!isOpen) return null;

  const handleQuickRestockClick = (qty: number) => {
    setIsRestocking(true);
    onRestock(qty);
    setRestockSuccess(true);
    setTimeout(() => {
      setIsRestocking(false);
      setRestockSuccess(false);
      onClose();
    }, 1200);
  };

  const isLowStock = item.stockQuantity <= item.reorderLevel;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        id="existing-product-match-modal"
        className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-emerald-200 overflow-hidden flex flex-col my-auto relative"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header Badge */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                Catalog Match Found
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {scannedCode || item.barcode}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Product Already Exists in Inventory
            </h3>
            <p className="text-xs text-slate-500">
              Details auto-filled into the form. Choose an action below:
            </p>
          </div>
        </div>

        {/* Matched Product Overview Card */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className="font-bold text-slate-800 uppercase">{item.brand}</span>
                <span>•</span>
                <span>{item.category}</span>
                <span>•</span>
                <span className="font-mono">SKU: {item.sku}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight mt-0.5">
                {item.name}
              </h4>
            </div>

            {item.barcode && (
              <div className="bg-white p-1 rounded-lg border border-slate-200 shrink-0 text-center shadow-2xs">
                <Code128Barcode value={item.barcode} width={1.2} height={26} fontSize={9} />
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-center">
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Current Stock</span>
              <span className={`text-xs font-black font-mono-num ${isLowStock ? 'text-amber-600' : 'text-emerald-700'}`}>
                {item.stockQuantity} units
              </span>
            </div>

            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Selling Price</span>
              <span className="text-xs font-black font-mono-num text-slate-900">
                रु {formatNPR(item.sellingPrice)}
              </span>
            </div>

            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Wholesale Cost</span>
              <span className="text-xs font-semibold font-mono-num text-slate-700">
                रु {formatNPR(item.costPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Action Cards: Restock vs Return */}
        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Select Desired Action:
          </label>

          {/* Action 1: Restock Product */}
          <div className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">
                    Restock Product (+ Add Stock)
                  </h5>
                  <p className="text-[11px] text-slate-600">
                    Receive fresh inventory batch to increase store shelf count.
                  </p>
                </div>
              </div>
              {onOpenFullRestock && (
                <button
                  type="button"
                  onClick={onOpenFullRestock}
                  className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer"
                >
                  Full Console
                </button>
              )}
            </div>

            {/* Quick Restock Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-600 font-medium">Quick Add:</span>
              {[5, 10, 20, 50].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  disabled={isRestocking}
                  onClick={() => handleQuickRestockClick(qty)}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold font-mono transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  +{qty}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min="1"
                  value={customQty}
                  onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 px-1.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-center"
                />
                <button
                  type="button"
                  disabled={isRestocking}
                  onClick={() => handleQuickRestockClick(customQty)}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {restockSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <span>Add</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action 2: Process Return / RMA */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/20 transition-all flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">
                  Process Return / Exchange (फिर्ता / सट्टा)
                </h5>
                <p className="text-[11px] text-slate-500">
                  Record customer return, refund invoice, warranty defect, or restocking to shelves.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onProcessReturn}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              <span>Process Return</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action 3: Continue Editing In Form */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onContinueEditing}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Continue Editing Form Details</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
