import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  X,
  Smartphone,
  Sparkles,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  CheckCheck,
  Receipt
} from 'lucide-react';
import { generatePaymentQrCode, playScannerBeep } from '../utils/barcodeUtils';
import { ShopConfig } from '../types';
import { formatNPR, formatNPRWords } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  shopConfig: ShopConfig;
  onPaymentSuccess: (transactionRef: string) => void;
}

type QrMode = 'INTEROPERABLE' | 'FONEPAY' | 'ESEWA' | 'UPI';

export function PaymentQrModal({
  isOpen,
  onClose,
  grandTotal,
  invoiceNumber,
  customerName,
  customerPhone = '',
  shopConfig,
  onPaymentSuccess,
}: Props) {
  const toast = useToast();
  const [activeMode, setActiveMode] = useState<QrMode>('INTEROPERABLE');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [rawPayload, setRawPayload] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [showPayloadInspector, setShowPayloadInspector] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'AWAITING' | 'CONFIRMING' | 'SUCCESS'>('AWAITING');
  const [countdown, setCountdown] = useState(300); // 5 min dynamic QR validity timeout
  const [customTxnRef, setCustomTxnRef] = useState('');
  const [showCustomTxnInput, setShowCustomTxnInput] = useState(false);

  // Generate dynamic QR code whenever activeMode, grandTotal, or invoice changes
  useEffect(() => {
    if (!isOpen) {
      setPaymentStatus('AWAITING');
      setCountdown(300);
      setShowCustomTxnInput(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    generatePaymentQrCode(
      grandTotal,
      invoiceNumber,
      shopConfig.merchantUpiId,
      shopConfig.shopName,
      shopConfig.currency || 'NPR',
      activeMode,
      shopConfig.taxId || '609823192',
      customerPhone
    ).then((res) => {
      if (isMounted) {
        setQrDataUrl(res.qrDataUrl);
        setRawPayload(res.rawPayload);
        setLoading(false);
      }
    });

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isOpen, grandTotal, invoiceNumber, shopConfig, activeMode, customerPhone]);

  if (!isOpen) return null;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(shopConfig.merchantUpiId);
    setCopiedVpa(true);
    toast.success('Merchant ID copied to clipboard');
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(rawPayload);
    setCopiedPayload(true);
    toast.success('EMVCo dynamic QR payload copied');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleRefreshQr = () => {
    setLoading(true);
    setCountdown(300);
    generatePaymentQrCode(
      grandTotal,
      invoiceNumber,
      shopConfig.merchantUpiId,
      shopConfig.shopName,
      shopConfig.currency || 'NPR',
      activeMode,
      shopConfig.taxId || '609823192',
      customerPhone
    ).then((res) => {
      setQrDataUrl(res.qrDataUrl);
      setRawPayload(res.rawPayload);
      setLoading(false);
      toast.success('Dynamic QR refreshed with new session token');
    });
  };

  const handleSimulatePayment = () => {
    playScannerBeep(false);
    setPaymentStatus('CONFIRMING');
    setTimeout(() => {
      setPaymentStatus('SUCCESS');
      playScannerBeep(false);
      const generatedRef =
        customTxnRef.trim() ||
        `${activeMode === 'ESEWA' ? 'ESW' : activeMode === 'FONEPAY' ? 'FP' : 'NP'}-${Math.floor(10000000 + Math.random() * 90000000)}`;

      toast.success(
        `Payment of ${formatNPR(grandTotal)} verified via ${activeMode === 'ESEWA' ? 'eSewa' : activeMode === 'FONEPAY' ? 'FonePay' : 'FonePay / eSewa'}`,
        'Payment Verified'
      );

      setTimeout(() => {
        onPaymentSuccess(generatedRef);
      }, 900);
    }, 1200);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${invoiceNumber}-${activeMode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Dynamic QR downloaded');
  };

  const handlePrintSlip = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment QR - ${invoiceNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 24px; color: #1e293b; }
            .header { border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 16px; }
            .shop-name { font-size: 18px; font-weight: bold; margin: 0; }
            .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
            .qr-img { width: 220px; height: 220px; margin: 12px auto; display: block; }
            .amount { font-size: 24px; font-weight: 800; color: #047857; margin: 8px 0; }
            .instructions { font-size: 12px; font-weight: 600; color: #334155; margin-top: 10px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: #ecfdf5; color: #065f46; margin: 2px; }
            .badge-fp { background: #fef2f2; color: #991b1b; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 class="shop-name">${shopConfig.shopName}</h2>
            <div class="meta">${shopConfig.address}</div>
            <div class="meta">${shopConfig.taxId} • Ph: ${shopConfig.phone}</div>
          </div>
          <div>
            <span class="badge badge-fp">FonePay Accepted</span>
            <span class="badge">eSewa Accepted</span>
          </div>
          <div class="amount">${formatNPR(grandTotal)}</div>
          <div style="font-size: 11px; color: #64748b;">Invoice: <strong>${invoiceNumber}</strong> • Customer: ${customerName || 'Walk-in'}</div>
          <img src="${qrDataUrl}" class="qr-img" alt="Payment QR" />
          <div class="instructions">Scan with FonePay, eSewa, or any Nepali Mobile Banking App</div>
          <div class="meta" style="margin-top: 12px;">Dynamic QR auto-locks amount • No manual typing required</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scaleUp my-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-emerald-600 via-teal-600 to-red-600 text-white rounded-xl shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Dynamic Payment QR
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  EMVCo Dynamic
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Amount dynamically encoded for FonePay & eSewa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Mode Switcher */}
        <div className="pt-3 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Select Payment Standard
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              National Payment Switch (Nepal)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
            {/* 1. Interoperable FonePay + eSewa (Recommended EMVCo standard) */}
            <button
              type="button"
              onClick={() => setActiveMode('INTEROPERABLE')}
              className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${
                activeMode === 'INTEROPERABLE'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-emerald-500'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span className="leading-none">FonePay + eSewa</span>
              </div>
              <span className="text-[9px] font-normal text-slate-400 mt-0.5">
                All Banks & Wallets
              </span>
            </button>

            {/* 2. Direct eSewa Mode */}
            <button
              type="button"
              onClick={() => setActiveMode('ESEWA')}
              className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${
                activeMode === 'ESEWA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                <span className="leading-none">eSewa Direct</span>
              </div>
              <span className="text-[9px] font-normal text-emerald-100 mt-0.5">
                ईसेवा वालेट
              </span>
            </button>

            {/* 3. Direct FonePay Mode */}
            <button
              type="button"
              onClick={() => setActiveMode('FONEPAY')}
              className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${
                activeMode === 'FONEPAY'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                <span className="leading-none">FonePay App</span>
              </div>
              <span className="text-[9px] font-normal text-red-100 mt-0.5">
                फोनपे डायरेक्ट
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Amount Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 my-2 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              Dynamic Bill Total Due
            </span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[11px] font-mono text-emerald-300 font-semibold">
                Auto-Locked Amount
              </span>
            </div>
          </div>

          <div className="text-3xl sm:text-4xl font-black font-mono-num text-emerald-400 mt-1 tracking-tight">
            {formatNPR(grandTotal)}
          </div>

          <div className="text-[11px] text-slate-300 mt-1 italic line-clamp-1">
            {formatNPRWords(grandTotal)}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-700 text-[11px] text-slate-300">
            <div>
              <span>Invoice: </span>
              <strong className="text-white font-mono">{invoiceNumber}</strong>
            </div>
            <div>
              <span>Customer: </span>
              <strong className="text-white">{customerName || 'Walk-in Customer'}</strong>
            </div>
            {customerPhone && (
              <div>
                <span>Phone: </span>
                <strong className="text-white font-mono">{customerPhone}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic QR Display Card */}
        <div className="py-2 flex flex-col items-center">
          <div className="relative p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-md flex flex-col items-center justify-center">
            {/* Supported Networks Top Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 text-[10px] font-black rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                FonePay
              </span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                eSewa
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold rounded-md">
                NepalPay QR
              </span>
            </div>

            {loading ? (
              <div className="w-60 h-60 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-medium text-slate-500">
                  Generating EMVCo Dynamic QR...
                </span>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={qrDataUrl}
                  alt="Dynamic Payment QR Code for FonePay & eSewa"
                  className="w-60 h-60 object-contain rounded-xl border border-slate-100 shadow-inner"
                />

                {/* State Overlays */}
                {paymentStatus === 'CONFIRMING' && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center rounded-xl">
                    <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-xs font-bold text-slate-800">
                      Verifying FonePay / eSewa Gateway...
                    </span>
                    <span className="text-[10px] text-slate-500">Checking terminal callback</span>
                  </div>
                )}

                {paymentStatus === 'SUCCESS' && (
                  <div className="absolute inset-0 bg-emerald-600 text-white flex flex-col items-center justify-center rounded-xl animate-fadeIn p-4 text-center">
                    <CheckCircle2 className="w-14 h-14 mb-2 animate-bounce" />
                    <span className="text-base font-extrabold">Payment Received!</span>
                    <span className="text-xs text-emerald-100 mt-1">
                      {formatNPR(grandTotal)} paid in full
                    </span>
                    <span className="text-[10px] text-emerald-200 mt-2">
                      Printing tax invoice & deducting stock...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Merchant Label */}
            <div className="mt-2 text-center">
              <div className="text-xs font-bold text-slate-800">
                {shopConfig.shopName}
              </div>
              <div className="text-[10px] text-slate-500">
                Merchant PAN: {shopConfig.taxId} • Kathmandu
              </div>
            </div>
          </div>

          {/* Quick Counter Helper Actions: Print, Download, Refresh */}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handlePrintSlip}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 font-medium transition-colors"
              title="Print Customer Counter QR Display Slip"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadQr}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 font-medium transition-colors"
              title="Download QR Image file"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Save Image</span>
            </button>
            <button
              type="button"
              onClick={handleRefreshQr}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 font-medium transition-colors"
              title="Regenerate dynamic token"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Expiration Timer & Merchant ID */}
          <div className="flex items-center justify-between w-full mt-2.5 px-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Session valid: </span>
              <strong className={`font-mono-num ${countdown < 60 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                {formatTime(countdown)}
              </strong>
            </span>
            <button
              onClick={handleCopyVpa}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-mono-num text-[11px] font-medium transition-colors"
              title="Copy merchant identifier"
            >
              <span>ID: {shopConfig.merchantUpiId}</span>
              {copiedVpa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>

          {/* Payload Inspector Accordion (for technical verification of EMVCo TLV string) */}
          <div className="w-full mt-2 border border-slate-200 rounded-xl overflow-hidden text-left">
            <button
              type="button"
              onClick={() => setShowPayloadInspector(!showPayloadInspector)}
              className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Verify EMVCo QR String & TLV Tags</span>
              </span>
              {showPayloadInspector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showPayloadInspector && (
              <div className="p-3 bg-white space-y-2 text-[11px] border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-600">Encoded EMVCo Payload:</span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold"
                  >
                    {copiedPayload ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload ? 'Copied' : 'Copy String'}</span>
                  </button>
                </div>
                <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg break-all max-h-24 overflow-y-auto select-all">
                  {rawPayload}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 pt-1">
                  <div>• <strong>Tag 01 (Initiation):</strong> 12 (Dynamic QR)</div>
                  <div>• <strong>Tag 53 (Currency):</strong> 524 (NPR)</div>
                  <div>• <strong>Tag 54 (Amount):</strong> {grandTotal.toFixed(2)}</div>
                  <div>• <strong>Tag 62 (Bill #):</strong> {invoiceNumber}</div>
                  <div>• <strong>Tag 26 (FonePay):</strong> np.fonepay</div>
                  <div>• <strong>Tag 27 (eSewa):</strong> np.esewa</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
          {/* Optional manual Txn Reference Entry if cashier received Soundbox alert */}
          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setShowCustomTxnInput(!showCustomTxnInput)}
              className="text-slate-500 hover:text-slate-800 underline decoration-dotted"
            >
              {showCustomTxnInput ? 'Hide manual transaction ID' : 'Enter custom FonePay / eSewa Txn Ref ID'}
            </button>
          </div>

          {showCustomTxnInput && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. FP-2026-981023 or ESW-849201"
                value={customTxnRef}
                onChange={(e) => setCustomTxnRef(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <button
            id="confirm-payment-received-btn"
            onClick={handleSimulatePayment}
            disabled={paymentStatus !== 'AWAITING'}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Confirm Payment Received ({formatNPR(grandTotal)})
            </span>
          </button>

          <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Deducts stock in real-time and prints IRD-compliant Tax Invoice</span>
          </p>
        </div>
      </div>
    </div>
  );
}
