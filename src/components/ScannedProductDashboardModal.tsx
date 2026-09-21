import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  X, 
  ShoppingCart, 
  PackagePlus, 
  Edit3, 
  FileText, 
  Camera, 
  Plus, 
  ArrowRight, 
  Smartphone,
  Calendar,
  User,
  Phone,
  DollarSign,
  Clock,
  ExternalLink,
  Tag,
  RotateCcw,
  Copy,
  Check,
  Printer,
  Sparkles,
  Search
} from 'lucide-react';
import { InventoryItem, Invoice } from '../types';
import { Code128Barcode } from './Code128Barcode';
import { formatNPR } from '../utils/nepalLocale';
import { parseAppGeneratedSku, isAppGeneratedSkuFormat } from '../utils/barcodeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scannedCode: string;
  item: InventoryItem | null;
  invoices: Invoice[];
  onRedirectToAddItem: (barcodeOrSku: string) => void;
  onSellInPos?: (item: InventoryItem) => void;
  onRestockItem?: (itemId: string, qty: number) => void;
  onProcessReturn?: (item: InventoryItem) => void;
  onEditInInventory?: (item: InventoryItem) => void;
  onOpenLabelStudio?: (item: InventoryItem) => void;
  onScanAnother?: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export function ScannedProductDashboardModal({
  isOpen,
  onClose,
  scannedCode,
  item,
  invoices,
  onRedirectToAddItem,
  onSellInPos,
  onRestockItem,
  onProcessReturn,
  onEditInInventory,
  onOpenLabelStudio,
  onScanAnother,
  onViewInvoice,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showRestockSuccess, setShowRestockSuccess] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);

  if (!isOpen) return null;

  const skuInfo = parseAppGeneratedSku(scannedCode);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scannedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Find historical sales / purchases of this item
  const matchingInvoices = invoices.filter((inv) =>
    inv.items.some(
      (line) =>
        (item && line.itemId === item.id) ||
        line.barcode === scannedCode ||
        (item && line.barcode === item.barcode) ||
        (item && line.sku.toLowerCase() === item.sku.toLowerCase()) ||
        line.sku.toLowerCase() === scannedCode.toLowerCase()
    )
  );

  // Latest sale transaction
  const latestInvoice = matchingInvoices[0] || null;
  const latestInvoiceItem = latestInvoice?.items.find(
    (line) =>
      (item && line.itemId === item.id) ||
      line.barcode === scannedCode ||
      (item && line.barcode === item.barcode) ||
      (item && line.sku.toLowerCase() === item.sku.toLowerCase())
  );

  const handleQuickRestock = (qty: number) => {
    if (!item || !onRestockItem) return;
    onRestockItem(item.id, qty);
    setShowRestockSuccess(true);
    setTimeout(() => setShowRestockSuccess(false), 2500);
  };

  // =========================================================================
  // VIEW A: PRODUCT UNRECOGNIZED WARNING MESSAGE
  // =========================================================================
  if (!item) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-rose-200 overflow-hidden text-center relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prominent Warning Badge & Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-300 shadow-xs">
            <AlertTriangle className="w-8 h-8 text-amber-600 animate-bounce" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Product Unrecognized (अपरिचित उत्पादन)</span>
          </div>

          <h3 className="text-lg font-extrabold text-slate-900 mb-1">
            SKU / Barcode Not Found in Catalog
          </h3>

          <p className="text-xs text-slate-600 mb-4 leading-relaxed max-w-md mx-auto">
            The scanner read the code below, but no matching product was found in your active inventory catalog.
          </p>

          {/* Scanned Code Box with Copy */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-left flex items-center justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Scanned Code / SKU Value:
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 break-all select-all">
                {scannedCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
              title="Copy code to clipboard"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* SKU Intelligence & Format Diagnostics */}
          {skuInfo.isAppSku ? (
            <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-left mb-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>App-Generated SKU Format Detected</span>
              </div>
              <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                {skuInfo.formatDescription || 'This code matches the standard retail SKU structure generated by this app.'}
              </p>
              <p className="text-[11px] text-indigo-700 font-medium">
                💡 Tip: This item may have been printed on a barcode label or drafted, but has not yet been registered in the database.
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left mb-4 text-[11px] text-slate-600 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Standard EAN/UPC or Custom Barcode. You can enroll it as a new product in one click.</span>
            </div>
          )}

          {/* Past Sale Notice if found in archive invoices */}
          {latestInvoice && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900">
              <span className="font-bold text-amber-950 block mb-1">
                Archived Transaction Found:
              </span>
              This code was previously sold in Invoice #{latestInvoice.invoiceNumber} on {latestInvoice.date} to {latestInvoice.customerName} ({latestInvoice.customerPhone}).
            </div>
          )}

          {/* Action Buttons: Add Product vs Scan Another */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => onRedirectToAddItem(scannedCode)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add as New Product with this SKU / Barcode</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              {onScanAnother && (
                <button
                  type="button"
                  onClick={onScanAnother}
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span>Scan Another</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer ${!onScanAnother ? 'col-span-2' : ''}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: RECOGNIZED PRODUCT DETAILS & STATUS DASHBOARD
  // =========================================================================
  const isOnStore = item.stockQuantity > 0;
  const isLowStock = isOnStore && item.stockQuantity <= item.reorderLevel;
  const profitPerUnit = item.sellingPrice - item.costPrice;
  const marginPct = item.sellingPrice > 0 ? (profitPerUnit / item.sellingPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700 text-white rounded-xl shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Product Details & Verification
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Recognized in Catalog
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Live SKU & barcode match • Real-time stock status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="py-3.5 space-y-3.5 overflow-y-auto pr-1">
          {/* Main Product Identity & Barcode Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase text-emerald-800 tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded">
                  {item.brand}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-700 font-semibold">{item.category}</span>
                {item.imeiRequired && (
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] font-bold border border-blue-200">
                    IMEI Tracked
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                {item.name}
              </h2>

              <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-600 flex-wrap">
                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-800 font-semibold">
                  <Tag className="w-3 h-3 text-emerald-600" />
                  <span>SKU: {item.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 mr-1">Supplier:</span>
                  <span className="font-medium text-slate-800">{item.supplier || 'Standard Distributor'}</span>
                </div>
              </div>
            </div>

            {/* Visual Code128 Barcode Badge */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 text-center shrink-0 shadow-2xs flex flex-col items-center">
              <Code128Barcode
                value={item.barcode}
                width={1.5}
                height={36}
                fontSize={10}
                className="max-w-[180px]"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">Scannable Code-128</span>
            </div>
          </div>

          {/* Prominent Inventory Store Status */}
          <div
            className={`p-3.5 rounded-xl border ${
              isOnStore
                ? isLowStock
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    isOnStore
                      ? isLowStock
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {isOnStore ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isOnStore
                          ? isLowStock
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-emerald-200 text-emerald-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      {isOnStore ? (isLowStock ? 'Low Stock' : 'On Store Shelves') : 'Sold Out / Out of Stock'}
                    </span>
                    {isLowStock && (
                      <span className="text-xs font-bold text-amber-800">
                        Threshold Alert
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-1 text-slate-700">
                    {isOnStore ? (
                      <>
                        Available stock: <strong className="font-mono-num font-bold text-slate-900">{item.stockQuantity} units</strong> (Reorder level: {item.reorderLevel})
                      </>
                    ) : (
                      <>
                        All units have been sold out. Restock required before creating sales bills.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Date of Entry in Inventory */}
              <div className="bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-xl p-2 sm:p-2.5 text-left sm:text-right shrink-0">
                <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center sm:justify-end gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Last Restocked
                </span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {item.lastRestockedDate || 'Registered in Catalog'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Margins Summary with Nepali Rupee Format */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cost Price</span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-slate-800">{formatNPR(item.costPrice)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Selling Price</span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-emerald-700">{formatNPR(item.sellingPrice)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Profit / Unit</span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-slate-900">{formatNPR(profitPerUnit)}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Margin</span>
              <span className="text-xs sm:text-sm font-bold font-mono-num text-emerald-800">{marginPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Quick Restock & Label Actions */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Quick Restock Units</span>
              <span className="text-[11px] text-slate-500">Instantly add new incoming physical units</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {onRestockItem && [5, 10, 25].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuickRestock(q)}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-400 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer shadow-2xs"
                  title={`Restock +${q} units`}
                >
                  +{q}
                </button>
              ))}

              {onOpenLabelStudio && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLabelStudio(item);
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  title="Generate and print barcode/price labels"
                >
                  <Printer className="w-3 h-3 text-slate-500" />
                  <span>Print Labels</span>
                </button>
              )}

              {showRestockSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Restocked!
                </span>
              )}
            </div>
          </div>

          {/* Sales History & Customer Purchase Details Section */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Customer Purchase & Sales History
                </h4>
              </div>
              {matchingInvoices.length > 0 && (
                <span className="text-[11px] font-medium text-slate-500">
                  {matchingInvoices.length} sale transaction{matchingInvoices.length > 1 ? 's' : ''} found
                </span>
              )}
            </div>

            {latestInvoice ? (
              <div className="space-y-2.5">
                {/* Most Recent Purchase Card */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {isOnStore ? 'Latest Purchase' : 'Sold Out Purchase Record'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800">
                        Invoice #{latestInvoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 font-mono-num">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{latestInvoice.date}</span>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-0.5">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Customer</span>
                        <span className="font-bold text-slate-900">{latestInvoice.customerName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Phone</span>
                        <span className="font-mono text-slate-800">{latestInvoice.customerPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Units & Mode</span>
                        <span className="text-slate-800">
                          {latestInvoiceItem ? `${latestInvoiceItem.quantity} unit(s)` : '1 unit'} via {latestInvoice.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* View official receipt button */}
                  {onViewInvoice && (
                    <div className="pt-1.5 flex justify-end">
                      <button
                        onClick={() => onViewInvoice(latestInvoice)}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Full Printable Invoice Receipt
                      </button>
                    </div>
                  )}
                </div>

                {/* Earlier Sales List if more than 1 */}
                {matchingInvoices.length > 1 && (
                  <div>
                    <button
                      onClick={() => setShowAllInvoices(!showAllInvoices)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAllInvoices ? 'Hide earlier sales' : `View ${matchingInvoices.length - 1} earlier purchase(s)`}</span>
                    </button>

                    {showAllInvoices && (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {matchingInvoices.slice(1).map((inv) => (
                          <div
                            key={inv.id}
                            className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between hover:bg-slate-50"
                          >
                            <div>
                              <span className="font-mono font-semibold text-slate-800">#{inv.invoiceNumber}</span>
                              <span className="text-slate-400 mx-1.5">•</span>
                              <span className="text-slate-700 font-medium">{inv.customerName}</span>
                              <span className="text-slate-400 text-[11px] ml-1">({inv.customerPhone})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-500">{inv.date}</span>
                              {onViewInvoice && (
                                <button
                                  onClick={() => onViewInvoice(inv)}
                                  className="text-emerald-700 hover:underline text-[11px] font-semibold cursor-pointer"
                                >
                                  Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                <PackagePlus className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="font-medium text-slate-700">No past customer purchases recorded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  This product is in inventory and ready to be sold at POS.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {onScanAnother ? (
            <button
              onClick={onScanAnother}
              className="py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-slate-500" />
              <span>Scan Another</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {onEditInInventory && (
              <button
                onClick={() => onEditInInventory(item)}
                className="py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Product</span>
              </button>
            )}

            {onProcessReturn && (
              <button
                onClick={() => {
                  onClose();
                  onProcessReturn(item);
                }}
                className="py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Return / RMA</span>
              </button>
            )}

            {isOnStore && onSellInPos && (
              <button
                onClick={() => onSellInPos(item)}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Sell in POS</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

