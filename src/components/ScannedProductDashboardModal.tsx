import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
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
  Mail,
  DollarSign,
  Layers,
  Clock,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { InventoryItem, Invoice } from '../types';
import { Code128Barcode } from './Code128Barcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scannedCode: string;
  item: InventoryItem | null;
  invoices: Invoice[];
  onRedirectToAddItem: (barcodeOrSku: string) => void;
  onSellInPos?: (item: InventoryItem) => void;
  onRestockItem?: (itemId: string, qty: number) => void;
  onEditInInventory?: (item: InventoryItem) => void;
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
  onEditInInventory,
  onScanAnother,
  onViewInvoice,
}: Props) {
  const [restockQty, setRestockQty] = useState<number>(5);
  const [showRestockSuccess, setShowRestockSuccess] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);

  if (!isOpen) return null;

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

  // -------------------------------------------------------------
  // VIEW A: ITEM NOT FOUND IN INVENTORY (As requested)
  // -------------------------------------------------------------
  if (!item) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 overflow-hidden text-center relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Warning / Question Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertCircle className="w-8 h-8" />
          </div>

          <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold tracking-wider inline-block mb-3">
            Scanned Code: {scannedCode}
          </span>

          <h3 className="text-lg font-extrabold text-slate-900 mb-2">
            Item Not Included in Inventory
          </h3>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Item not included in inventory . Do you Want to add this product to the inventory?
          </p>

          {/* Past Sale Notice if found in archive invoices */}
          {latestInvoice && (
            <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600">
              <span className="font-semibold text-slate-800 block mb-1">
                Archived Transaction Found:
              </span>
              Sold in Invoice #{latestInvoice.invoiceNumber} on {latestInvoice.date} to {latestInvoice.customerName} ({latestInvoice.customerPhone}).
            </div>
          )}

          {/* Action Buttons: No vs ADD Item */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
            >
              No
            </button>
            <button
              onClick={() => onRedirectToAddItem(scannedCode)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              ADD Item
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: PRODUCT SCAN DETAILS & STATUS DASHBOARD
  // -------------------------------------------------------------
  const isOnStore = item.stockQuantity > 0;
  const isLowStock = isOnStore && item.stockQuantity <= item.reorderLevel;
  const profitPerUnit = item.sellingPrice - item.costPrice;
  const marginPct = item.sellingPrice > 0 ? (profitPerUnit / item.sellingPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700 text-white rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Product Scan Details & Status
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-bold uppercase border border-slate-200">
                  {item.category}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Live inventory verification & sales history
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
        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          {/* Main Product Identity & Barcode Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                  {item.brand}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-mono">SKU: {item.sku}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {item.name}
              </h2>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Supplier:</span>
                <span className="text-xs font-medium text-slate-800">{item.supplier}</span>
                {item.imeiRequired && (
                  <span className="px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded text-[10px] font-semibold border border-blue-200">
                    IMEI Tracked
                  </span>
                )}
              </div>
            </div>

            {/* Visual Code128 Barcode Badge */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 text-center shrink-0 shadow-2xs">
              <Code128Barcode
                value={item.barcode}
                width={1.6}
                height={38}
                fontSize={11}
                className="max-w-[190px]"
              />
            </div>
          </div>

          {/* Prominent Inventory Store Status */}
          <div
            className={`p-4 rounded-xl border ${
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
                      {isOnStore ? 'On the Store (In Stock)' : 'Sold Product / Out of Stock'}
                    </span>
                    {isLowStock && (
                      <span className="text-xs font-bold text-amber-800">
                        Low Stock Alert
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-1.5 text-slate-700">
                    {isOnStore ? (
                      <>
                        Currently available on shelves: <strong className="font-mono-num font-bold text-slate-900">{item.stockQuantity} units</strong> (Reorder threshold: {item.reorderLevel})
                      </>
                    ) : (
                      <>
                        All units have been sold out. Product is currently unavailable for immediate delivery.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Date of Entry in Inventory */}
              <div className="bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-xl p-2.5 text-right sm:min-w-[170px]">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block flex items-center justify-end gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Date of Entry in Inventory
                </span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {item.lastRestockedDate || 'Registered in catalog'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing & Margins Summary */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cost Price</span>
              <span className="text-sm font-bold font-mono-num text-slate-800">${item.costPrice.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Selling Price</span>
              <span className="text-sm font-bold font-mono-num text-emerald-700">${item.sellingPrice.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Profit / Unit</span>
              <span className="text-sm font-bold font-mono-num text-slate-900">${profitPerUnit.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Margin</span>
              <span className="text-sm font-bold font-mono-num text-emerald-800">{marginPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Sales History & Customer Purchase Details Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
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
              <div className="space-y-3">
                {/* Most Recent Purchase Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {isOnStore ? 'Latest Purchase' : 'Sold Out Purchase Record'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-800">
                        Invoice #{latestInvoice.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono-num">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span><strong>Date of Purchase:</strong> {latestInvoice.date}</span>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Customer Name</span>
                        <span className="font-bold text-slate-900">{latestInvoice.customerName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Phone</span>
                        <span className="font-mono text-slate-800">{latestInvoice.customerPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Units & Payment</span>
                        <span className="text-slate-800">
                          {latestInvoiceItem ? `${latestInvoiceItem.quantity} unit(s)` : '1 unit'} via {latestInvoice.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* View official receipt button */}
                  {onViewInvoice && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => onViewInvoice(latestInvoice)}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
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
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
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
                                  className="text-emerald-700 hover:underline text-[11px] font-semibold"
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
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                <PackagePlus className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <p className="font-medium text-slate-700">No past customer purchases recorded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  This product is in inventory and ready to be sold at POS.
                </p>
              </div>
            )}
          </div>

          {/* Quick Restock Inline Tool */}
          {onRestockItem && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Quick Restock Units</span>
                <span className="text-[11px] text-slate-500">Instantly add new units to this product's store count</span>
              </div>

              <div className="flex items-center gap-1.5">
                {[5, 10, 25].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQuickRestock(q)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-400 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-bold font-mono transition-colors"
                  >
                    +{q}
                  </button>
                ))}
                {showRestockSuccess && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Restocked!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {onScanAnother ? (
            <button
              onClick={onScanAnother}
              className="py-2.5 px-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-4 h-4 text-slate-500" />
              Scan Another
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {onEditInInventory && (
              <button
                onClick={() => onEditInInventory(item)}
                className="py-2.5 px-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-slate-500" />
                Edit in Inventory
              </button>
            )}

            {isOnStore && onSellInPos && (
              <button
                onClick={() => onSellInPos(item)}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Sell in POS Cashier
              </button>
            )}

            <button
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
