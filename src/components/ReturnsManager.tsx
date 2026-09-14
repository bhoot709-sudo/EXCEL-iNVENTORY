import React, { useState } from 'react';
import { 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldX, 
  PackageCheck, 
  FileText, 
  Barcode, 
  Smartphone,
  Plus,
  Camera,
  Scan
} from 'lucide-react';
import { ReturnedProduct, InventoryItem, Invoice } from '../types';
import { useToast } from './Toast';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface Props {
  returns: ReturnedProduct[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  onAddReturn: (ret: ReturnedProduct, shouldRestock: boolean, itemId?: string) => void;
  onOpenScanner: () => void;
}

export function ReturnsManager({
  returns,
  inventory,
  invoices,
  onAddReturn,
  onOpenScanner,
}: Props) {
  const toast = useToast();
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReturnScanner, setShowReturnScanner] = useState(false);
  const [showImeiScanner, setShowImeiScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Return identification form state
  const [lookupKey, setLookupKey] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serialOrImei, setSerialOrImei] = useState('');
  const [returnReason, setReturnReason] = useState<ReturnedProduct['returnReason']>('DEFECTIVE_HARDWARE');
  const [condition, setCondition] = useState<ReturnedProduct['condition']>('DEFECTIVE_RMA');
  const [actionTaken, setActionTaken] = useState<ReturnedProduct['actionTaken']>('REFUNDED');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [restockToShelf, setRestockToShelf] = useState<boolean>(false);
  const [notes, setNotes] = useState('');

  // Handle lookup by invoice number, barcode, or SKU
  const handleLookup = (customKey?: string) => {
    const key = (customKey !== undefined ? customKey : lookupKey).trim();
    if (!key) {
      toast.warning('Please enter or scan an invoice number, barcode, or IMEI.', 'Identification');
      return;
    }

    // 1. Check invoices
    const inv = invoices.find(
      (i) =>
        i.invoiceNumber.toLowerCase() === key.toLowerCase() ||
        i.items.some((it) => it.barcode === key || it.imeiList?.some((im) => im.toLowerCase() === key.toLowerCase()))
    );

    if (inv) {
      setMatchedInvoice(inv);
      setCustomerName(inv.customerName);
      setCustomerPhone(inv.customerPhone);
      const matchedLine = inv.items.find(
        (it) => it.barcode === key || it.imeiList?.some((im) => im.toLowerCase() === key.toLowerCase())
      ) || inv.items[0];

      const invItem = inventory.find((i) => i.id === matchedLine.itemId);
      if (invItem) setMatchedItem(invItem);
      setRefundAmount(matchedLine.unitPrice);
      if (matchedLine.imeiList && matchedLine.imeiList.length > 0) {
        const foundImei = matchedLine.imeiList.find((im) => im.toLowerCase() === key.toLowerCase()) || matchedLine.imeiList[0];
        setSerialOrImei(foundImei);
      }
      toast.success(`Matched Invoice #${inv.invoiceNumber} for ${inv.customerName}`, 'Product Identified');
      return;
    }

    // 2. Check inventory directly by barcode or SKU
    const invItem = inventory.find(
      (i) => i.barcode === key || i.sku.toLowerCase() === key.toLowerCase()
    );
    if (invItem) {
      setMatchedItem(invItem);
      setRefundAmount(invItem.sellingPrice);
      toast.success(`Identified: ${invItem.name}`, 'Stock Matched');
      return;
    }

    toast.info('No matching invoice, barcode, or IMEI found. You can fill in details manually.', 'Product Lookup');
  };

  const handleConditionChange = (cond: ReturnedProduct['condition']) => {
    setCondition(cond);
    // Suggest restocking automatically if new/unopened
    if (cond === 'RESTOCKABLE_NEW') {
      setRestockToShelf(true);
    } else {
      setRestockToShelf(false);
    }
  };

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingReturn) return;

    const trimmedKey = lookupKey.trim();
    if (!matchedItem && !trimmedKey) {
      toast.warning('Please specify the returned product name or barcode.');
      return;
    }

    const itemBarcode = matchedItem?.barcode || trimmedKey;
    const trimmedSerial = serialOrImei.trim();

    // 1. Deduplication check: verify if device with this exact serial/IMEI was already returned
    if (trimmedSerial) {
      const priorSerialReturn = returns.find(
        (r) => r.serialOrImei && r.serialOrImei.toLowerCase() === trimmedSerial.toLowerCase()
      );
      if (priorSerialReturn) {
        toast.error(
          `Duplicate Return Denied! Device IMEI/Serial "${trimmedSerial}" was already returned under RMA #${priorSerialReturn.id} on ${priorSerialReturn.returnDate}.`,
          'Duplicate IMEI Return'
        );
        return;
      }
    }

    // 2. Deduplication check: if matched against an invoice, verify we haven't already returned all units sold
    if (matchedInvoice) {
      const invoiceNum = matchedInvoice.invoiceNumber;
      // Calculate how many of this item were sold on this invoice
      const invoiceLine = matchedInvoice.items.find(
        (it) => it.barcode === itemBarcode || (matchedItem && it.itemId === matchedItem.id)
      );
      const soldQuantity = invoiceLine ? invoiceLine.quantity : 1;

      // Count prior returns recorded against this invoice for this product
      const existingReturns = returns.filter(
        (r) =>
          r.invoiceNumber.toLowerCase() === invoiceNum.toLowerCase() &&
          (r.itemBarcode === itemBarcode || (matchedItem && r.itemName === matchedItem.name))
      );

      if (existingReturns.length >= soldQuantity) {
        toast.error(
          `Duplicate Return! All ${soldQuantity} unit(s) of "${matchedItem?.name || itemBarcode}" on Invoice #${invoiceNum} have already been returned (RMA: ${existingReturns.map(r => r.id).join(', ')}).`,
          'Invoice Return Limit Reached'
        );
        return;
      }
    }

    setIsSubmittingReturn(true);

    try {
      const timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uniqueSuffix = `${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newReturn: ReturnedProduct = {
        id: `RMA-${timeStamp}-${uniqueSuffix}`,
        returnDate: new Date().toLocaleString(),
        invoiceNumber: matchedInvoice?.invoiceNumber || (trimmedKey.startsWith('INV-') ? trimmedKey : 'COUNTER-RETURN'),
        itemBarcode,
        itemName: matchedItem?.name || 'Returned Gadget',
        itemBrand: matchedItem?.brand || 'Generic',
        serialOrImei: trimmedSerial || undefined,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || 'N/A',
        returnReason,
        condition,
        actionTaken,
        refundAmount,
        restockedToInventory: restockToShelf,
        notes: notes.trim(),
      };

      onAddReturn(newReturn, restockToShelf, matchedItem?.id);
      setShowAddModal(false);
      toast.success(`RMA #${newReturn.id} processed successfully.`);

      // Reset form
      setLookupKey('');
      setMatchedInvoice(null);
      setMatchedItem(null);
      setCustomerName('');
      setCustomerPhone('');
      setSerialOrImei('');
      setRefundAmount(0);
      setNotes('');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const filteredReturns = returns.filter((r) =>
    r.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.itemBarcode.includes(searchQuery) ||
    (r.serialOrImei && r.serialOrImei.includes(searchQuery))
  );

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Returned Product Identification & RMA
            </h3>
            <p className="text-xs text-slate-500">
              Identify returns by invoice barcode, IMEI, or serial • Triage defective vs restockable
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search returns by IMEI, invoice, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Process New Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for Returns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Returns Processed
          </span>
          <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
            {returns.length} units
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Warranty & customer returns
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Restocked to Shelf
          </span>
          <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-1">
            {returns.filter((r) => r.restockedToInventory).length} units
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            Auto-replenished inventory stock
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
            Defective / Vendor RMA
          </span>
          <div className="text-2xl font-bold font-mono-num text-rose-700 mt-1">
            {returns.filter((r) => r.condition === 'DEFECTIVE_RMA').length} units
          </div>
          <p className="text-[11px] text-rose-600 mt-0.5">
            Quarantined for manufacturer replacement
          </p>
        </div>
      </div>

      {/* Returns Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">RMA Ticket ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Product Name & Barcode</th>
                <th className="p-3">Serial / IMEI</th>
                <th className="p-3">Original Invoice</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Condition & Restock</th>
                <th className="p-3 text-right">Refund Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No return records found.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono-num font-bold text-slate-900">
                      {ret.id}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {ret.returnDate}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{ret.itemName}</div>
                      <div className="text-[11px] font-mono-num text-slate-500">
                        {ret.itemBarcode}
                      </div>
                    </td>
                    <td className="p-3 font-mono-num text-slate-700">
                      {ret.serialOrImei ? (
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">
                          {ret.serialOrImei}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 font-mono-num text-slate-600">
                      {ret.invoiceNumber}
                    </td>
                    <td className="p-3 text-slate-700">
                      <div>{ret.customerName}</div>
                      <div className="text-[10px] text-slate-400">{ret.customerPhone}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {ret.returnReason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      {ret.restockedToInventory ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <PackageCheck className="w-3 h-3" />
                          Restocked (+1)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <ShieldX className="w-3 h-3" />
                          Defective RMA
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono-num font-bold text-slate-900">
                      ${ret.refundAmount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Process Return & Identification */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Process Return & Diagnose Condition
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="py-4 space-y-4 overflow-y-auto pr-1 text-xs">
              {/* Step 1: Identification Lookup */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <label className="block font-bold text-slate-800">
                  1. Identify Return (Scan Barcode, IMEI or Enter Invoice #)
                </label>
                <div className="flex items-center gap-2 relative">
                  <input
                    id="returns-lookup-input"
                    type="text"
                    value={lookupKey}
                    onChange={(e) => setLookupKey(e.target.value)}
                    placeholder="e.g. 195949012345 or INV-2026-0901 or IMEI"
                    className="flex-1 pl-3.5 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl font-mono-num text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  />
                  {/* Distinctive Camera Button for Barcode / QR Scanning situated within the input field */}
                  <button
                    id="btn-return-camera-scan"
                    type="button"
                    onClick={() => setShowReturnScanner(true)}
                    title="Scan Barcode / QR / IMEI with Camera"
                    className="absolute right-[92px] top-1/2 -translate-y-1/2 p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg border border-emerald-300 hover:border-emerald-600 transition-all duration-150 shadow-2xs flex items-center justify-center group cursor-pointer"
                  >
                    <Camera className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="sr-only">Scan QR or Barcode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLookup()}
                    className="w-20 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors text-xs shrink-0 shadow-2xs text-center cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>

                {matchedItem && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{matchedItem.name}</p>
                      <p className="text-[11px] text-emerald-700 font-mono-num">
                        Current Stock: {matchedItem.stockQuantity} • MSRP: ${matchedItem.sellingPrice}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-200 font-bold rounded">
                      IDENTIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* Step 2: Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Customer Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="returns-imei-input" className="block text-slate-600 font-medium">
                    Device Serial / IMEI Number (for warranty matching)
                  </label>
                  {serialOrImei && (
                    <span className="text-[11px] text-emerald-700 font-mono font-medium">
                      {serialOrImei.length} digits
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="returns-imei-input"
                    type="text"
                    placeholder="358291048829102 or scan barcode"
                    value={serialOrImei}
                    onChange={(e) => setSerialOrImei(e.target.value)}
                    className="w-full pl-3.5 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl font-mono-num text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  />
                  {/* Distinctive Camera Button for Device Serial / IMEI Barcode Scanning */}
                  <button
                    id="btn-return-imei-camera-scan"
                    type="button"
                    onClick={() => setShowImeiScanner(true)}
                    title="Scan IMEI or Serial Barcode with Camera"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg border border-emerald-300 hover:border-emerald-600 transition-all duration-150 shadow-2xs flex items-center justify-center group cursor-pointer"
                  >
                    <Camera className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span className="sr-only">Scan IMEI Barcode with Camera</span>
                  </button>
                </div>
              </div>

              {/* Reason & Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Return Reason</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="DEFECTIVE_HARDWARE">Defective Hardware (Faulty)</option>
                    <option value="WRONG_ITEM">Wrong Item Handed</option>
                    <option value="BUYER_REMORSE">Buyer Remorse / Changed Mind</option>
                    <option value="BATTERY_ISSUE">Battery Drain / Overheating</option>
                    <option value="DAMAGED_IN_BOX">Cosmetic / Scratched in Box</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Physical Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => handleConditionChange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="DEFECTIVE_RMA">Defective (Send to Vendor RMA)</option>
                    <option value="RESTOCKABLE_NEW">Unopened / Like New (Restockable)</option>
                    <option value="OPEN_BOX_DISCOUNT">Open Box (Discounted Clearance)</option>
                  </select>
                </div>
              </div>

              {/* Restock Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Restock to Live Inventory?</p>
                  <p className="text-[11px] text-slate-500">
                    If checked, stock quantity will automatically increment by +1 immediately.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={restockToShelf}
                  onChange={(e) => setRestockToShelf(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              {/* Action & Refund Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Action Taken</label>
                  <select
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="REFUNDED">Refund Cash / Bank</option>
                    <option value="REPLACED">Provide Replacement Unit</option>
                    <option value="STORE_CREDIT">Store Credit Voucher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Refund Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono-num font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Diagnostic / RMA Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ear cup microphone failing, sent to Sony authorized center..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
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
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Record Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Identification Camera Barcode / QR Scanner Modal */}
      {showReturnScanner && (
        <BarcodeScannerModal
          isOpen={showReturnScanner}
          onClose={() => setShowReturnScanner(false)}
          onBarcodeDetected={(scannedCode) => {
            const trimmed = scannedCode.trim();
            setLookupKey(trimmed);
            setShowReturnScanner(false);
            handleLookup(trimmed);
            toast.success(`Scanned & decoded: ${trimmed}`, 'Camera Scanner');
          }}
          inventory={inventory}
          title="Scan Return Barcode / QR / IMEI"
          subtitle="Point camera at device IMEI, packaging barcode, or invoice QR code to auto-populate"
          zIndexClass="z-[70]"
        />
      )}

      {/* Device Serial / IMEI Camera Scanner Modal */}
      {showImeiScanner && (
        <BarcodeScannerModal
          isOpen={showImeiScanner}
          onClose={() => setShowImeiScanner(false)}
          onBarcodeDetected={(scannedCode) => {
            const trimmed = scannedCode.trim();
            setSerialOrImei(trimmed);
            setShowImeiScanner(false);
            toast.success(`Scanned & decoded IMEI: ${trimmed}`, 'IMEI Scanner');
          }}
          inventory={inventory}
          title="Scan Device Serial / IMEI Barcode"
          subtitle="Point camera at phone box label, SIM tray sticker, or barcode on warranty card"
          zIndexClass="z-[70]"
        />
      )}
    </div>
  );
}
