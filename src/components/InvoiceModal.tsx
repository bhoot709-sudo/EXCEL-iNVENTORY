import React, { useEffect, useState } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Smartphone, 
  Share2, 
  ShieldAlert,
  FileSpreadsheet
} from 'lucide-react';
import { Invoice, ShopConfig } from '../types';
import QRCode from 'qrcode';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  invoice: Invoice | null;
  shopConfig: ShopConfig;
  isOpen: boolean;
  onClose: () => void;
  onDownloadExcelReceipt?: () => void;
}

export function InvoiceModal({
  invoice,
  shopConfig,
  isOpen,
  onClose,
  onDownloadExcelReceipt,
}: Props) {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (!invoice) return;
    // Generate verification QR code for this invoice (compatible with IRD bill validation & digital receipts)
    const verificationPayload = `INVOICE:${invoice.invoiceNumber}|TOTAL:NPR ${invoice.grandTotal.toFixed(2)}|VAT_PAN:${shopConfig.taxId}|PAYMENT:${invoice.paymentMethod === 'UPI_QR' ? 'FonePay/eSewa QR' : invoice.paymentMethod}|TXN:${invoice.transactionRef || 'N/A'}|STORE:${shopConfig.shopName}|STATUS:${invoice.paymentStatus}`;
    
    QRCode.toDataURL(
      verificationPayload,
      { width: 140, margin: 1 }
    ).then((url) => setQrUrl(url));
  }, [invoice, shopConfig]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Controls (Hidden in print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              PAYMENT COMPLETED & RECORDED
            </span>
            <span className="text-xs text-slate-500 font-mono-num">
              #{invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice (A4 / Thermal)</span>
            </button>

            {onDownloadExcelReceipt && (
              <button
                onClick={onDownloadExcelReceipt}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                title="Download as Excel transaction"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE INVOICE BODY */}
        <div id="printable-invoice" className="py-6 overflow-y-auto pr-1 text-slate-900">
          {/* Shop Header & Invoice Metadata */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base">
                  ⚡
                </div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {shopConfig.shopName}
                </h1>
              </div>
              <p className="text-xs text-slate-600 mt-1">{shopConfig.tagline}</p>
              <p className="text-xs text-slate-500 mt-0.5">{shopConfig.address}</p>
              <p className="text-xs text-slate-500">
                Phone: {shopConfig.phone} • Email: {shopConfig.email}
              </p>
              <p className="text-xs font-mono-num font-semibold text-slate-700 mt-1">
                Tax ID / GSTIN: {shopConfig.taxId}
              </p>
            </div>

            <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none w-full sm:w-auto">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Tax Invoice / Cash Memo
              </span>
              <div className="text-lg font-mono-num font-extrabold text-slate-900 mt-0.5">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Date: <span className="font-mono-num">{invoice.date}</span>
              </div>
              <div className="text-xs text-slate-600">
                Payment: <strong className="text-emerald-700">{invoice.paymentMethod === 'UPI_QR' ? 'FonePay / eSewa QR' : invoice.paymentMethod}</strong>
              </div>
              {invoice.transactionRef && (
                <div className="text-[11px] font-mono-num text-slate-500">
                  Ref: {invoice.transactionRef}
                </div>
              )}
            </div>
          </div>

          {/* Customer Details */}
          <div className="py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Billed To (Customer Details)
              </span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {invoice.customerName || 'Retail Walk-in Customer'}
              </p>
              <p className="text-slate-600">Phone: {invoice.customerPhone || 'N/A'}</p>
              {invoice.customerEmail && <p className="text-slate-600">Email: {invoice.customerEmail}</p>}
            </div>

            <div className="sm:text-right">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Warranty & Return Terms
              </span>
              <p className="text-slate-700 mt-0.5">
                {shopConfig.returnPolicyDays} Days Replacement Guarantee
              </p>
              <p className="text-slate-500 text-[11px]">
                Serial/IMEI must match invoice records for warranty claim.
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2">Item / Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Discount</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-2.5 pr-2">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-2 mt-0.5">
                        <span>Brand: {item.brand}</span>
                        <span>•</span>
                        <span className="font-mono-num">Barcode: {item.barcode}</span>
                      </div>
                      {/* IMEI / Serial Numbers for mobile warranty */}
                      {item.imeiList && item.imeiList.length > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-mono-num text-slate-700">
                          <Smartphone className="w-3 h-3 text-slate-500" />
                          <span>IMEI/Serial: {item.imeiList.join(', ')}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-mono-num font-bold">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 text-right font-mono-num">
                      {formatNPR(item.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-mono-num text-slate-500">
                      {item.discount > 0 ? `-${formatNPR(item.discount)}` : '-'}
                    </td>
                    <td className="py-2.5 text-right font-mono-num font-bold text-slate-900">
                      {formatNPR(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown & Verification QR */}
          <div className="py-4 border-t-2 border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="flex items-center gap-3">
              {qrUrl && (
                <div className="p-1 border border-slate-200 rounded-lg bg-white shrink-0">
                  <img src={qrUrl} alt="Invoice Verification QR" className="w-20 h-20" />
                </div>
              )}
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p className="font-semibold text-slate-700">Official Digital Receipt</p>
                <p>Scan QR to verify invoice authenticity.</p>
                <p className="text-emerald-700 font-bold">Status: PAID IN FULL</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono-num">{formatNPR(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Special Discount</span>
                  <span className="font-mono-num">-{formatNPR(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax / VAT ({invoice.taxRate}%)</span>
                <span className="font-mono-num">{formatNPR(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-300">
                <span>Total Amount Paid</span>
                <span className="font-mono-num text-emerald-800">
                  {formatNPR(invoice.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer & Policy Notes */}
          <div className="mt-6 pt-4 border-t border-dashed border-slate-300 text-center text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Thank you for shopping at {shopConfig.shopName}!</p>
            <p>
              For warranty claims and return identification, please present this invoice and original product packaging with matching IMEI/Serial.
            </p>
          </div>
        </div>

        {/* Modal Bottom (Hidden in print) */}
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center no-print">
          <span className="text-xs text-slate-500">
            Invoice saved to sales register. Stock decremented automatically.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
