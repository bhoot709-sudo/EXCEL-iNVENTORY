import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Receipt, 
  Phone, 
  Plus, 
  X, 
  CreditCard,
  QrCode,
  Banknote,
  UserCheck,
  Printer
} from 'lucide-react';
import { Customer } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSettleCustomerDue: (customerId: string, amountSettled: number, paymentMethod: string, notes?: string) => void;
  onAddCustomerCredit?: (customerId: string, creditAmount: number, notes?: string) => void;
  onSelectCustomerForSale?: (customer: Customer) => void;
}

export function CustomerDuesModal({
  isOpen,
  onClose,
  customers,
  onSettleCustomerDue,
  onAddCustomerCredit,
  onSelectCustomerForSale,
}: Props) {
  const toast = useToast();
  const [filterMode, setFilterMode] = useState<'due-only' | 'all'>('due-only');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payment settlement state
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI_QR' | 'CARD'>('CASH');
  const [settleNotes, setSettleNotes] = useState<string>('Counter Cash Settle');

  // New credit entry state
  const [showAddCreditModal, setShowAddCreditModal] = useState<boolean>(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [newCreditAmount, setNewCreditAmount] = useState<string>('');
  const [creditReason, setCreditReason] = useState<string>('Accessories purchased on credit (उधारो)');

  // Last settlement receipt popup state
  const [receiptData, setReceiptData] = useState<{
    customerName: string;
    phone: string;
    amountPaid: number;
    prevDue: number;
    remainingDue: number;
    method: string;
    date: string;
    receiptNo: string;
  } | null>(null);

  // Filter customers
  const customersWithDues = useMemo(() => {
    return customers.filter((c) => (c.dueAmount || 0) > 0);
  }, [customers]);

  const totalOutstandingDue = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.dueAmount || 0), 0);
  }, [customers]);

  const displayedCustomers = useMemo(() => {
    let list = filterMode === 'due-only' ? customersWithDues : customers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return list;
  }, [filterMode, customersWithDues, customers, searchQuery]);

  // Open Settle dialog
  const handleOpenSettle = (c: Customer) => {
    setSettlingCustomer(c);
    setSettleAmount((c.dueAmount || 0).toString());
    setPaymentMethod('CASH');
    setSettleNotes('Counter settlement');
  };

  // Submit Settle
  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomer) return;

    const amount = parseFloat(settleAmount) || 0;
    if (amount <= 0) {
      toast.warning('Please enter an amount greater than 0.');
      return;
    }

    const currentDue = settlingCustomer.dueAmount || 0;
    const remaining = Math.max(0, currentDue - amount);

    onSettleCustomerDue(settlingCustomer.id, amount, paymentMethod, settleNotes);

    // Save receipt data
    const rNo = `DUE-REC-${Date.now().toString().slice(-6)}`;
    setReceiptData({
      customerName: settlingCustomer.name,
      phone: settlingCustomer.phone,
      amountPaid: amount,
      prevDue: currentDue,
      remainingDue: remaining,
      method: paymentMethod,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      receiptNo: rNo,
    });

    toast.success(
      `Settled ${formatNPR(amount)} for ${settlingCustomer.name}. Remaining due: ${formatNPR(remaining)}`,
      'Due Payment Settled'
    );

    setSettlingCustomer(null);
  };

  // Submit New Credit Entry
  const handleConfirmAddCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCustomer) return;

    const amount = parseFloat(newCreditAmount) || 0;
    if (amount <= 0) {
      toast.warning('Please enter a valid credit amount.');
      return;
    }

    if (onAddCustomerCredit) {
      onAddCustomerCredit(creditCustomer.id, amount, creditReason);
      toast.success(
        `Added credit of ${formatNPR(amount)} to ${creditCustomer.name}.`,
        'Credit Recorded'
      );
    }

    setShowAddCreditModal(false);
    setCreditCustomer(null);
    setNewCreditAmount('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Customer Due Balances (उधारो Ledger)</h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
                  Daily Routine Task
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Track outstanding credit, settle customer payments with instant receipts, and update credit balances.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats Banner */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-orange-500/10 border-b border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-2xs">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-800">Total Outstanding Dues</div>
              <div className="text-lg font-black font-mono text-amber-950">
                {formatNPR(totalOutstandingDue)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-600/80 text-white shadow-2xs">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-800">Customers with Dues</div>
              <div className="text-lg font-black font-mono text-amber-950">
                {customersWithDues.length} of {customers.length}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setCreditCustomer(customers[0] || null);
                setShowAddCreditModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record New Credit (उधारो)</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterMode('due-only')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'due-only'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Dues Only ({customersWithDues.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Customers ({customers.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Customers List Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {displayedCustomers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-bold text-slate-700">No Outstanding Due Balances!</p>
              <p className="text-xs text-slate-400 mt-1">
                {filterMode === 'due-only'
                  ? 'All customer credit accounts are fully cleared and settled.'
                  : 'No customer matches your search query.'}
              </p>
            </div>
          ) : (
            displayedCustomers.map((c) => {
              const due = c.dueAmount || 0;
              const hasDue = due > 0;

              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    hasDue
                      ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Customer Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.tier}
                      </span>
                      {hasDue && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 animate-pulse">
                          Pending Credit
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{c.phone}</span>
                      </span>
                      {c.address && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-xs">{c.address}</span>
                        </>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-[11px] text-slate-500 mt-1 italic">
                        &ldquo;{c.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Due Amount & Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Due Balance
                      </span>
                      <span className={`font-mono font-black text-base ${hasDue ? 'text-amber-700' : 'text-slate-400'}`}>
                        {formatNPR(due)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasDue && (
                        <button
                          type="button"
                          onClick={() => handleOpenSettle(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Settle Payment</span>
                        </button>
                      )}

                      {onSelectCustomerForSale && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCustomerForSale(c);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                          title="Start sale for this customer"
                        >
                          <span>New Sale</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Total registered customer accounts: <strong className="text-slate-800">{customers.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>

        {/* Settle Payment Dialog Modal */}
        {settlingCustomer && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Settle Customer Due</h4>
                    <p className="text-xs text-slate-500">{settlingCustomer.name} • {settlingCustomer.phone}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Outstanding Due Callout */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Current Outstanding:</span>
                <span className="font-mono font-black text-base text-amber-950">
                  {formatNPR(settlingCustomer.dueAmount || 0)}
                </span>
              </div>

              <form onSubmit={handleConfirmSettle} className="space-y-4">
                {/* Amount Paying */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Settlement Amount Paying (रु)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={settlingCustomer.dueAmount || undefined}
                    step="any"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full text-center font-mono font-black text-lg py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setSettleAmount((settlingCustomer.dueAmount || 0).toString())}
                      className="flex-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      Full Pay (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettleAmount((Math.round((settlingCustomer.dueAmount || 0) * 0.5)).toString())}
                      className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                    >
                      Half (50%)
                    </button>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                        paymentMethod === 'CASH'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI_QR')}
                      className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                        paymentMethod === 'UPI_QR'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>FonePay / QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                        paymentMethod === 'CARD'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>POS Card</span>
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Settlement Notes
                  </label>
                  <input
                    type="text"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="e.g. Cleared pending invoice balance"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettlingCustomer(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Confirm Settlement
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record New Credit Dialog Modal */}
        {showAddCreditModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Record New Credit (उधारो)</h4>
                    <p className="text-xs text-slate-500">Add an outstanding due to a customer ledger</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCreditModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmAddCredit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Customer
                  </label>
                  <select
                    value={creditCustomer?.id || ''}
                    onChange={(e) => {
                      const found = customers.find((c) => c.id === e.target.value);
                      setCreditCustomer(found || null);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - Current Due: {formatNPR(c.dueAmount || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Credit Amount (रु) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 5000"
                    value={newCreditAmount}
                    onChange={(e) => setNewCreditAmount(e.target.value)}
                    className="w-full text-center font-mono font-black text-lg py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason / Bill Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g. Screen repair balance pending"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCreditModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Add Credit to Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Printable Payment Settlement Receipt */}
        {receiptData && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-sm space-y-4">
              <div className="text-center border-b border-slate-200 pb-3">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <h4 className="font-bold text-slate-900 text-sm">Due Payment Receipt</h4>
                <p className="text-[11px] text-slate-500">Official Credit Settlement Voucher</p>
                <p className="font-mono text-[10px] text-slate-400 mt-0.5">{receiptData.receiptNo}</p>
              </div>

              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{receiptData.customerName}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-700">{receiptData.phone}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Previous Balance:</span>
                  <span className="font-mono text-slate-700">{formatNPR(receiptData.prevDue)}</span>
                </div>
                <div className="flex justify-between pt-1 bg-emerald-50 px-2 py-1 rounded">
                  <span className="font-bold text-emerald-800">Amount Paid:</span>
                  <span className="font-mono font-black text-emerald-900">{formatNPR(receiptData.amountPaid)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Remaining Balance:</span>
                  <span className="font-mono font-bold text-amber-800">{formatNPR(receiptData.remainingDue)}</span>
                </div>
                <div className="flex justify-between pt-1 text-[11px] text-slate-400">
                  <span>Method / Time:</span>
                  <span>{receiptData.method} • {receiptData.date}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptData(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
