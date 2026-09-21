import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Award, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  Star, 
  Edit3, 
  Trash2, 
  Receipt, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard,
  Gift,
  ExternalLink,
  ChevronRight,
  Filter,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Customer, CustomerTier, Invoice } from '../types';
import { useToast } from './Toast';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  customers: Customer[];
  invoices: Invoice[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onAdjustPoints: (customerId: string, delta: number, reason?: string) => void;
  onSelectForSale: (customer: Customer) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onOpenCustomerDuesModal?: () => void;
}

export function CustomersManager({
  customers,
  invoices,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAdjustPoints,
  onSelectForSale,
  onViewInvoice,
  onOpenCustomerDuesModal,
}: Props) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(
    customers.length > 0 ? customers[0].id : null
  );
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Auto-select first customer if active customer gets deleted or when customers populate
  React.useEffect(() => {
    if (customers.length > 0 && (!activeCustomerId || !customers.some(c => c.id === activeCustomerId))) {
      setActiveCustomerId(customers[0].id);
    }
  }, [customers, activeCustomerId]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showPointsModal, setShowPointsModal] = useState<Customer | null>(null);
  const [pointsDelta, setPointsDelta] = useState<number>(50);
  const [pointsReason, setPointsReason] = useState<string>('In-store Loyalty Reward');

  // New/Edit Customer Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPoints, setFormPoints] = useState<number>(0);
  const [formDueAmount, setFormDueAmount] = useState<number>(0);
  const [formTier, setFormTier] = useState<CustomerTier>('Bronze');

  const openAddModal = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormNotes('');
    setFormPoints(0);
    setFormDueAmount(0);
    setFormTier('Bronze');
    setEditingCustomer(null);
    setShowAddModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormPoints(c.loyaltyPoints);
    setFormDueAmount(c.dueAmount || 0);
    setFormTier(c.tier);
    setShowAddModal(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      toast.warning('Please provide customer name and phone number.');
      return;
    }

    const trimmedPhone = formPhone.trim();
    const normalizedPhone = trimmedPhone.replace(/\D/g, '');
    const trimmedEmail = formEmail.trim().toLowerCase();

    // Deduplication check: verify no other customer has the same phone number
    const duplicatePhone = customers.find(
      (c) =>
        (!editingCustomer || c.id !== editingCustomer.id) &&
        c.phone.replace(/\D/g, '') === normalizedPhone &&
        normalizedPhone.length >= 7
    );

    if (duplicatePhone) {
      toast.error(
        `Duplicate Customer! Phone "${trimmedPhone}" already belongs to "${duplicatePhone.name}" (${duplicatePhone.tier} Tier).`,
        'Duplicate Phone Number'
      );
      return;
    }

    // Deduplication check: verify no other customer has the same email
    if (trimmedEmail) {
      const duplicateEmail = customers.find(
        (c) =>
          (!editingCustomer || c.id !== editingCustomer.id) &&
          c.email &&
          c.email.trim().toLowerCase() === trimmedEmail
      );
      if (duplicateEmail) {
        toast.error(
          `Duplicate Customer! Email "${trimmedEmail}" is already registered to "${duplicateEmail.name}".`,
          'Duplicate Email'
        );
        return;
      }
    }

    if (editingCustomer) {
      const updated: Customer = {
        ...editingCustomer,
        name: formName.trim(),
        phone: trimmedPhone,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
        loyaltyPoints: Number(formPoints) || 0,
        dueAmount: Number(formDueAmount) || 0,
        tier: formTier,
      };
      onUpdateCustomer(updated);
      setRecentlyAddedId(updated.id);
      setTimeout(() => setRecentlyAddedId(null), 6000);
      toast.success(`Customer "${updated.name}" updated successfully.`);
    } else {
      const newCust: Customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: formName.trim(),
        phone: trimmedPhone,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
        loyaltyPoints: Number(formPoints) || 0,
        dueAmount: Number(formDueAmount) || 0,
        tier: formTier,
        createdAt: new Date().toISOString().split('T')[0],
      };
      onAddCustomer(newCust);
      setActiveCustomerId(newCust.id);
      setRecentlyAddedId(newCust.id);
      setTimeout(() => setRecentlyAddedId(null), 6000);
      toast.success(`New customer "${newCust.name}" registered successfully.`);
    }

    setShowAddModal(false);
  };

  // Helper to get purchase history for a customer
  const getCustomerInvoices = (customer: Customer): Invoice[] => {
    return invoices.filter(
      (inv) =>
        (inv.customerId && inv.customerId === customer.id) ||
        (inv.customerPhone && inv.customerPhone === customer.phone) ||
        (inv.customerName && inv.customerName.toLowerCase() === customer.name.toLowerCase())
    );
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesTier = true;
      if (selectedTier === 'With Dues') {
        matchesTier = (c.dueAmount || 0) > 0;
      } else if (selectedTier !== 'All') {
        matchesTier = c.tier === selectedTier;
      }
      return matchesSearch && matchesTier;
    });
  }, [customers, searchQuery, selectedTier]);

  // Active customer object
  const activeCustomer = useMemo(() => {
    return customers.find((c) => c.id === activeCustomerId) || customers[0] || null;
  }, [customers, activeCustomerId]);

  const activeCustomerInvoices = useMemo(() => {
    return activeCustomer ? getCustomerInvoices(activeCustomer) : [];
  }, [activeCustomer, invoices]);

  const activeCustomerTotalSpent = useMemo(() => {
    return activeCustomerInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  }, [activeCustomerInvoices]);

  // Overall Directory Metrics
  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    const totalPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
    const vipCount = customers.filter(
      (c) => c.tier === 'VIP Platinum' || c.tier === 'Gold'
    ).length;

    const totalLoyaltyRevenue = invoices.reduce((sum, inv) => {
      const isKnown = customers.some(
        (c) =>
          c.id === inv.customerId ||
          c.phone === inv.customerPhone ||
          c.name.toLowerCase() === inv.customerName?.toLowerCase()
      );
      return isKnown ? sum + (inv.grandTotal || 0) : sum;
    }, 0);

    return { totalCustomers, totalPoints, vipCount, totalLoyaltyRevenue };
  }, [customers, invoices]);

  const getTierColor = (tier: CustomerTier) => {
    switch (tier) {
      case 'VIP Platinum':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'Gold':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'Silver':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'Bronze':
      default:
        return 'bg-orange-100 text-orange-900 border-orange-200';
    }
  };

  const getAvatarBg = (tier: CustomerTier) => {
    switch (tier) {
      case 'VIP Platinum':
        return 'bg-purple-600 text-white';
      case 'Gold':
        return 'bg-amber-500 text-white';
      case 'Silver':
        return 'bg-slate-600 text-white';
      case 'Bronze':
      default:
        return 'bg-orange-600 text-white';
    }
  };

  const tierTranslations: Record<string, string> = {
    'All': 'सबै ग्राहकहरू (All Customers)',
    'VIP Platinum': 'भीआईपी प्लेटिनम सदस्य (VIP)',
    'Gold': 'गोल्ड सदस्य (Gold)',
    'Silver': 'सिल्भर सदस्य (Silver)',
    'Bronze': 'ब्रोन्ज सदस्य (Bronze)',
    'With Dues': 'उधारो बाँकी भएका (With Unsettled Dues)',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Customers</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-2 flex items-center gap-2">
            <span>{metrics.totalCustomers}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Live Sync
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            दर्ता भएका ग्राहकहरू (Real-time Cloud Sync)
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Loyalty Points Active</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Star className="w-4 h-4 fill-amber-500" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono-num text-amber-600 mt-2">
            ★ {metrics.totalPoints.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            काउन्टरमा भुक्तानी गर्दा प्रयोग योग्य (Redeemable)
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>VIP & Gold Members</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono-num text-purple-700 mt-2">
            {metrics.vipCount} Members
          </div>
          <div className="text-xs text-slate-500 mt-1">
            उच्च कारोबार गर्ने सदस्यहरू (VIP Members)
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Member Lifetime Sales</span>
            <span className="p-1 px-2 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-xs">
              रु
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-2">
            {formatNPR(metrics.totalLoyaltyRevenue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            दर्ता ग्राहकहरूको कुल कारोबार (Lifetime Revenue)
          </div>
        </div>
      </div>

      {/* Main Content: Search Bar & Two-Column Master Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Customer List & Directory (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Customer Directory
                  </h2>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {filteredCustomers.length} of {customers.length} total customers
                </p>
              </div>
            </div>
            <button
              onClick={openAddModal}
              title="नयाँ ग्राहक थप्नुहोस् (Add Customer)"
              className="group relative px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Customer</span>
              {/* Tooltip on pointer hover */}
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2.5 py-0.5 bg-slate-900 text-emerald-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                नयाँ ग्राहक दर्ता गर्नुहोस्
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email, address..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Tier Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-semibold">
            {['All', 'VIP Platinum', 'Gold', 'Silver', 'Bronze', 'With Dues'].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                title={`${tierTranslations[tier] || tier} अनुसार फिल्टर गर्नुहोस्`}
                className={`group relative px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  selectedTier === tier
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tier}</span>
                {/* Floating Nepali Translation tooltip on hover */}
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900/95 text-emerald-300 text-[10px] font-semibold rounded-md whitespace-nowrap shadow-md border border-slate-700">
                  {tierTranslations[tier] || tier}
                </span>
              </button>
            ))}
          </div>

          {/* Customer Cards List */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">No Customers Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Try adjusting search filter or click "Add Customer"
                </p>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = activeCustomer?.id === c.id;
                const isRecentlyAdded = recentlyAddedId === c.id;
                const custInvoices = getCustomerInvoices(c);
                const spent = custInvoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCustomerId(c.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isRecentlyAdded
                        ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-300/50 shadow-sm'
                        : isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${getAvatarBg(
                          c.tier
                        )}`}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {c.name}
                          </h4>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${getTierColor(
                              c.tier
                            )}`}
                          >
                            {c.tier}
                          </span>
                          {isRecentlyAdded && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-extrabold animate-pulse">
                              ✨ New
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono-num text-slate-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end font-mono-num font-bold text-xs text-amber-600">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{c.loyaltyPoints} pts</span>
                      </div>
                      {(c.dueAmount || 0) > 0 ? (
                        <div className="text-[10px] font-mono-num font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Due: {formatNPR(c.dueAmount || 0)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-mono-num mt-0.5">
                          {custInvoices.length} orders • {formatNPR(spent)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Active Customer Profile & Purchase History (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activeCustomer ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-md ${getAvatarBg(
                      activeCustomer.tier
                    )}`}
                  >
                    {activeCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900">
                        {activeCustomer.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${getTierColor(
                          activeCustomer.tier
                        )}`}
                      >
                        {activeCustomer.tier} Member
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {activeCustomer.phone}
                      </span>
                      {activeCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {activeCustomer.email}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => onSelectForSale(activeCustomer)}
                    className="group relative px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    title="यो ग्राहकको लागि पीओएस बिलिङ सुरु गर्नुहोस् (Bill in POS)"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Bill in POS</span>
                    {/* Hover tooltip */}
                    <span className="pointer-events-none absolute -top-8 right-0 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-emerald-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                      पीओएस बिलिङ (Bill in POS)
                    </span>
                  </button>
                  <button
                    onClick={() => openEditModal(activeCustomer)}
                    className="group relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="ग्राहक विवरण सम्पादन गर्नुहोस् (Edit Customer Profile)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap shadow-md">
                      सम्पादन (Edit)
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete customer "${activeCustomer.name}"?`)) {
                        onDeleteCustomer(activeCustomer.id);
                      }
                    }}
                    className="group relative p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="ग्राहक रेकर्ड मेटाउनुहोस् (Delete Customer Record)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="pointer-events-none absolute -top-8 right-0 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-rose-900 text-rose-100 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-rose-700">
                      मेटाउनुहोस् (Delete)
                    </span>
                  </button>
                </div>
              </div>

              {/* Loyalty Wallet & Quick Adjust Bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      Apex Gadgets Loyalty Rewards Wallet
                    </span>
                    <div className="text-3xl font-black font-mono-num text-white mt-1">
                      {activeCustomer.loyaltyPoints}{' '}
                      <span className="text-sm font-semibold text-slate-300">Points Available (सञ्चित पोइन्टहरू)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowPointsModal(activeCustomer);
                        setPointsDelta(50);
                      }}
                      className="group relative px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                      title="लोयल्टी पोइन्ट थपघट गर्नुहोस् (Adjust Loyalty Points)"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>Adjust Points</span>
                      {/* Tooltip on hover */}
                      <span className="pointer-events-none absolute -top-8 right-0 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-amber-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                        पोइन्ट मिलाउनुहोस् (Adjust Points)
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Reward Value (सञ्चित रकम)</span>
                    <span className="font-bold text-emerald-400 font-mono-num">
                      {formatNPR(activeCustomer.loyaltyPoints * 10)} Store Credit
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Earn Rule (कमाउने नियम)</span>
                    <span className="font-semibold text-slate-200">1 pt per रु 1,000 spent</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Member Since (दर्ता मिति)</span>
                    <span className="font-mono-num text-slate-200">{activeCustomer.createdAt}</span>
                  </div>
                </div>
              </div>

              {/* Customer Due Balance / Credit Status */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                (activeCustomer.dueAmount || 0) > 0 
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-500">
                    Customer Due Balance (उधारो खाता)
                  </span>
                  <div className={`text-xl font-black font-mono-num mt-0.5 ${
                    (activeCustomer.dueAmount || 0) > 0 ? 'text-amber-950' : 'text-slate-800'
                  }`}>
                    {formatNPR(activeCustomer.dueAmount || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {(activeCustomer.dueAmount || 0) > 0 
                      ? 'Outstanding credit pending counter payment settlement' 
                      : 'Clear account with no pending dues'}
                  </span>
                </div>
                {onOpenCustomerDuesModal && (
                  <button
                    type="button"
                    onClick={onOpenCustomerDuesModal}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs self-start sm:self-auto"
                  >
                    Manage Dues (उधारो व्यवस्थापन)
                  </button>
                )}
              </div>

              {/* Customer Info & Notes */}
              {(activeCustomer.address || activeCustomer.notes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {activeCustomer.address && (
                    <div>
                      <span className="font-bold text-slate-500 flex items-center gap-1 text-[11px] mb-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        Delivery / Billing Address:
                      </span>
                      <p className="text-slate-800">{activeCustomer.address}</p>
                    </div>
                  )}
                  {activeCustomer.notes && (
                    <div>
                      <span className="font-bold text-slate-500 flex items-center gap-1 text-[11px] mb-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Store Notes & Preferences:
                      </span>
                      <p className="text-slate-800">{activeCustomer.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Purchase History Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Purchase History ({activeCustomerInvoices.length})
                    </h4>
                  </div>
                  <span className="text-xs font-mono-num text-slate-500">
                    Total Lifetime Spend (कुल खरिद): <strong className="text-slate-900">{formatNPR(activeCustomerTotalSpent)}</strong>
                  </span>
                </div>

                {activeCustomerInvoices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No Past Invoices</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Start a new sale in the POS to record a transaction for this customer.
                    </p>
                    <button
                      onClick={() => onSelectForSale(activeCustomer)}
                      title="नयाँ बिक्री सुरु गर्नुहोस् (Create POS Sale)"
                      className="group relative mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create POS Sale</span>
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-emerald-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                        नयाँ बिक्री सुरु गर्नुहोस्
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {activeCustomerInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num font-bold text-xs text-slate-900">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                              {inv.paymentMethod}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {inv.date}
                          </p>
                          <p className="text-[11px] text-slate-600 line-clamp-1">
                            {inv.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <div>
                            <div className="text-xs font-bold font-mono-num text-slate-900">
                              {formatNPR(inv.grandTotal)}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-700">
                              +{formatNPR(inv.totalProfit)} profit
                            </div>
                          </div>
                          <button
                            onClick={() => onViewInvoice(inv)}
                            title="कर बिजक हेर्नुहोस् (View Invoice)"
                            className="group relative px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Invoice</span>
                            <span className="pointer-events-none absolute -top-7 right-0 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap shadow-md">
                              बिजक हेर्नुहोस् (Invoice)
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-12 text-center text-slate-400 text-xs">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">No Customer Selected</p>
              <p className="mt-1 text-slate-400">
                Choose a customer from the directory or register a new member.
              </p>
              <button
                onClick={openAddModal}
                title="नयाँ ग्राहक थप्नुहोस् (Add Customer)"
                className="group relative mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-emerald-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                  नयाँ ग्राहक थप्नुहोस्
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCustomer ? 'Edit Customer Profile (ग्राहक विवरण सम्पादन)' : 'Register New Customer (नयाँ ग्राहक दर्ता)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    सम्पर्क, लोयल्टी पोइन्ट र भीआईपी सदस्यता व्यवस्थापन
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                title="बन्द गर्नुहोस् (Close)"
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Full Name (ग्राहकको पूरा नाम) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Phone Number (फोन नम्बर) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +977 98XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email Address (इमेल)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Loyalty Tier (सदस्यता तह)
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as CustomerTier)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="Bronze">Bronze (साधारण सदस्य)</option>
                    <option value="Silver">Silver (सिल्भर सदस्य)</option>
                    <option value="Gold">Gold (गोल्ड सदस्य)</option>
                    <option value="VIP Platinum">VIP Platinum (भीआईपी प्लेटिनम सदस्य)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Starting Loyalty Points (सुरुवाती पोइन्ट)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formPoints}
                    onChange={(e) => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Customer Due Balance (उधारो रकम रु)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formDueAmount}
                    onChange={(e) => setFormDueAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-mono-num font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Physical Address (ठेगाना)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address, city, Nepal"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Customer Notes & Preferences (विशेष टिप्पणी)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Prefers iPhone accessories, interested in DJI cameras..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  title="रद्द गर्नुहोस् (Cancel)"
                  className="group relative px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  <span>Cancel</span>
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap shadow-md">
                    रद्द गर्नुहोस्
                  </span>
                </button>
                <button
                  type="submit"
                  title={editingCustomer ? 'परिवर्तन सुरक्षित गर्नुहोस् (Save Changes)' : 'नयाँ ग्राहक दर्ता गर्नुहोस् (Register Customer)'}
                  className="group relative px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>{editingCustomer ? 'Save Changes' : 'Register Customer'}</span>
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-emerald-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                    {editingCustomer ? 'सुरक्षित गर्नुहोस्' : 'दर्ता गर्नुहोस्'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Adjust Loyalty Points (पोइन्ट मिलाउनुहोस्)
                  </h3>
                  <p className="text-[11px] text-slate-500">{showPointsModal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPointsModal(null)}
                title="बन्द गर्नुहोस् (Close)"
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">हालको ब्यालेन्स (Balance):</span>
                <span className="font-mono-num font-extrabold text-amber-600 text-sm">
                  ★ {showPointsModal.loyaltyPoints} pts
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Points to Add (+) or Deduct (-) (थप वा घट पोइन्ट)
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[25, 50, 100, -50].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setPointsDelta(quick)}
                      title={quick > 0 ? `${quick} पोइन्ट थप्नुहोस्` : `${Math.abs(quick)} पोइन्ट घटाउनुहोस्`}
                      className={`group relative py-1 rounded-lg border text-xs font-mono-num font-bold transition-colors cursor-pointer ${
                        pointsDelta === quick
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{quick > 0 ? `+${quick}` : quick}</span>
                      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-medium rounded whitespace-nowrap shadow-md">
                        {quick > 0 ? `+${quick} पोइन्ट` : `${quick} पोइन्ट`}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Reason / Reference Note (कारण / विवरण)
                </label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder="e.g. Birthday reward, festival promotion..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                नयाँ ब्यालेन्स: <strong>{Math.max(0, showPointsModal.loyaltyPoints + pointsDelta)} pts</strong> (सञ्चित मूल्य: {formatNPR(Math.max(0, showPointsModal.loyaltyPoints + pointsDelta) * 10)})
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPointsModal(null)}
                  title="रद्द गर्नुहोस् (Cancel)"
                  className="group relative px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 cursor-pointer"
                >
                  <span>Cancel</span>
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap shadow-md">
                    रद्द गर्नुहोस्
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAdjustPoints(showPointsModal.id, pointsDelta, pointsReason);
                    setShowPointsModal(null);
                  }}
                  title="पोइन्ट लागू गर्नुहोस् (Apply Points)"
                  className="group relative px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Apply Points</span>
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 z-30 px-2 py-0.5 bg-slate-900 text-amber-300 text-[10px] font-medium rounded-md whitespace-nowrap shadow-md border border-slate-700">
                    पोइन्ट लागू गर्नुहोस्
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
