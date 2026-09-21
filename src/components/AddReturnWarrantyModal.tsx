import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  RotateCcw, 
  Link as LinkIcon, 
  Receipt, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  Package, 
  Wrench, 
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { ReturnedProduct, InventoryItem, Invoice, ReturnReason, WarrantyStatus, ReturnResolution } from '../types';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  invoices: Invoice[];
  onAddReturn: (newReturn: ReturnedProduct, shouldRestock: boolean, itemId?: string) => void;
}

export function AddReturnWarrantyModal({
  isOpen,
  onClose,
  inventory,
  invoices,
  onAddReturn,
}: Props) {
  // Search & Link state
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItemIndex, setSelectedInvoiceItemIndex] = useState<number>(0);

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Customer details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Item details
  const [itemName, setItemName] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [serialOrImei, setSerialOrImei] = useState('');
  const [matchedItemId, setMatchedItemId] = useState<string | undefined>(undefined);

  // Return & Warranty parameters
  const [returnReason, setReturnReason] = useState<ReturnReason>('DEFECTIVE_HARDWARE');
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>('UNDER_WARRANTY');
  const [warrantyDurationMonths, setWarrantyDurationMonths] = useState<number>(12);
  const [daysElapsed, setDaysElapsed] = useState<number | null>(null);

  // Resolution parameters
  const [resolution, setResolution] = useState<ReturnResolution>('REFUND');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [repairCost, setRepairCost] = useState<number>(0);
  const [exchangeItemName, setExchangeItemName] = useState('');
  const [condition, setCondition] = useState<ReturnedProduct['condition']>('DEFECTIVE_RMA');
  const [restockToShelf, setRestockToShelf] = useState<boolean>(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ReturnedProduct['status']>('RECEIVED');

  // Auto-calculate warranty and days elapsed whenever purchaseDate changes
  useEffect(() => {
    if (!purchaseDate) {
      setDaysElapsed(null);
      return;
    }
    const pDate = new Date(purchaseDate);
    const rDate = returnDate ? new Date(returnDate) : new Date();
    if (!isNaN(pDate.getTime()) && !isNaN(rDate.getTime())) {
      const diffTime = Math.abs(rDate.getTime() - pDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysElapsed(diffDays);

      const maxWarrantyDays = (warrantyDurationMonths || 12) * 30.5;
      if (diffDays <= maxWarrantyDays) {
        setWarrantyStatus('UNDER_WARRANTY');
      } else {
        setWarrantyStatus('OUT_OF_WARRANTY');
      }
    }
  }, [purchaseDate, returnDate, warrantyDurationMonths]);

  // Invoice filtering
  const filteredInvoices = invoiceQuery.trim()
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(invoiceQuery.toLowerCase()) ||
          inv.customerName.toLowerCase().includes(invoiceQuery.toLowerCase()) ||
          inv.customerPhone.includes(invoiceQuery) ||
          inv.items.some((i) => 
            i.name.toLowerCase().includes(invoiceQuery.toLowerCase()) ||
            i.barcode.includes(invoiceQuery) ||
            (i.sku && i.sku.toLowerCase().includes(invoiceQuery.toLowerCase())) ||
            i.imeiList?.some((im) => im.toLowerCase().includes(invoiceQuery.toLowerCase()))
          )
      ).slice(0, 5)
    : [];

  const handleSelectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setInvoiceNumber(inv.invoiceNumber);
    
    // Extract date YYYY-MM-DD
    const rawDate = inv.date.includes(' ') ? inv.date.split(' ')[0] : inv.date;
    setPurchaseDate(rawDate);
    setCustomerName(inv.customerName);
    setCustomerPhone(inv.customerPhone);
    setCustomerEmail(inv.customerEmail || '');

    // Select first item if available
    if (inv.items && inv.items.length > 0) {
      handleSelectInvoiceItem(inv, 0);
    }
  };

  const handleSelectInvoiceItem = (inv: Invoice, index: number) => {
    setSelectedInvoiceItemIndex(index);
    const item = inv.items[index];
    if (!item) return;

    setItemName(item.name);
    setItemBrand(item.brand || 'Gadget');
    setItemBarcode(item.barcode);
    setRefundAmount(item.unitPrice);
    setMatchedItemId(item.itemId);

    if (item.imeiList && item.imeiList.length > 0) {
      setSerialOrImei(item.imeiList[0]);
    } else {
      setSerialOrImei('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueSuffix = `${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const rmaId = `RMA-${timeStamp}-${uniqueSuffix}`;

    // Map resolution to backward compatible actionTaken
    let actionTaken: ReturnedProduct['actionTaken'] = 'REFUNDED';
    if (resolution === 'EXCHANGE') actionTaken = 'REPLACED';
    else if (resolution === 'REPAIR') actionTaken = 'REPAIRED';
    else if (resolution === 'STORE_CREDIT') actionTaken = 'STORE_CREDIT';
    else if (resolution === 'REJECTED') actionTaken = 'REJECTED';

    const newReturn: ReturnedProduct = {
      id: rmaId,
      returnDate: returnDate || new Date().toISOString().slice(0, 10),
      invoiceNumber: invoiceNumber.trim() || 'COUNTER-RECEIPT',
      purchaseDate: purchaseDate.trim() || undefined,
      itemBarcode: itemBarcode.trim() || 'NO-BARCODE',
      itemName: itemName.trim(),
      itemBrand: itemBrand.trim() || 'Generic',
      serialOrImei: serialOrImei.trim() || undefined,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || 'N/A',
      customerEmail: customerEmail.trim() || undefined,
      returnReason,
      condition,
      warrantyStatus,
      warrantyDurationMonths,
      resolution,
      actionTaken,
      refundAmount: resolution === 'REFUND' || resolution === 'STORE_CREDIT' ? Number(refundAmount) || 0 : 0,
      repairCost: resolution === 'REPAIR' ? Number(repairCost) || 0 : undefined,
      exchangeItemName: resolution === 'EXCHANGE' ? exchangeItemName.trim() || itemName.trim() : undefined,
      restockedToInventory: restockToShelf,
      status: resolution === 'REPAIR' ? 'IN_REPAIR' : status,
      notes: notes.trim() || undefined,
    };

    onAddReturn(newReturn, restockToShelf, matchedItemId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="add-return-warranty-modal"
        className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Log Return & Warranty Claim
                <span className="text-[11px] font-normal px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Inventory Spreadsheet Module
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Track customer return, inspect warranty coverage, and record resolution (Refund, Exchange, Repair)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* STEP 1: Link Back to Original Sale (Invoice Lookup) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                Link to Original Sale Invoice
              </label>
              {selectedInvoice && (
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Linked to #{selectedInvoice.invoiceNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Search by Invoice #, Customer Phone, Barcode, or IMEI to auto-populate purchase date, prices, and customer info:
            </p>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sales (e.g. INV-20260910, 9818273645, Anker, iPhone)..."
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Live Autocomplete Results */}
            {filteredInvoices.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm overflow-hidden mt-1">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      handleSelectInvoice(inv);
                      setInvoiceQuery('');
                    }}
                    className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
                      <span className="text-slate-500 text-[11px] ml-2">({inv.date})</span>
                      <div className="text-slate-600 text-[11px]">
                        👤 {inv.customerName} • 📞 {inv.customerPhone}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        📦 Items: {inv.items.map((i) => i.name).join(', ')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900">{formatNPR(inv.grandTotal)}</span>
                      <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 justify-end">
                        Select & Link <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* If invoice selected, show item picker from that invoice */}
            {selectedInvoice && selectedInvoice.items.length > 1 && (
              <div className="pt-2 border-t border-slate-200">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Which item from Invoice #{selectedInvoice.invoiceNumber} is being returned?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedInvoice.items.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectInvoiceItem(selectedInvoice, idx)}
                      className={`p-2 text-left rounded-lg border text-xs transition-all ${
                        selectedInvoiceItemIndex === idx
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
                        <span>Barcode: {item.barcode}</span>
                        <span className="font-semibold">{formatNPR(item.unitPrice)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Sale & Purchase Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Sale Invoice #
              </label>
              <div className="relative">
                <Receipt className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-20260905-1100"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Original Purchase Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Return Claim Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Customer Details */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-600" />
              Customer Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milan KC"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="98XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Email (Optional)</label>
                <div className="relative">
                  <Mail className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="customer@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Returned Product Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Product Name & Description
              </label>
              <div className="relative">
                <Package className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                placeholder="e.g. Sony, Apple, Samsung"
                value={itemBrand}
                onChange={(e) => setItemBrand(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Serial Number or IMEI
              </label>
              <input
                type="text"
                placeholder="e.g. SN-8829103 or 869201928374102"
                value={serialOrImei}
                onChange={(e) => setSerialOrImei(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Section: Reason for Return & Warranty Status */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                Reason for Return & Warranty Evaluation
              </h4>
              {daysElapsed !== null && (
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {daysElapsed} days elapsed post-purchase
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Reason for Return
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="DEFECTIVE_HARDWARE">Defective Hardware / Component</option>
                  <option value="BATTERY_ISSUE">Battery Issue / Drain / Thermal</option>
                  <option value="SCREEN_DEFECT">Screen / Display / Touch Issue</option>
                  <option value="AUDIO_PORT_ISSUE">Audio / Speaker / Port Defect</option>
                  <option value="WRONG_ITEM">Wrong Item / Variant Sold</option>
                  <option value="BUYER_REMORSE">Buyer Remorse (Unopened)</option>
                  <option value="DAMAGED_IN_BOX">Damaged in Box (Transit)</option>
                  <option value="SOFTWARE_CRASH">Software / Bootloop / Firmware</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Warranty Status
                </label>
                <select
                  value={warrantyStatus}
                  onChange={(e) => setWarrantyStatus(e.target.value as WarrantyStatus)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
                >
                  <option value="UNDER_WARRANTY">🛡️ Under Warranty (Valid)</option>
                  <option value="OUT_OF_WARRANTY">⏳ Out of Warranty (Expired)</option>
                  <option value="EXTENDED_WARRANTY">✨ Extended Warranty Plan</option>
                  <option value="VOID_DAMAGE">⚠️ Void (Physical/Water Damage)</option>
                  <option value="VENDOR_RMA">🏢 Vendor RMA in Progress</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Warranty Window (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={warrantyDurationMonths}
                  onChange={(e) => setWarrantyDurationMonths(Number(e.target.value) || 12)}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Resolution (Refund, Exchange, Repair, Store Credit) */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-emerald-700" />
              Resolution & Settlement (e.g., Refund, Exchange, Repair)
            </h4>

            {/* Resolution Selector Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setResolution('REFUND')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                  resolution === 'REFUND'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                💵 Refund
              </button>

              <button
                type="button"
                onClick={() => setResolution('EXCHANGE')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                  resolution === 'EXCHANGE'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                🔄 Exchange
              </button>

              <button
                type="button"
                onClick={() => setResolution('REPAIR')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                  resolution === 'REPAIR'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                🔧 Repair
              </button>

              <button
                type="button"
                onClick={() => setResolution('STORE_CREDIT')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                  resolution === 'STORE_CREDIT'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                💳 Store Credit
              </button>
            </div>

            {/* Dynamic fields based on Resolution */}
            {resolution === 'REFUND' && (
              <div className="bg-white p-3 rounded-lg border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Refund Amount (रु)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={restockToShelf}
                      onChange={(e) => setRestockToShelf(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Restock returned unit to retail inventory?</span>
                  </label>
                </div>
              </div>
            )}

            {resolution === 'EXCHANGE' && (
              <div className="bg-white p-3 rounded-lg border border-blue-200 space-y-2">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Replacement Unit Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Same model new sealed unit or upgraded model"
                  value={exchangeItemName}
                  onChange={(e) => setExchangeItemName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={restockToShelf}
                    onChange={(e) => setRestockToShelf(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Is returned piece restockable? (Leave unchecked if sending to RMA vendor)</span>
                </label>
              </div>
            )}

            {resolution === 'REPAIR' && (
              <div className="bg-white p-3 rounded-lg border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Repair / Service Fee (रु) (0 if covered under warranty)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={repairCost}
                    onChange={(e) => setRepairCost(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Initial Repair Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReturnedProduct['status'])}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
                  >
                    <option value="RECEIVED">📥 Received at Counter</option>
                    <option value="IN_DIAGNOSIS">🔍 In Diagnostic Testing</option>
                    <option value="IN_REPAIR">🔧 In Hardware Repair Lab</option>
                    <option value="RESOLVED">✅ Repaired & Ready for Pickup</option>
                  </select>
                </div>
              </div>
            )}

            {resolution === 'STORE_CREDIT' && (
              <div className="bg-white p-3 rounded-lg border border-purple-200">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Store Credit Amount (रु)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Section: Notes & Technical Log */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Notes & Technical Diagnostic Log
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Battery bulging checked. Customer reported sudden shutdowns at 20%. Handed over for OEM inspection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Save Return & Warranty Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
