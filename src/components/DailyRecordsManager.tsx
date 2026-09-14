import React, { useState, useMemo } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Clock,
  UserCheck,
  Award,
  Search,
  Plus,
  FileSpreadsheet,
  Receipt,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Filter,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Tag,
  ShieldCheck,
  Smartphone,
  Trash2,
  Edit3,
} from 'lucide-react';
import { Invoice, InventoryItem, Customer, DailyOrderQuery, QueryCategory, QueryPriority, QueryStatus } from '../types';
import { formatNPR, formatNepaliDateTime, formatNPTTime, toBikramSambat, getTodayNPTString } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  invoices: Invoice[];
  inventory: InventoryItem[];
  customers: Customer[];
  queries: DailyOrderQuery[];
  onAddQuery: (query: DailyOrderQuery) => void;
  onUpdateQuery: (query: DailyOrderQuery) => void;
  onDeleteQuery: (queryId: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onNavigateToPosWithCustomer?: (customer: Customer, note?: string) => void;
  onExportDailySheet: (date: string, dayInvoices: Invoice[], dayQueries: DailyOrderQuery[]) => void;
}

export const DailyRecordsManager: React.FC<Props> = ({
  invoices,
  inventory,
  customers,
  queries,
  onAddQuery,
  onUpdateQuery,
  onDeleteQuery,
  onViewInvoice,
  onNavigateToPosWithCustomer,
  onExportDailySheet,
}) => {
  const toast = useToast();
  // Default to today in NPT
  const todayStr = useMemo(() => getTodayNPTString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'queries'>('sales');
  const [queryFilterStatus, setQueryFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddQueryModal, setShowAddQueryModal] = useState<boolean>(false);

  // New query form state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newDeviceModel, setNewDeviceModel] = useState('');
  const [newQueryType, setNewQueryType] = useState<QueryCategory>('PREORDER');
  const [newPriority, setNewPriority] = useState<QueryPriority>('MEDIUM');
  const [newBudget, setNewBudget] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStaff, setNewStaff] = useState('Counter Staff');

  // Filter invoices for selected date (match YYYY-MM-DD)
  const dayInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.date.startsWith(selectedDate));
  }, [invoices, selectedDate]);

  // Filter queries for selected date
  const dayQueries = useMemo(() => {
    return queries.filter((q) => q.date === selectedDate);
  }, [queries, selectedDate]);

  // All queries filtered by status & search
  const filteredDayQueries = useMemo(() => {
    return dayQueries.filter((q) => {
      const matchStatus = queryFilterStatus === 'ALL' || q.status === queryFilterStatus;
      const matchSearch =
        searchTerm === '' ||
        q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customerPhone.includes(searchTerm) ||
        q.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.notes.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [dayQueries, queryFilterStatus, searchTerm]);

  // Daily Financial Metrics
  const dailyMetrics = useMemo(() => {
    const totalSales = dayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalProfit = dayInvoices.reduce((sum, inv) => sum + inv.totalProfit, 0);
    const subtotal = dayInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const totalTax = dayInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
    const totalDiscount = dayInvoices.reduce((sum, inv) => sum + inv.discountAmount, 0);
    const invoiceCount = dayInvoices.length;
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    let unitsSold = 0;
    dayInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        unitsSold += it.quantity;
      });
    });

    const totalLoyaltyEarned = dayInvoices.reduce((sum, inv) => sum + (inv.loyaltyPointsEarned || 0), 0);
    const totalLoyaltyRedeemed = dayInvoices.reduce((sum, inv) => sum + (inv.loyaltyPointsRedeemed || 0), 0);

    const pendingQueriesCount = dayQueries.filter((q) => q.status === 'PENDING').length;

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      invoiceCount,
      profitMargin: Math.round(profitMargin * 10) / 10,
      unitsSold,
      totalLoyaltyEarned,
      totalLoyaltyRedeemed,
      pendingQueriesCount,
    };
  }, [dayInvoices, dayQueries]);

  // Daily Inventory Movement (aggregated items sold today)
  const dailyInventoryMovement = useMemo(() => {
    const map = new Map<
      string,
      {
        itemId: string;
        name: string;
        brand: string;
        sku: string;
        barcode: string;
        unitsSold: number;
        revenue: number;
        cost: number;
        profit: number;
        currentStock: number;
        reorderLevel: number;
      }
    >();

    dayInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const existing = map.get(item.itemId);
        const invItem = inventory.find((i) => i.id === item.itemId);
        const currentStock = invItem ? invItem.stockQuantity : 0;
        const reorderLevel = invItem ? invItem.reorderLevel : 3;

        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.total;
          existing.cost += item.costPrice * item.quantity;
          existing.profit += item.profit;
        } else {
          map.set(item.itemId, {
            itemId: item.itemId,
            name: item.name,
            brand: item.brand,
            sku: item.sku,
            barcode: item.barcode,
            unitsSold: item.quantity,
            revenue: item.total,
            cost: item.costPrice * item.quantity,
            profit: item.profit,
            currentStock,
            reorderLevel,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [dayInvoices, inventory]);

  // Selected date BS details
  const selectedBs = useMemo(() => toBikramSambat(selectedDate), [selectedDate]);

  // Handle Quick Date Change
  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Submit new Customer Query / Order
  const handleCreateQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim() || !newDeviceModel.trim()) {
      toast.warning('Please enter customer name, phone number, and device model.');
      return;
    }

    const nowNpt = new Date();
    const timeStr = formatNPTTime(nowNpt);
    const bs = toBikramSambat(selectedDate);

    const newQuery: DailyOrderQuery = {
      id: `qry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      time: timeStr,
      bsDate: bs.formattedBS,
      customerName: newCustName.trim(),
      customerPhone: newCustPhone.trim(),
      customerEmail: newCustEmail.trim() || undefined,
      queryType: newQueryType,
      deviceModel: newDeviceModel.trim(),
      estimatedBudget: newBudget ? parseFloat(newBudget) : undefined,
      notes: newNotes.trim(),
      priority: newPriority,
      status: 'PENDING',
      assignedStaff: newStaff.trim() || 'Counter Staff',
    };

    onAddQuery(newQuery);
    toast.success(`Customer order / query for "${newDeviceModel}" logged successfully.`);
    setShowAddQueryModal(false);

    // Reset fields
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewDeviceModel('');
    setNewBudget('');
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Day-to-Day Date Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-extrabold tracking-wider uppercase">
                नेपाल राष्ट्रिय मानक • Daily Register
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {selectedBs.formattedNp} ({selectedBs.formattedBS})
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Daily Sales, Inventory & Billing Record
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track day-to-day sales, customer bills, incremental loyalty points, stock movement, and customer order notes.
            </p>
          </div>

          {/* Date Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Date Chips */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSetQuickDate(0)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedDate === todayStr ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today (आज)
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(-1)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
              >
                Yesterday (हिजो)
              </button>
            </div>

            {/* Date Input with Bikram Sambat Tag */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={() => onExportDailySheet(selectedDate, dayInvoices, dayQueries)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Daily Register (Excel)</span>
            </button>

            {/* Log Query Button */}
            <button
              type="button"
              onClick={() => setShowAddQueryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Order / Query</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Daily Key Performance Indicator Cards (Nepalese Rupee रु) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daily Gross Sales (बिक्री)
            </span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {formatNPR(dailyMetrics.totalSales)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-700">{dailyMetrics.invoiceCount} Invoices</span>
              <span>•</span>
              <span>VAT: {formatNPR(dailyMetrics.totalTax)}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg border border-emerald-100">
            रु
          </div>
        </div>

        {/* Card 2: Gross Profit & Margin */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daily Gross Profit (नाफा)
            </span>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
              {formatNPR(dailyMetrics.totalProfit)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-bold text-emerald-800">{dailyMetrics.profitMargin}% margin</span>
              <span>•</span>
              <span>Discounts: {formatNPR(dailyMetrics.totalDiscount)}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Stock Movement */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock Units Sold (वस्तु निष्कासन)
            </span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {dailyMetrics.unitsSold} <span className="text-sm font-semibold text-slate-500">units</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {dailyInventoryMovement.length} distinct item line(s) sold today
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Loyalty Points & Customer Inquiries */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loyalty & Customer Notes
            </span>
            <div className="text-2xl font-black font-mono text-purple-700 mt-1">
              +{dailyMetrics.totalLoyaltyEarned} <span className="text-sm font-semibold text-slate-500">pts</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-purple-800">
                {dailyMetrics.pendingQueriesCount} Pending Query / Order(s)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Tabs: Sales & Billing Register | Daily Inventory Movement | Customer Orders & Queries */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-5 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'sales'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Day-to-Day Sales & Billing Register ({dayInvoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'inventory'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Inventory Movement ({dailyInventoryMovement.length} items)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queries')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'queries'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Customer Orders & Queries Notes ({dayQueries.length})</span>
            </button>
          </div>

          <div className="pb-3 text-xs text-slate-500 font-medium">
            Showing records for: <span className="font-bold text-slate-800">{selectedDate} ({selectedBs.formattedBS})</span>
          </div>
        </div>

        {/* Tab 1: Day-to-Day Sales & Billing Register with Auto-Incremental Loyalty */}
        {activeTab === 'sales' && (
          <div className="p-5">
            {dayInvoices.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Sales Invoiced for {selectedDate}</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  There are no billed transactions logged on this day. Switch dates above or ring up a new customer in the POS Billing Terminal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50/75">
                      <th className="py-3 px-3">Invoice & Time</th>
                      <th className="py-3 px-3">Customer Details</th>
                      <th className="py-3 px-3">Items Sold & IMEIs</th>
                      <th className="py-3 px-3 text-center">Payment Mode</th>
                      <th className="py-3 px-3 text-right">Subtotal</th>
                      <th className="py-3 px-3 text-right">13% VAT</th>
                      <th className="py-3 px-3 text-right">Discount</th>
                      <th className="py-3 px-3 text-right">Grand Total (रु)</th>
                      <th className="py-3 px-3 text-right">Gross Profit</th>
                      <th className="py-3 px-3 text-center">Loyalty Incremental Status</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dayInvoices.map((inv) => {
                      const cust = customers.find((c) => c.id === inv.customerId || c.phone === inv.customerPhone);
                      const isExistingMember = Boolean(cust || inv.customerId);
                      const earned = inv.loyaltyPointsEarned || Math.floor(inv.grandTotal / 1000);
                      const redeemed = inv.loyaltyPointsRedeemed || 0;
                      const prevPoints = inv.customerPreviousPoints ?? (cust ? cust.loyaltyPoints - earned + redeemed : 0);
                      const newPoints = inv.customerNewPoints ?? (cust ? cust.loyaltyPoints : earned);

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Invoice & Time */}
                          <td className="py-3.5 px-3">
                            <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatNPTTime(inv.date)}</span>
                            </div>
                          </td>

                          {/* Customer Details */}
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{inv.customerName || 'Walk-in Customer'}</span>
                              {isExistingMember ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
                                  Member
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                  Walk-in
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{inv.customerPhone || 'N/A'}</span>
                            </div>
                          </td>

                          {/* Items Sold */}
                          <td className="py-3.5 px-3 max-w-[220px]">
                            <div className="space-y-1">
                              {inv.items.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700 leading-tight">
                                  <span className="font-bold text-slate-900">{it.quantity}x</span> {it.name}
                                  {it.imeiList && it.imeiList.length > 0 && (
                                    <div className="text-[10px] font-mono text-slate-500">
                                      IMEI: {it.imeiList.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Payment Mode */}
                          <td className="py-3.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                inv.paymentMethod === 'UPI_QR'
                                  ? 'bg-blue-100 text-blue-800'
                                  : inv.paymentMethod === 'CASH'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.paymentMethod === 'CARD'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.paymentMethod === 'UPI_QR' ? 'FonePay / QR' : inv.paymentMethod}
                            </span>
                          </td>

                          {/* Subtotal */}
                          <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                            {formatNPR(inv.subtotal)}
                          </td>

                          {/* VAT */}
                          <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                            {formatNPR(inv.taxAmount)}
                          </td>

                          {/* Discount */}
                          <td className="py-3.5 px-3 text-right font-mono text-amber-700 font-medium">
                            {inv.discountAmount > 0 ? `-${formatNPR(inv.discountAmount)}` : '—'}
                          </td>

                          {/* Grand Total */}
                          <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 text-sm">
                            {formatNPR(inv.grandTotal)}
                          </td>

                          {/* Profit */}
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatNPR(inv.totalProfit)}
                          </td>

                          {/* Auto Incremental Loyalty Points Status */}
                          <td className="py-3.5 px-3 text-center">
                            {isExistingMember ? (
                              <div className="inline-flex flex-col items-center bg-purple-50/80 border border-purple-200/80 rounded-xl px-2.5 py-1.5">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-purple-900">
                                  <span className="text-slate-500 font-mono">{prevPoints}</span>
                                  <span className="text-emerald-700 font-black">+{earned}</span>
                                  {redeemed > 0 && <span className="text-red-600 font-black">-{redeemed}</span>}
                                  <span>=</span>
                                  <span className="font-mono font-black text-purple-900">{newPoints} pts</span>
                                </div>
                                <div className="text-[10px] text-purple-700 font-semibold flex items-center gap-1 mt-0.5">
                                  <Award className="w-2.5 h-2.5" />
                                  <span>{cust?.tier || 'Silver Tier'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Non-member</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onViewInvoice(inv)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors title='View Tax Invoice'"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Daily Inventory Movement & Stock Log */}
        {activeTab === 'inventory' && (
          <div className="p-5">
            {dailyInventoryMovement.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Inventory Movement Logged for {selectedDate}</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  No stock was deducted via checkout on this day.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-50/75">
                      <th className="py-3 px-3">Item Description</th>
                      <th className="py-3 px-3">Brand / SKU</th>
                      <th className="py-3 px-3 text-center">Units Sold Today</th>
                      <th className="py-3 px-3 text-right">Revenue Generated</th>
                      <th className="py-3 px-3 text-right">Cost (COGS)</th>
                      <th className="py-3 px-3 text-right">Realized Profit</th>
                      <th className="py-3 px-3 text-center">Shelf Stock Remaining</th>
                      <th className="py-3 px-3 text-center">Stock Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {dailyInventoryMovement.map((m) => (
                      <tr key={m.itemId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{m.name}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-700">{m.brand}</span>
                          <span className="text-[11px] text-slate-400 font-mono block">{m.sku}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-slate-900 text-sm">
                          {m.unitsSold}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {formatNPR(m.revenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {formatNPR(m.cost)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatNPR(m.profit)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {m.currentStock} units
                        </td>
                        <td className="py-3 px-3 text-center">
                          {m.currentStock <= 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-800">
                              Out of Stock
                            </span>
                          ) : m.currentStock <= m.reorderLevel ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              Low Stock Alert
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Adequate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Customer Orders & Queries Notes */}
        {activeTab === 'queries' && (
          <div className="p-5 space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search query by customer, phone, device..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                </div>

                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  {['ALL', 'PENDING', 'FOLLOWED_UP', 'FULFILLED', 'CANCELLED'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setQueryFilterStatus(st)}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        queryFilterStatus === st
                          ? 'bg-white text-slate-900 shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddQueryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Log Customer Query / Order</span>
              </button>
            </div>

            {/* Queries Card Grid */}
            {filteredDayQueries.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Customer Orders or Queries Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Staff can log customer product requests, iPhone/Galaxy pre-orders, repair quotes, and reservation notes here.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddQueryModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log First Query / Order</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDayQueries.map((q) => {
                  const cust = customers.find((c) => c.phone === q.customerPhone || c.name === q.customerName);

                  return (
                    <div
                      key={q.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all"
                    >
                      <div>
                        {/* Badges: Query Type & Priority */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              q.queryType === 'PREORDER'
                                ? 'bg-purple-100 text-purple-800'
                                : q.queryType === 'REPAIR_SERVICE'
                                ? 'bg-amber-100 text-amber-800'
                                : q.queryType === 'STOCK_RESERVATION'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {q.queryType.replace('_', ' ')}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              q.priority === 'URGENT'
                                ? 'bg-red-100 text-red-800 animate-pulse'
                                : q.priority === 'HIGH'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {q.priority}
                          </span>
                        </div>

                        {/* Device / Product requested */}
                        <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{q.deviceModel}</span>
                        </h4>

                        {/* Budget */}
                        {q.estimatedBudget && (
                          <div className="text-xs font-mono font-bold text-emerald-700 mt-1">
                            Est. Budget: {formatNPR(q.estimatedBudget)}
                          </div>
                        )}

                        {/* Notes */}
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2.5 leading-relaxed">
                          {q.notes}
                        </p>

                        {/* Customer details */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-800">{q.customerName}</div>
                            <div className="font-mono text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <a href={`tel:${q.customerPhone}`} className="hover:underline hover:text-blue-600">
                                {q.customerPhone}
                              </a>
                            </div>
                          </div>
                          <div className="text-right text-[10px] text-slate-400 font-mono">
                            <div>{q.time}</div>
                            <div>{q.assignedStaff || 'Staff'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Status Switcher & Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {/* Status Select */}
                        <select
                          value={q.status}
                          onChange={(e) => {
                            const newSt = e.target.value as QueryStatus;
                            onUpdateQuery({
                              ...q,
                              status: newSt,
                              followedUpAt:
                                newSt === 'FOLLOWED_UP' || newSt === 'FULFILLED'
                                  ? new Date().toISOString()
                                  : q.followedUpAt,
                            });
                            toast.info(`Query marked as ${newSt.replace('_', ' ')}`);
                          }}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none ${
                            q.status === 'FULFILLED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : q.status === 'FOLLOWED_UP'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : q.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="FOLLOWED_UP">Followed Up</option>
                          <option value="FULFILLED">Fulfilled</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>

                        <div className="flex items-center gap-1">
                          {/* Transfer to POS Button */}
                          {onNavigateToPosWithCustomer && cust && (
                            <button
                              type="button"
                              onClick={() => onNavigateToPosWithCustomer(cust, `Query Note: ${q.deviceModel}`)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition-colors"
                              title="Ring up in POS"
                            >
                              Bill in POS
                            </button>
                          )}

                          {/* Delete Query */}
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteQuery(q.id);
                              toast.info('Query note removed');
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete query"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Log New Customer Order / Query */}
      {showAddQueryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">
                  Nepalese Retail Log
                </span>
                <h3 className="text-lg font-black text-slate-900">Log Customer Order / Query Note</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQueryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuerySubmit} className="space-y-4 mt-4 text-xs">
              {/* Customer Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suman Shrestha"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9851044332"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Query Type & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Query / Order Type</label>
                  <select
                    value={newQueryType}
                    onChange={(e) => setNewQueryType(e.target.value as QueryCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="PREORDER">Pre-order / New Model</option>
                    <option value="SPECIAL_REQUEST">Special Device Request</option>
                    <option value="PRICE_ENQUIRY">Price / Warranty Enquiry</option>
                    <option value="REPAIR_SERVICE">Repair / Display Service</option>
                    <option value="STOCK_RESERVATION">Counter Stock Hold</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as QueryPriority)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent (VIP / Pre-paid)</option>
                  </select>
                </div>
              </div>

              {/* Device Model & Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Device Model / Gadget *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. iPhone 16 Pro 256GB"
                    value={newDeviceModel}
                    onChange={(e) => setNewDeviceModel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estimated Budget (रु)</label>
                  <input
                    type="number"
                    placeholder="e.g. 185000"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Staff Assigned */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Counter Staff</label>
                <input
                  type="text"
                  placeholder="e.g. Pradeep (Counter 1)"
                  value={newStaff}
                  onChange={(e) => setNewStaff(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Requirement Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Requirements & Notes</label>
                <textarea
                  rows={3}
                  placeholder="Specific color, storage, delivery deadline, or warranty details..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQueryModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs"
                >
                  Save Query Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
