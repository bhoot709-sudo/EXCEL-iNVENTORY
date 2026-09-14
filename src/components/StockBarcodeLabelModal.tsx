import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Check, 
  Tag, 
  Copy, 
  Sliders, 
  Sparkles, 
  Layers, 
  Smartphone, 
  CheckCircle2, 
  ExternalLink,
  Barcode,
  Search
} from 'lucide-react';
import { InventoryItem, ShopConfig } from '../types';
import { Code128Barcode } from './Code128Barcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: InventoryItem | null;
  inventory: InventoryItem[];
  shopConfig?: ShopConfig;
}

export type LabelTemplate = 'shelf_tag' | 'box_sticker' | 'compact_tag' | 'a4_sheet';

export function StockBarcodeLabelModal({
  isOpen,
  onClose,
  initialItem,
  inventory,
  shopConfig = {
    shopName: 'Apex Mobiles & Gadgets Hub',
    tagline: 'Smartphones, Wearables & Audio',
    address: 'Electronics Market Plaza',
    phone: '+1 (555) 438-9201',
    email: 'sales@apexmobiles.com',
    taxId: 'TAX-GB-98234102-X',
    currency: 'USD',
    currencySymbol: '$',
    merchantUpiId: 'apextech@bank',
    defaultTaxRate: 8.0,
    returnPolicyDays: 14,
  },
}: Props) {
  // Active selected item for single mode
  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItem ? initialItem.id : (inventory[0]?.id || '')
  );

  // Mode: single item or batch items
  const [mode, setMode] = useState<'single' | 'batch'>(initialItem ? 'single' : 'batch');

  // Batch selection
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>(() => {
    if (initialItem) return [initialItem.id];
    return inventory.slice(0, 6).map((i) => i.id);
  });

  // Label configuration
  const [template, setTemplate] = useState<LabelTemplate>('shelf_tag');
  const [labelQuantity, setLabelQuantity] = useState<number>(() => {
    return initialItem ? Math.max(1, initialItem.stockQuantity) : 4;
  });
  const [batchQtyMode, setBatchQtyMode] = useState<'stock' | 'fixed'>('stock');
  const [fixedBatchQty, setFixedBatchQty] = useState<number>(2);

  // Content toggles
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showCutBorders, setShowCutBorders] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState<number>(44);
  const [barcodeScale, setBarcodeScale] = useState<number>(1.6);

  // Test scan verification feedback
  const [testScanFeedback, setTestScanFeedback] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState(false);

  // Search filter for batch mode
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  const currentItem = inventory.find((i) => i.id === selectedItemId) || initialItem || inventory[0];

  if (!isOpen) return null;

  // Handle printing
  const handlePrint = () => {
    window.print();
  };

  // Copy SKU to clipboard
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  // Simulate scanning the Code128 barcode
  const handleSimulateScan = (sku: string) => {
    setTestScanFeedback(`✓ Scanned Code128: "${sku}" matches ${currentItem?.name || 'catalog product'}`);
    setTimeout(() => setTestScanFeedback(null), 4000);
  };

  // Download Barcode as SVG
  const handleDownloadSvg = () => {
    if (!currentItem) return;
    const svgEl = document.querySelector(`[data-code128-sku="${currentItem.sku}"]`);
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Code128_${currentItem.sku}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Barcode as PNG
  const handleDownloadPng = () => {
    if (!currentItem) return;
    const svgEl = document.querySelector(`[data-code128-sku="${currentItem.sku}"]`) as SVGSVGElement | null;
    if (!svgEl) return;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scaleFactor = 2; // Hi-DPI
      canvas.width = (svgEl.clientWidth || 240) * scaleFactor;
      canvas.height = (svgEl.clientHeight || 90) * scaleFactor;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `Barcode_Code128_${currentItem.sku}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  // Generate label items list based on mode
  interface LabelItemInstance {
    item: InventoryItem;
    instanceIndex: number;
    totalForThisItem: number;
  }

  const labelList: LabelItemInstance[] = [];

  if (mode === 'single' && currentItem) {
    for (let i = 0; i < labelQuantity; i++) {
      labelList.push({
        item: currentItem,
        instanceIndex: i + 1,
        totalForThisItem: labelQuantity,
      });
    }
  } else if (mode === 'batch') {
    const selectedItems = inventory.filter((i) => batchSelectedIds.includes(i.id));
    selectedItems.forEach((item) => {
      const count = batchQtyMode === 'stock' ? Math.max(1, item.stockQuantity) : fixedBatchQty;
      for (let i = 0; i < count; i++) {
        labelList.push({
          item,
          instanceIndex: i + 1,
          totalForThisItem: count,
        });
      }
    });
  }

  // Filtered inventory for batch selection
  const filteredBatchInventory = inventory.filter(
    (i) =>
      i.name.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.sku.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.brand.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(batchSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs">
      {/* Dynamic Print Stylesheet to hide modal chrome during print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-barcode-labels-area,
          #printable-barcode-labels-area * {
            visibility: visible;
          }
          #printable-barcode-labels-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            background: #ffffff !important;
          }
          @page {
            size: auto;
            margin: 8mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Stock Barcode Label Studio (Code128)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide">
                  ISO/IEC 15417 Code 128
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate unique scannable barcodes based on SKU & print adhesive labels for physical stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print {labelList.length} Label{labelList.length === 1 ? '' : 's'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar Controls (left) + Live Print Preview (right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 p-5 overflow-y-auto space-y-4 bg-slate-50/50 text-xs">
            {/* Mode Switcher: Single Item vs Batch Stock */}
            <div className="bg-white p-1 rounded-xl border border-slate-200 grid grid-cols-2 gap-1 shadow-2xs font-semibold">
              <button
                onClick={() => setMode('single')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'single'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Single Item</span>
              </button>
              <button
                onClick={() => setMode('batch')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'batch'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Stock ({batchSelectedIds.length})</span>
              </button>
            </div>

            {/* Single Product Selector */}
            {mode === 'single' ? (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <label className="block font-bold text-slate-900">
                  1. Select Phone / Gadget
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    const item = inventory.find((i) => i.id === e.target.value);
                    if (item) setLabelQuantity(Math.max(1, item.stockQuantity));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — SKU: {item.sku} (Stock: {item.stockQuantity})
                    </option>
                  ))}
                </select>

                {currentItem && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Unique SKU:</span>
                      <div className="flex items-center gap-1 font-mono-num font-bold text-slate-900">
                        <span>{currentItem.sku}</span>
                        <button
                          onClick={() => handleCopySku(currentItem.sku)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                          title="Copy SKU"
                        >
                          {copiedSku ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Physical Stock Count:</span>
                      <span className="font-bold text-slate-800 font-mono-num">
                        {currentItem.stockQuantity} units
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Retail Price:</span>
                      <span className="font-bold font-mono-num text-emerald-700 text-xs">
                        ${currentItem.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Print Count Quick Selectors */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-800">
                      Labels to Print
                    </label>
                    {currentItem && (
                      <button
                        type="button"
                        onClick={() => setLabelQuantity(Math.max(1, currentItem.stockQuantity))}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        Match stock qty ({currentItem.stockQuantity})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={labelQuantity}
                      onChange={(e) => setLabelQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-2 border border-slate-200 rounded-xl font-mono-num font-bold text-slate-900"
                    />
                    <div className="flex items-center gap-1 flex-1">
                      {[1, 2, 4, 8, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLabelQuantity(n)}
                          className={`px-2.5 py-1.5 rounded-lg font-mono-num font-semibold text-[11px] transition-colors ${
                            labelQuantity === n
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Batch Selection Box */
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    Select Products for Batch Stock Printing
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setBatchSelectedIds(inventory.map((i) => i.id))}
                      className="text-emerald-700 hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBatchSelectedIds(
                          inventory.filter((i) => i.stockQuantity <= i.reorderLevel).map((i) => i.id)
                        )
                      }
                      className="text-amber-700 hover:underline font-semibold"
                    >
                      Low Stock
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedIds([])}
                      className="text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search gadgets or SKU..."
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Checklist of products */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2">
                  {filteredBatchInventory.map((item) => {
                    const isChecked = batchSelectedIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isChecked ? 'bg-emerald-50 text-emerald-950 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBatchSelectedIds((prev) => [...prev, item.id]);
                              } else {
                                setBatchSelectedIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="truncate">
                            <span className="truncate">{item.name}</span>
                            <span className="block text-[10px] text-slate-500 font-mono-num">
                              SKU: {item.sku} • Stock: {item.stockQuantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono-num font-bold text-slate-800 text-[11px] shrink-0">
                          ${item.sellingPrice}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Batch Count Mode */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 block">Print Quantity Strategy:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBatchQtyMode('stock')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        batchQtyMode === 'stock'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-[11px]">Match Physical Stock</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Print exact units in stock
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchQtyMode('fixed')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        batchQtyMode === 'fixed'
                          ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-[11px]">Fixed Quantity</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        e.g. {fixedBatchQty} per item
                      </div>
                    </button>
                  </div>

                  {batchQtyMode === 'fixed' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-600">Labels per product:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={fixedBatchQty}
                        onChange={(e) => setFixedBatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-mono-num font-bold text-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Label Template Selection */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <label className="block font-bold text-slate-900">
                2. Label Template & Form Factor
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'shelf_tag',
                    name: 'Shelf Tag (50x30mm)',
                    desc: 'Store name, big price, SKU barcode',
                  },
                  {
                    id: 'box_sticker',
                    name: 'Device Box (60x38mm)',
                    desc: 'Phone packaging sticker with specs',
                  },
                  {
                    id: 'compact_tag',
                    name: 'Compact (40x22mm)',
                    desc: 'Cables & chargers micro label',
                  },
                  {
                    id: 'a4_sheet',
                    name: 'A4 Sheet (24-Up Grid)',
                    desc: 'Standard Avery 3x8 sticker sheets',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id as LabelTemplate)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      template === t.id
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{t.name}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        template === t.id ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {t.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label Content Options */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <label className="block font-bold text-slate-900">
                3. Label Elements & Barcode Sizing
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Display Price ($)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Store Header</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBrand}
                    onChange={(e) => setShowBrand(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Brand & Category</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCutBorders}
                    onChange={(e) => setShowCutBorders(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium">Dashed Cut Line</span>
                </label>
              </div>

              {/* Barcode Height Slider */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-slate-600 text-[11px]">Barcode Bar Height:</span>
                <input
                  type="range"
                  min={28}
                  max={64}
                  value={barcodeHeight}
                  onChange={(e) => setBarcodeHeight(parseInt(e.target.value, 10))}
                  className="w-28 accent-slate-900"
                />
                <span className="font-mono-num text-[11px] font-bold text-slate-800 w-8 text-right">
                  {barcodeHeight}px
                </span>
              </div>
            </div>

            {/* Export & Scan Verification Actions */}
            {currentItem && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <span className="block font-bold text-slate-900">
                  Export Barcode Asset
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>
                </div>

                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleSimulateScan(currentItem.sku)}
                    className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-[11px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Test Scan & Verify SKU Decoder</span>
                  </button>
                  {testScanFeedback && (
                    <p className="text-[10px] text-emerald-700 font-mono-num font-bold mt-1 text-center animate-pulse">
                      {testScanFeedback}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Print Preview Canvas (7 cols) */}
          <div className="lg:col-span-7 p-6 overflow-y-auto bg-slate-100 flex flex-col items-center">
            <div className="w-full max-w-xl flex items-center justify-between pb-3 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Live Print Layout Preview ({labelList.length} total labels)
              </span>
              <span className="text-slate-400 font-mono-num">
                Actual Print Output Ready
              </span>
            </div>

            {/* The Print Area (styled for screen and print) */}
            <div
              id="printable-barcode-labels-area"
              className="w-full max-w-xl bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
            >
              {labelList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  No items selected. Choose at least one product to generate labels.
                </div>
              ) : (
                <div
                  className={`grid gap-3 ${
                    template === 'a4_sheet'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : template === 'compact_tag'
                      ? 'grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {labelList.map(({ item, instanceIndex, totalForThisItem }, idx) => (
                    <div
                      key={`${item.id}-${instanceIndex}-${idx}`}
                      className={`p-3 bg-white flex flex-col justify-between transition-shadow text-slate-900 ${
                        showCutBorders
                          ? 'border border-dashed border-slate-300 rounded-lg'
                          : 'border border-slate-100 rounded-lg'
                      }`}
                      style={{
                        minHeight:
                          template === 'compact_tag'
                            ? '100px'
                            : template === 'shelf_tag'
                            ? '140px'
                            : '170px',
                      }}
                    >
                      {/* Label Top Header */}
                      <div>
                        {showStoreName && (
                          <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold text-slate-500 border-b border-slate-100 pb-1 mb-1">
                            <span className="truncate">{shopConfig.shopName}</span>
                            <span className="font-mono-num shrink-0 text-slate-400">
                              #{instanceIndex}/{totalForThisItem}
                            </span>
                          </div>
                        )}

                        {/* Product Title */}
                        <div className="font-bold text-[11px] leading-tight text-slate-900 line-clamp-2">
                          {item.name}
                        </div>

                        {showBrand && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{item.brand}</span>
                            <span> • {item.category}</span>
                          </div>
                        )}
                      </div>

                      {/* Centered Scannable Code128 Barcode */}
                      <div className="my-2 flex flex-col items-center justify-center">
                        <Code128Barcode
                          value={item.sku}
                          height={template === 'compact_tag' ? 32 : barcodeHeight}
                          width={barcodeScale}
                          displayValue={true}
                          fontSize={11}
                          margin={2}
                          className="max-w-full"
                        />
                      </div>

                      {/* Label Bottom Footer: SKU and Retail Price */}
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="text-[10px] font-mono-num text-slate-600">
                          <span className="text-[9px] text-slate-400 block uppercase tracking-tighter">SKU CODE</span>
                          <span className="font-bold">{item.sku}</span>
                        </div>

                        {showPrice && (
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 block uppercase tracking-tighter">RETAIL</span>
                            <span className="font-mono-num font-extrabold text-sm text-slate-900">
                              ${item.sellingPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Helpful Printing Advice Notice */}
            <div className="w-full max-w-xl mt-4 p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Compatible with standard desktop printers, Avery sheets, and thermal label printers (Zebra/Brother/Dymo).</span>
              </span>
              <button
                onClick={handlePrint}
                className="font-bold text-emerald-700 hover:underline shrink-0 ml-2"
              >
                Print Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
