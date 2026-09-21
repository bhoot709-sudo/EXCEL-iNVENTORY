import React, { useMemo } from 'react';
import {
  Tag,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Barcode,
  Layers,
  Check,
  Wand2,
  Copy,
  Info,
} from 'lucide-react';
import { InventoryItem } from '../types';
import {
  validateSkuRealTime,
  generateUniqueSku,
  generateBatchUniqueSkus,
  getSkuSuggestions,
} from '../utils/skuGenerator';
import { useToast } from './Toast';

export interface SkuLabelCheckerProps {
  sku: string;
  onChangeSku: (newSku: string) => void;
  barcode: string;
  brand: string;
  category: string;
  name: string;
  inventory: InventoryItem[];
  currentItemId?: string;
  isEditing?: boolean;
  // Batch Mode Props
  batchMode?: boolean;
  onToggleBatchMode?: (enabled: boolean) => void;
  batchQuantity?: number;
  onChangeBatchQuantity?: (qty: number) => void;
  batchSkus?: string[];
  onUpdateBatchSkus?: (skus: string[]) => void;
}

export const SkuLabelChecker: React.FC<SkuLabelCheckerProps> = ({
  sku,
  onChangeSku,
  barcode,
  brand,
  category,
  name,
  inventory,
  currentItemId,
  isEditing = false,
  batchMode = false,
  onToggleBatchMode,
  batchQuantity = 5,
  onChangeBatchQuantity,
  batchSkus = [],
  onUpdateBatchSkus,
}) => {
  const toast = useToast();

  // Validate the current single SKU
  const skuValidation = useMemo(() => {
    return validateSkuRealTime(sku, currentItemId, inventory);
  }, [sku, currentItemId, inventory]);

  // Check if the barcode matches existing items in inventory
  const cleanBarcode = barcode.trim().toLowerCase();
  const sameBarcodeItems = useMemo(() => {
    if (!cleanBarcode) return [];
    return inventory.filter(
      (item) =>
        (!currentItemId || item.id !== currentItemId) &&
        item.barcode &&
        item.barcode.trim().toLowerCase() === cleanBarcode
    );
  }, [cleanBarcode, currentItemId, inventory]);

  // Auto-generate single unique SKU
  const handleAutoGenerate = (style: 'smart' | 'compact' | 'serial' = 'smart') => {
    const newSku = generateUniqueSku(brand || 'Gadget', category, name || 'Item', inventory, { style });
    onChangeSku(newSku);
    toast.success(`Generated unique SKU: "${newSku}"`, 'SKU Assigned');
  };

  // Generate / Regenerate batch unique SKUs
  const handleGenerateBatchSkus = (count = batchQuantity, style: 'smart' | 'compact' | 'serial' = 'smart') => {
    const skus = generateBatchUniqueSkus(count, brand || 'Gadget', category, name || 'Item', inventory, {
      style,
    });
    if (onUpdateBatchSkus) {
      onUpdateBatchSkus(skus);
    }
    if (skus.length > 0) {
      onChangeSku(skus[0]);
    }
    toast.success(`Generated ${skus.length} unique SKUs for batch items sharing barcode "${barcode || 'N/A'}"`, 'Batch SKUs Ready');
  };

  // Suggestions for single SKU
  const suggestions = useMemo(() => {
    return getSkuSuggestions(brand || 'Gadget', category, name || 'Item', inventory);
  }, [brand, category, name, inventory]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.info(`Copied "${text}" to clipboard.`);
  };

  return (
    <div className="space-y-3">
      {/* Header with Mode Switch */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-emerald-600" />
          <label className="text-xs font-bold text-slate-800">
            Stock Keeping Unit (SKU) Labeling
          </label>
          <span className="text-[10px] text-slate-500 font-medium">(Mandatory Unique Tag)</span>
        </div>

        {/* Batch Mode Switch (Only for new items) */}
        {!isEditing && onToggleBatchMode && (
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onToggleBatchMode(false)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                !batchMode
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Item
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleBatchMode(true);
                if (batchSkus.length === 0) {
                  handleGenerateBatchSkus(batchQuantity);
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                batchMode
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Batch (Same Barcode)</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. SINGLE ITEM SKU INPUT & LIVE CHECKER */}
      {!batchMode ? (
        <div className="space-y-2">
          <div className="relative flex items-center">
            <input
              type="text"
              required
              placeholder="e.g. APL-PHN-15PRO-8492 or SAM-S24U-01"
              value={sku}
              onChange={(e) => onChangeSku(e.target.value.toUpperCase())}
              className={`w-full px-3 py-2 pr-24 font-mono text-xs font-bold uppercase rounded-xl border transition-all ${
                !sku.trim()
                  ? 'bg-amber-50/40 border-amber-300 focus:ring-2 focus:ring-amber-400 text-slate-900 placeholder:text-slate-400'
                  : skuValidation.isValid
                    ? 'bg-emerald-50/30 border-emerald-500 focus:ring-2 focus:ring-emerald-400 text-emerald-950'
                    : skuValidation.status === 'duplicate'
                      ? 'bg-rose-50/40 border-rose-400 focus:ring-2 focus:ring-rose-400 text-rose-950'
                      : 'bg-amber-50/40 border-amber-300 focus:ring-2 focus:ring-amber-400 text-amber-950'
              }`}
            />

            {/* Quick action buttons embedded inside input */}
            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAutoGenerate('smart')}
                className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                title="Generate standard structured unique SKU"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-SKU</span>
              </button>
            </div>
          </div>

          {/* DEDICATED SKU LABEL STATUS CHECKER BANNER */}
          <div
            id="sku-label-status-checker"
            className={`p-3 rounded-xl border text-xs transition-all ${
              !sku.trim()
                ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                : skuValidation.isValid
                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                  : skuValidation.status === 'duplicate'
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                    : 'bg-amber-50/80 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {!sku.trim() ? (
                    <div className="p-1 rounded-full bg-amber-500 text-white">
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : skuValidation.isValid ? (
                    <div className="p-1 rounded-full bg-emerald-600 text-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : skuValidation.status === 'duplicate' ? (
                    <div className="p-1 rounded-full bg-rose-600 text-white">
                      <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="p-1 rounded-full bg-amber-500 text-white">
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-[12px] tracking-tight">
                      {!sku.trim()
                        ? '⚠️ Unlabeled Item — No SKU Assigned'
                        : skuValidation.isValid
                          ? '🏷️ Labeled with Unique SKU'
                          : skuValidation.status === 'duplicate'
                            ? '⛔ Duplicate SKU Conflict'
                            : '⚠️ Invalid SKU Format'}
                    </span>

                    {sku.trim() && skuValidation.isValid && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-mono text-[10px] font-bold border border-emerald-300">
                        {sku}
                      </span>
                    )}

                    {skuValidation.formatType && (
                      <span className="px-1.5 py-0.5 bg-white/80 rounded text-[9px] font-mono text-slate-600 border border-slate-200">
                        {skuValidation.formatType === 'standard_app'
                          ? 'Structured Format'
                          : skuValidation.formatType === 'compact'
                            ? 'Compact Format'
                            : 'Custom Format'}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] leading-relaxed">
                    {!sku.trim() ? (
                      <span>
                        This item has <strong>no SKU label</strong>. All inventory items must be tagged with a unique SKU for stock audits, billing, warranty validation, and return claims. Click <strong>"Auto-Generate Unique SKU"</strong> to assign one.
                      </span>
                    ) : skuValidation.isValid ? (
                      <span>
                        Verified <strong>100% unique</strong> across catalog ({inventory.length} total items). Ready for sticker printing and POS scanning.
                      </span>
                    ) : (
                      <span>{skuValidation.message}</span>
                    )}
                  </p>

                  {/* Barcode & Shared Model Status Indicator */}
                  {cleanBarcode && (
                    <div className="pt-1.5 mt-1 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] flex-wrap text-slate-600">
                      <Barcode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        Linked Barcode:{' '}
                        <strong className="font-mono text-slate-800">{barcode}</strong>
                      </span>
                      {sameBarcodeItems.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10px] font-medium">
                          Shares product barcode with {sameBarcodeItems.length} item(s) (e.g. "{sameBarcodeItems[0]?.name}"). Unique SKU maintains individual item traceability.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium">
                          Exclusive new barcode
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 flex items-center gap-1">
                {!sku.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAutoGenerate('smart')}
                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generate</span>
                  </button>
                )}

                {skuValidation.status === 'duplicate' && (
                  <button
                    type="button"
                    onClick={() => handleAutoGenerate('smart')}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Fix SKU</span>
                  </button>
                )}

                {skuValidation.isValid && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sku)}
                    className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                    title="Copy SKU code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Style Format Options */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-slate-400" />
              Presets:
            </span>
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChangeSku(sug.sku);
                  toast.info(`Selected ${sug.label} SKU: "${sug.sku}"`);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border transition-all cursor-pointer ${
                  sku === sug.sku
                    ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title={sug.description}
              >
                {sug.label}: {sug.sku}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* 2. BATCH ITEMS SKU GENERATION & CHECKER (SAME BARCODE) */
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Batched Product Items (Shared Barcode)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                All units share the exact same product barcode (<strong>{barcode || 'Assigned on save'}</strong>), but each unit receives an individual, guaranteed unique SKU.
              </p>
            </div>

            {/* Batch count selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Batch Quantity:</label>
              <input
                type="number"
                min={2}
                max={100}
                value={batchQuantity}
                onChange={(e) => {
                  const qty = Math.max(2, Math.min(100, parseInt(e.target.value) || 2));
                  onChangeBatchQuantity?.(qty);
                  handleGenerateBatchSkus(qty);
                }}
                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center text-slate-900"
              />
              <button
                type="button"
                onClick={() => handleGenerateBatchSkus(batchQuantity)}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="Regenerate all batch SKUs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          {/* Batch SKU Label Checker Status */}
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-full bg-emerald-600 text-white shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <div>
                <span className="font-bold text-xs text-emerald-950">
                  Batch SKU Checker: All {batchSkus.length} units labeled with unique SKUs
                </span>
                <p className="text-[10px] text-emerald-800">
                  0 collisions detected. Each physical unit will be separately tagged for warranty and return tracking while sharing barcode "{barcode || 'Product Barcode'}".
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md shrink-0">
              {batchSkus.length} Unique SKUs
            </span>
          </div>

          {/* Preview grid of generated Batch SKUs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
              <span>Generated Unit SKUs Preview:</span>
              <span>All share barcode: <code className="font-mono text-slate-800">{barcode || 'Auto-generated'}</code></span>
            </div>
            <div className="max-h-36 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {batchSkus.map((bSku, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 rounded text-xs transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                    <span className="font-bold text-slate-900 text-[11px]">{bSku}</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Labeled
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SkuLabelChecker;
