import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  ShieldCheck, 
  Wrench, 
  CheckCircle2, 
  Receipt, 
  Link as LinkIcon, 
  Clock, 
  Package, 
  User 
} from 'lucide-react';
import { ReturnedProduct, ReturnResolution, WarrantyStatus, Invoice } from '../types';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  returnRecord: ReturnedProduct | null;
  invoices: Invoice[];
  onUpdateReturn: (updated: ReturnedProduct) => void;
  onOpenInvoice?: (inv: Invoice) => void;
}

export function EditReturnWarrantyModal({
  isOpen,
  onClose,
  returnRecord,
  invoices,
  onUpdateReturn,
  onOpenInvoice,
}: Props) {
  if (!isOpen || !returnRecord) return null;

  const [resolution, setResolution] = useState<ReturnResolution>(
    returnRecord.resolution || (returnRecord.actionTaken === 'REPLACED' ? 'EXCHANGE' : returnRecord.actionTaken === 'REPAIRED' ? 'REPAIR' : returnRecord.actionTaken === 'STORE_CREDIT' ? 'STORE_CREDIT' : 'REFUND')
  );
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>(
    returnRecord.warrantyStatus || 'UNDER_WARRANTY'
  );
  const [status, setStatus] = useState<ReturnedProduct['status']>(
    returnRecord.status || 'RECEIVED'
  );
  const [refundAmount, setRefundAmount] = useState<number>(returnRecord.refundAmount || 0);
  const [repairCost, setRepairCost] = useState<number>(returnRecord.repairCost || 0);
  const [exchangeItemName, setExchangeItemName] = useState<string>(returnRecord.exchangeItemName || '');
  const [restockedToInventory, setRestockedToInventory] = useState<boolean>(returnRecord.restockedToInventory);
  const [notes, setNotes] = useState<string>(returnRecord.notes || '');

  // Find linked invoice if any
  const linkedInvoice = invoices.find(
    (inv) => inv.invoiceNumber.toLowerCase() === returnRecord.invoiceNumber.toLowerCase()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let actionTaken: ReturnedProduct['actionTaken'] = 'REFUNDED';
    if (resolution === 'EXCHANGE') actionTaken = 'REPLACED';
    else if (resolution === 'REPAIR') actionTaken = 'REPAIRED';
    else if (resolution === 'STORE_CREDIT') actionTaken = 'STORE_CREDIT';
    else if (resolution === 'REJECTED') actionTaken = 'REJECTED';

    const updated: ReturnedProduct = {
      ...returnRecord,
      resolution,
      actionTaken,
      warrantyStatus,
      status,
      refundAmount: resolution === 'REFUND' || resolution === 'STORE_CREDIT' ? Number(refundAmount) || 0 : 0,
      repairCost: resolution === 'REPAIR' ? Number(repairCost) || 0 : undefined,
      exchangeItemName: resolution === 'EXCHANGE' ? exchangeItemName : undefined,
      restockedToInventory,
      notes: notes.trim() || undefined,
    };

    onUpdateReturn(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="edit-return-warranty-modal"
        className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Update RMA Claim: #{returnRecord.id}
              </h3>
              <p className="text-xs text-slate-400">
                {returnRecord.itemName} • {returnRecord.customerName}
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Sale Link Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">Original Sale: </span>
                <span className="font-mono text-slate-900 font-bold">{returnRecord.invoiceNumber}</span>
                {returnRecord.purchaseDate && (
                  <span className="text-slate-500 ml-2">({returnRecord.purchaseDate})</span>
                )}
              </div>
            </div>
            {linkedInvoice && onOpenInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInvoice(linkedInvoice);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
              >
                <LinkIcon className="w-3 h-3" /> View Sale Invoice
              </button>
            )}
          </div>

          {/* Device & Customer Overview */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-500 text-[11px] block">Customer</span>
              <span className="font-semibold text-slate-900">{returnRecord.customerName}</span>
              <span className="text-slate-500 block text-[11px]">📞 {returnRecord.customerPhone}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Product & Serial</span>
              <span className="font-semibold text-slate-900 truncate block">{returnRecord.itemName}</span>
              <span className="text-slate-500 block text-[11px] font-mono">IMEI: {returnRecord.serialOrImei || 'N/A'}</span>
            </div>
          </div>

          {/* Warranty Status Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Warranty Status
            </label>
            <select
              value={warrantyStatus}
              onChange={(e) => setWarrantyStatus(e.target.value as WarrantyStatus)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="UNDER_WARRANTY">🛡️ Under Warranty (Valid)</option>
              <option value="OUT_OF_WARRANTY">⏳ Out of Warranty (Expired)</option>
              <option value="EXTENDED_WARRANTY">✨ Extended Warranty Plan</option>
              <option value="VOID_DAMAGE">⚠️ Void (Liquid / Physical Drop Damage)</option>
              <option value="VENDOR_RMA">🏢 Vendor RMA in Progress</option>
            </select>
          </div>

          {/* Resolution Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Resolution (Resolution Type)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['REFUND', 'EXCHANGE', 'REPAIR', 'STORE_CREDIT'] as ReturnResolution[]).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all text-center ${
                    resolution === res
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {res === 'REFUND' && '💵 Refund'}
                  {res === 'EXCHANGE' && '🔄 Exchange'}
                  {res === 'REPAIR' && '🔧 Repair'}
                  {res === 'STORE_CREDIT' && '💳 Credit'}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Specific Input */}
          {resolution === 'REFUND' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Refund Amount (रु)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {resolution === 'EXCHANGE' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Replacement Unit Details
              </label>
              <input
                type="text"
                placeholder="e.g. Brand new sealed replacement unit"
                value={exchangeItemName}
                onChange={(e) => setExchangeItemName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {resolution === 'REPAIR' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Repair Fee (रु)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={repairCost}
                  onChange={(e) => setRepairCost(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Repair Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReturnedProduct['status'])}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="RECEIVED">📥 Received</option>
                  <option value="IN_DIAGNOSIS">🔍 In Diagnosis</option>
                  <option value="IN_REPAIR">🔧 In Repair</option>
                  <option value="RESOLVED">✅ Repaired / Resolved</option>
                  <option value="CLOSED">🔒 Closed</option>
                </select>
              </div>
            </div>
          )}

          {/* Restock Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 pt-1">
            <input
              type="checkbox"
              checked={restockedToInventory}
              onChange={(e) => setRestockedToInventory(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Item returned to retail inventory shelf?</span>
          </label>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Resolution & Diagnostic Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
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
              Update Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
