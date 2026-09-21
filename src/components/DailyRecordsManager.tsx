import React, { useState, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  Package,
  PackagePlus,
  Clock,
  Award,
  Search,
  Plus,
  FileSpreadsheet,
  Receipt,
  Phone,
  MessageSquare,
  Filter,
  Trash2,
  Layers,
  Sparkles,
  Wallet,
  Boxes,
  FileText,
  X,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import {
  Invoice,
  InventoryItem,
  Customer,
  DailyOrderQuery,
  QueryCategory,
  QueryPriority,
  QueryStatus,
  ActionLog,
  ActionCategory,
  ReturnedProduct,
  ShopConfig,
} from '../types';
import {
  formatNPR,
  formatNPTTime,
  toBikramSambat,
  getTodayNPTString,
} from '../utils/nepalLocale';
import { useToast } from './Toast';
import { DailyRoutineActionBar } from './DailyRoutineActionBar';
import { exportActionLogsToExcelWorkbook } from '../utils/excelEngine';
import { analyzeKeywordForSpike } from '../utils/searchFrequencyTracker';

interface Props {
  invoices: Invoice[];
  inventory: InventoryItem[];
  customers: Customer[];
  queries: DailyOrderQuery[];
  returns?: ReturnedProduct[];
  shopConfig?: ShopConfig;
  actionLogs?: ActionLog[];
  onLogAction?: (entry: {
    category: ActionCategory;
    actionTitle: string;
    description: string;
    staffName?: string;
    source: ActionLog['source'];
    status?: 'SUCCESS' | 'PENDING' | 'CANCELLED';
    metadata?: Record<string, any>;
  }) => void;
  onClearActionLogs?: () => void;
  onDeleteActionLog?: (logId: string) => void;
  onAddQuery: (query: DailyOrderQuery) => void;
  onUpdateQuery: (query: DailyOrderQuery) => void;
  onDeleteQuery: (queryId: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onNavigateToPosWithCustomer?: (customer: Customer, note?: string) => void;
  onExportDailySheet: (date: string, dayInvoices: Invoice[], dayQueries: DailyOrderQuery[]) => void;
  onOpenNewSale?: () => void;
  onOpenRestock?: () => void;
  onOpenAddProductCategory?: () => void;
  onOpenCustomerDues?: () => void;
  onOpenOrderStatusUpdater?: () => void;
  onOpenLabelReminders?: () => void;
  onOpenGoogleCalendar?: () => void;
  pendingLabelRemindersCount?: number;
}

export const DailyRecordsManager: React.FC<Props> = ({
  invoices,
  inventory,
  customers,
  queries,
  returns = [],
  shopConfig = {
    id: 'default',
    shopName: 'Welcome Mobile Zone',
    tagline: 'Authorized Mobile & Gadgets Store',
    address: 'Dudhe, Shivasatakshi-9, Jhapa',
    phone: '+977 9814003548',
    email: 'wmz@gmail.com',
    taxId: 'PAN 609876543',
    merchantUpiId: 'remixphones@nabil',
    currency: 'NPR',
    currencySymbol: 'रु',
    defaultTaxRate: 0,
    returnPolicyDays: 7,
  },
  actionLogs = [],
  onLogAction,
  onClearActionLogs,
  onDeleteActionLog,
  onAddQuery,
  onUpdateQuery,
  onDeleteQuery,
  onViewInvoice,
  onNavigateToPosWithCustomer,
  onExportDailySheet,
  onOpenNewSale,
  onOpenRestock,
  onOpenAddProductCategory,
  onOpenCustomerDues,
  onOpenOrderStatusUpdater,
  onOpenLabelReminders,
  onOpenGoogleCalendar,
  pendingLabelRemindersCount = 0,
}) => {
  const toast = useToast();
  // Default to today in NPT
  const todayStr = useMemo(() => getTodayNPTString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [activeTab, setActiveTab] = useState<'all-records' | 'sales' | 'inventory' | 'queries'>('all-records');

  // "All day records" Controls State
  const [recordScope, setRecordScope] = useState<'DAY' | 'MONTH' | 'ALL'>('DAY');
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<string>('ALL');
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>('ALL');
  const [recordSourceFilter, setRecordSourceFilter] = useState<string>('ALL');
  const [recordSearchTerm, setRecordSearchTerm] = useState<string>('');
  const [showAddManualLogModal, setShowAddManualLogModal] = useState(false);

  // Manual Log Entry Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCategory, setManualCategory] = useState<ActionCategory>('GENERAL_ACTION');
  const [manualStaff, setManualStaff] = useState('Counter Staff');
  const [manualStatus, setManualStatus] = useState<'SUCCESS' | 'PENDING' | 'CANCELLED'>('SUCCESS');

  // Query Tab state
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

  // Selected date BS details
  const selectedBs = useMemo(() => toBikramSambat(selectedDate), [selectedDate]);
  const monthBs = useMemo(() => toBikramSambat(`${selectedMonth}-01`), [selectedMonth]);

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

  // =========================================================================
  // Master All Day & Monthly Records Aggregation & Synthesis Engine
  // =========================================================================
  const masterAllRecords = useMemo(() => {
    const list: ActionLog[] = [...actionLogs];
    const loggedInvoiceNumbers = new Set(
      actionLogs.map((l) => l.metadata?.invoiceNumber).filter(Boolean)
    );
    const loggedQueryIds = new Set(
      actionLogs.map((l) => l.metadata?.queryId).filter(Boolean)
    );
    const loggedReturnIds = new Set(
      actionLogs.map((l) => l.metadata?.returnId).filter(Boolean)
    );

    // 1. Synthesize any past invoices not yet in actionLogs
    invoices.forEach((inv) => {
      if (!loggedInvoiceNumbers.has(inv.invoiceNumber)) {
        const invDate = inv.date.split('T')[0] || inv.date.slice(0, 10);
        const bs = toBikramSambat(invDate);
        list.push({
          id: `syn-inv-${inv.id}`,
          timestamp: inv.date,
          date: invDate,
          time: formatNPTTime(inv.date),
          bsDate: bs.formattedBS,
          category: 'SALE',
          actionTitle: `Retail Tax Invoice #${inv.invoiceNumber}`,
          description: `Billed रु ${inv.grandTotal} (${inv.items.length} line items) to ${inv.customerName || 'Walk-in Customer'} via ${inv.paymentMethod}.`,
          staffName: 'Counter Cashier',
          source: 'POS_TERMINAL',
          status: 'SUCCESS',
          metadata: {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            grandTotal: inv.grandTotal,
            subtotal: inv.subtotal,
            taxAmount: inv.taxAmount,
            customerName: inv.customerName,
            customerPhone: inv.customerPhone,
            paymentMethod: inv.paymentMethod,
            itemsCount: inv.items.length,
          },
        });
      }
    });

    // 2. Synthesize queries
    queries.forEach((q) => {
      if (!loggedQueryIds.has(q.id)) {
        list.push({
          id: `syn-qry-${q.id}`,
          timestamp: new Date().toISOString(),
          date: q.date,
          time: q.time || '12:00 PM',
          bsDate: q.bsDate || toBikramSambat(q.date).formattedBS,
          category: 'ORDER_UPDATE',
          actionTitle: `Customer Query: ${q.customerName}`,
          description: `${q.queryType.replace('_', ' ')}: ${q.deviceModel} (Priority: ${q.priority}, Status: ${q.status}). ${q.notes || ''}`,
          staffName: q.assignedStaff || 'Counter Staff',
          source: 'ORDER_MODAL',
          status: q.status === 'FULFILLED' ? 'SUCCESS' : q.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
          metadata: {
            queryId: q.id,
            customerName: q.customerName,
            customerPhone: q.customerPhone,
            deviceModel: q.deviceModel,
            status: q.status,
          },
        });
      }
    });

    // 3. Synthesize returns
    returns.forEach((r) => {
      if (!loggedReturnIds.has(r.id)) {
        list.push({
          id: `syn-ret-${r.id}`,
          timestamp: new Date().toISOString(),
          date: r.returnDate,
          time: '12:00 PM',
          bsDate: toBikramSambat(r.returnDate).formattedBS,
          category: 'RETURN_RMA',
          actionTitle: `Return & Warranty Claim: ${r.productName}`,
          description: `Processed return for Invoice #${r.invoiceNumber}. Status: ${r.status}, Refunded: रु ${r.refundAmount || 0}.`,
          staffName: 'Service Counter',
          source: 'MANUAL',
          status: r.status === 'Approved' ? 'SUCCESS' : r.status === 'Rejected' ? 'CANCELLED' : 'PENDING',
          metadata: {
            returnId: r.id,
            invoiceNumber: r.invoiceNumber,
            productName: r.productName,
            amount: r.refundAmount,
            status: r.status,
          },
        });
      }
    });

    // Sort descending by date & time
    return list.sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime() || 0;
      const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime() || 0;
      return timeB - timeA;
    });
  }, [actionLogs, invoices, queries, returns]);

  // Filter Master Records by Scope
  const scopedRecords = useMemo(() => {
    if (recordScope === 'DAY') {
      return masterAllRecords.filter((log) => log.date === selectedDate);
    }
    if (recordScope === 'MONTH') {
      return masterAllRecords.filter((log) => log.date.startsWith(selectedMonth));
    }
    return masterAllRecords;
  }, [masterAllRecords, recordScope, selectedDate, selectedMonth]);

  // Filter scoped records by Category, Status, Source, and Search
  const filteredRecords = useMemo(() => {
    return scopedRecords.filter((log) => {
      // Category match
      let matchCat = true;
      if (recordCategoryFilter !== 'ALL') {
        if (recordCategoryFilter === 'SALE') {
          matchCat = log.category === 'SALE';
        } else if (recordCategoryFilter === 'INVENTORY') {
          matchCat = log.category === 'RESTOCK' || log.category === 'PRODUCT' || log.category === 'INVENTORY_UPDATE' || log.category === 'CATEGORY';
        } else if (recordCategoryFilter === 'CUSTOMER') {
          matchCat = log.category === 'CUSTOMER' || log.category === 'DUE_SETTLEMENT' || log.category === 'CREDIT_ENTRY';
        } else if (recordCategoryFilter === 'ORDER') {
          matchCat = log.category === 'ORDER_UPDATE';
        } else if (recordCategoryFilter === 'RETURN') {
          matchCat = log.category === 'RETURN_RMA';
        } else if (recordCategoryFilter === 'ROUTINE') {
          matchCat = log.category === 'ROUTINE_LAUNCH' || log.category === 'GENERAL_ACTION';
        } else {
          matchCat = log.category === recordCategoryFilter;
        }
      }

      // Status match
      const matchStatus = recordStatusFilter === 'ALL' || log.status === recordStatusFilter;

      // Source match
      const matchSource = recordSourceFilter === 'ALL' || log.source === recordSourceFilter;

      // Search match
      const term = recordSearchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (term) {
        matchSearch =
          (log.actionTitle && log.actionTitle.toLowerCase().includes(term)) ||
          (log.description && log.description.toLowerCase().includes(term)) ||
          (log.staffName && log.staffName.toLowerCase().includes(term)) ||
          (log.metadata?.customerName && String(log.metadata.customerName).toLowerCase().includes(term)) ||
          (log.metadata?.customerPhone && String(log.metadata.customerPhone).includes(term)) ||
          (log.metadata?.invoiceNumber && String(log.metadata.invoiceNumber).toLowerCase().includes(term)) ||
          (log.metadata?.itemName && String(log.metadata.itemName).toLowerCase().includes(term)) ||
          (log.metadata?.sku && String(log.metadata.sku).toLowerCase().includes(term));
      }

      return matchCat && matchStatus && matchSource && matchSearch;
    });
  }, [scopedRecords, recordCategoryFilter, recordStatusFilter, recordSourceFilter, recordSearchTerm]);

  // Category counts for quick filter buttons in the current scope (single-pass O(N) execution)
  const categoryCounts = useMemo(() => {
    let sales = 0;
    let inventory = 0;
    let customer = 0;
    let orders = 0;
    let returns = 0;
    let routines = 0;

    for (let i = 0; i < scopedRecords.length; i++) {
      const cat = scopedRecords[i].category;
      if (cat === 'SALE') {
        sales++;
      } else if (cat === 'RESTOCK' || cat === 'PRODUCT' || cat === 'INVENTORY_UPDATE' || cat === 'CATEGORY') {
        inventory++;
      } else if (cat === 'CUSTOMER' || cat === 'DUE_SETTLEMENT' || cat === 'CREDIT_ENTRY') {
        customer++;
      } else if (cat === 'ORDER_UPDATE') {
        orders++;
      } else if (cat === 'RETURN_RMA') {
        returns++;
      } else if (cat === 'ROUTINE_LAUNCH' || cat === 'GENERAL_ACTION') {
        routines++;
      }
    }

    return {
      all: scopedRecords.length,
      sales,
      inventory,
      customer,
      orders,
      returns,
      routines,
    };
  }, [scopedRecords]);

  // Financial & Inventory KPI sums in the selected scope (synchronizes stock quantity, sales, and restocks)
  const scopedKpiMetrics = useMemo(() => {
    const totalCount = scopedRecords.length;
    let totalSalesRevenue = 0;
    let totalUnitsSold = 0;
    let totalUnitsRestocked = 0;
    let totalCustomerDueEntries = 0;

    scopedRecords.forEach((l) => {
      if (l.category === 'SALE') {
        const amt = l.metadata?.amount || l.metadata?.grandTotal || 0;
        totalSalesRevenue += typeof amt === 'number' ? amt : parseFloat(amt) || 0;
        if (l.metadata?.quantity) {
          totalUnitsSold += Number(l.metadata.quantity) || 0;
        } else if (l.metadata?.itemsCount) {
          totalUnitsSold += Number(l.metadata.itemsCount) || 1;
        }
      } else if (l.category === 'RESTOCK') {
        if (l.metadata?.quantityAdded) {
          totalUnitsRestocked += Number(l.metadata.quantityAdded) || 0;
        } else if (l.metadata?.quantity) {
          totalUnitsRestocked += Number(l.metadata.quantity) || 0;
        }
      } else if (l.category === 'PRODUCT' || l.category === 'INVENTORY_UPDATE') {
        if (l.metadata?.stockQuantity) {
          totalUnitsRestocked += Number(l.metadata.stockQuantity) || 0;
        }
      }

      if (l.category === 'CREDIT_ENTRY' || l.category === 'DUE_SETTLEMENT') {
        totalCustomerDueEntries++;
      }
    });

    // Total actual inventory items and total quantity currently in stock across the shop
    const totalItemsInStock = inventory.reduce((sum, item) => sum + (Number(item.stockQuantity) || 0), 0);
    const uniqueProductsCount = inventory.length;

    return {
      totalCount,
      totalSalesRevenue,
      totalUnitsSold,
      totalUnitsRestocked,
      totalCustomerDueEntries,
      totalItemsInStock,
      uniqueProductsCount,
    };
  }, [scopedRecords, inventory]);

  // Handle Quick Date Change
  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedMonth(`${yyyy}-${mm}`);
    setRecordScope('DAY');
  };

  // Handle Month selector change
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
    setRecordScope('MONTH');
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

    // Check if this newly queried product keyword spikes in local search frequency
    const loc = shopConfig?.address || 'New Road, Kathmandu, Nepal';
    const spikeCheck = analyzeKeywordForSpike(newDeviceModel, loc, newQueryType);
    if (spikeCheck.isSpike && spikeCheck.alert) {
      toast.spikeAlert({
        keyword: spikeCheck.alert.keyword,
        location: spikeCheck.alert.location,
        surgePercent: spikeCheck.alert.surgePercent,
        searchVolume: spikeCheck.alert.searchVolume,
        category: spikeCheck.alert.category,
        priceRange: spikeCheck.alert.priceRange,
        demandSummary: spikeCheck.alert.demandSummary,
      });
    }

    setShowAddQueryModal(false);

    // Reset fields
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewDeviceModel('');
    setNewBudget('');
    setNewNotes('');
  };

  // Submit Manual Custom Action / Transaction Note
  const handleCreateManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      toast.warning('Please enter an action title or note.');
      return;
    }

    if (onLogAction) {
      onLogAction({
        category: manualCategory,
        actionTitle: manualTitle.trim(),
        description: manualDesc.trim() || 'Manual retail store transaction note.',
        staffName: manualStaff.trim() || 'Counter Staff',
        source: 'MANUAL',
        status: manualStatus,
        metadata: {
          loggedManually: true,
          scopeDate: selectedDate,
        },
      });
      toast.success('Custom transaction note recorded in All Day Records.');
    }

    setShowAddManualLogModal(false);
    setManualTitle('');
    setManualDesc('');
    setManualCategory('GENERAL_ACTION');
    setManualStatus('SUCCESS');
  };

  // Helper for Category badge colors & icon
  const getCategoryBadge = (cat: ActionCategory) => {
    switch (cat) {
      case 'SALE':
        return {
          label: 'Sales & Bill',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: Receipt,
        };
      case 'RESTOCK':
        return {
          label: 'Restock (+)',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Boxes,
        };
      case 'PRODUCT':
      case 'INVENTORY_UPDATE':
      case 'CATEGORY':
        return {
          label: 'Inventory SKU',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          icon: Tag,
        };
      case 'DUE_SETTLEMENT':
        return {
          label: 'Due Cleared',
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          icon: CheckCircle2,
        };
      case 'CREDIT_ENTRY':
        return {
          label: 'Credit (उधारो)',
          bg: 'bg-amber-100 text-amber-900 border-amber-200',
          icon: Wallet,
        };
      case 'CUSTOMER':
        return {
          label: 'Customer CRM',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: Award,
        };
      case 'ORDER_UPDATE':
        return {
          label: 'Order / Query',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: MessageSquare,
        };
      case 'RETURN_RMA':
        return {
          label: 'Return / RMA',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: ShieldCheck,
        };
      case 'ROUTINE_LAUNCH':
        return {
          label: 'Routine Launch',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Sparkles,
        };
      default:
        return {
          label: 'General Log',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Layers,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Day-to-Day Date Selector */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-extrabold tracking-wider uppercase">
                नेपाल राष्ट्रिय मानक • Daily & Monthly Register
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {selectedBs.formattedNp} ({selectedBs.formattedBS})
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Daily Sales, Billing, Inventory & Customer Records
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive transaction audit logs, daily bills, monthly sales movements, customer orders, and credit updates.
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
                  selectedDate === todayStr && recordScope === 'DAY'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.slice(0, 7));
                  setRecordScope('DAY');
                }}
                className="px-3 py-1.5 text-xs font-bold font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'all-records') {
                  exportActionLogsToExcelWorkbook(
                    filteredRecords,
                    shopConfig,
                    `${recordScope}_Records_${recordScope === 'DAY' ? selectedDate : selectedMonth}`
                  );
                  toast.success(`Exported ${filteredRecords.length} records to Excel workbook.`);
                } else {
                  onExportDailySheet(selectedDate, dayInvoices, dayQueries);
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Register (Excel)</span>
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

      {/* Daily Routine Task Action Bar: New Sales, Restocks, Add Products & Categories, Customer Dues, Order Status */}
      <DailyRoutineActionBar
        onOpenNewSale={() => {
          if (onOpenNewSale) onOpenNewSale();
        }}
        onOpenRestock={() => {
          if (onOpenRestock) onOpenRestock();
        }}
        onOpenAddProductCategory={() => {
          if (onOpenAddProductCategory) onOpenAddProductCategory();
        }}
        onOpenCustomerDues={() => {
          if (onOpenCustomerDues) onOpenCustomerDues();
        }}
        onOpenOrderStatusUpdater={() => {
          if (onOpenOrderStatusUpdater) onOpenOrderStatusUpdater();
        }}
        onOpenLabelReminders={onOpenLabelReminders}
        onOpenGoogleCalendar={onOpenGoogleCalendar}
        pendingLabelRemindersCount={pendingLabelRemindersCount}
        lowStockCount={inventory.filter((i) => i.stockQuantity <= i.reorderLevel).length}
        totalItemsInStock={scopedKpiMetrics.totalItemsInStock}
        totalItemsRestockedCount={scopedKpiMetrics.totalUnitsRestocked}
        customerDuesCount={customers.filter((c) => (c.dueAmount || 0) > 0).length}
        totalDuesAmount={customers.reduce((sum, c) => sum + (c.dueAmount || 0), 0)}
        pendingOrdersCount={queries.filter((q) => q.status === 'PENDING').length}
        categoriesCount={new Set(inventory.map((i) => i.category)).size}
        actionLogs={actionLogs}
        onLogAction={onLogAction}
        onClearLogs={onClearActionLogs}
        onDeleteLog={onDeleteActionLog}
      />

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

      {/* TARGET SELECTED DIV: Sub-Tabs Card with "All day records" navigation header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Sub-Tabs Header Bar */}
        <div className="border-b border-slate-200 px-5 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {/* 1. All day records Primary Master View */}
            <button
              type="button"
              onClick={() => setActiveTab('all-records')}
              className={`flex items-center gap-2 pb-3 px-3.5 text-xs font-extrabold border-b-2 transition-all ${
                activeTab === 'all-records'
                  ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>All day records</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                  activeTab === 'all-records'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {scopedRecords.length}
              </span>
            </button>

            {/* 2. Day-to-Day Sales & Billing Register */}
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'sales'
                  ? 'border-emerald-600 text-emerald-700 bg-slate-50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Day-to-Day Sales & Billing Register ({dayInvoices.length})</span>
            </button>

            {/* 3. Daily Inventory Movement & Stock Count */}
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'inventory'
                  ? 'border-emerald-600 text-emerald-700 bg-slate-50 dark:bg-slate-800 rounded-t-lg font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Inventory Movement</span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {scopedKpiMetrics.totalItemsInStock} in stock
                </span>
                {dailyInventoryMovement.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {dailyInventoryMovement.length} moved
                  </span>
                )}
              </span>
            </button>

            {/* 4. Customer Orders & Queries Notes */}
            <button
              type="button"
              onClick={() => setActiveTab('queries')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'queries'
                  ? 'border-emerald-600 text-emerald-700 bg-slate-50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Customer Orders & Queries Notes ({dayQueries.length})</span>
            </button>
          </div>

          {/* Scope and Date Summary Tag */}
          <div className="pb-3 text-xs text-slate-500 font-medium flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {recordScope === 'DAY' && (
                <>
                  Day: <strong className="text-slate-800 font-mono">{selectedDate}</strong> ({selectedBs.formattedBS})
                </>
              )}
              {recordScope === 'MONTH' && (
                <>
                  Month: <strong className="text-slate-800 font-mono">{selectedMonth}</strong> ({monthBs.bsMonthName} {monthBs.bsYear} BS)
                </>
              )}
              {recordScope === 'ALL' && (
                <>
                  Scope: <strong className="text-slate-800">All Time Archive</strong>
                </>
              )}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB: ALL DAY RECORDS (Master Comprehensive Activity & Transaction Logs) */}
        {/* ========================================================================= */}
        {activeTab === 'all-records' && (
          <div className="p-2.5 sm:p-4 md:p-5 space-y-3 sm:space-y-4 md:space-y-5">
            {/* Scope Selector Bar: Daily Records | Monthly Records | All-Time Master Log */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center gap-1.5 mr-1">
                  <Filter className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Time Scope:</span>
                </span>

                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-300 text-xs font-bold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setRecordScope('DAY')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      recordScope === 'DAY'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📅 Selected Day ({selectedDate})
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordScope('MONTH')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      recordScope === 'MONTH'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🗓️ Month Records ({selectedMonth})
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecordScope('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      recordScope === 'ALL'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🌐 All-Time Archive ({masterAllRecords.length})
                  </button>
                </div>

                {recordScope === 'MONTH' && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={handleMonthChange}
                      className="px-2.5 py-1 text-xs font-bold font-mono text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-500">
                      ({monthBs.bsMonthName} {monthBs.bsYear} BS)
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons for All Day Records */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddManualLogModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Transaction Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportActionLogsToExcelWorkbook(
                      filteredRecords,
                      shopConfig,
                      `${recordScope}_Master_Records_${recordScope === 'DAY' ? selectedDate : selectedMonth}`
                    );
                    toast.success(`Exported ${filteredRecords.length} records to Excel.`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredRecords.length})</span>
                </button>

                {onClearActionLogs && actionLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all action log entries?')) {
                        onClearActionLogs();
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors title='Clear Logs'"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Scope Summary Strip: 4 KPI Badges for Selected Scope with Live Stock Sync */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Operations / Logs
                </span>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {scopedKpiMetrics.totalCount} <span className="text-xs font-normal text-slate-500">records</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  Billed Revenue in Scope
                </span>
                <div className="text-xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {formatNPR(scopedKpiMetrics.totalSalesRevenue)}
                </div>
              </div>

              <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide flex items-center justify-between">
                  <span>Inventory in Stock</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold">
                    {scopedKpiMetrics.uniqueProductsCount} SKUs
                  </span>
                </span>
                <div className="text-xl font-black font-mono text-blue-900 dark:text-blue-200 mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                  <span>{scopedKpiMetrics.totalItemsInStock}</span>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">items in stock</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    +{scopedKpiMetrics.totalUnitsRestocked} restocked
                  </span>
                  <span>•</span>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                    -{scopedKpiMetrics.totalUnitsSold} sold
                  </span>
                </div>
              </div>

              <div className="bg-purple-50/70 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-200/80 dark:border-purple-800/60">
                <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                  Customer & Dues Updates
                </span>
                <div className="text-xl font-black font-mono text-purple-900 dark:text-purple-200 mt-0.5">
                  {scopedKpiMetrics.totalCustomerDueEntries} <span className="text-xs font-normal text-purple-700">events</span>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Categories:</span>
              <button
                type="button"
                onClick={() => setRecordCategoryFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                All Records ({categoryCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('SALE')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'SALE'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sales & Billing ({categoryCounts.sales})</span>
                {scopedKpiMetrics.totalUnitsSold > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-mono font-bold">
                    -{scopedKpiMetrics.totalUnitsSold} sold
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('INVENTORY')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'INVENTORY'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Inventory & Restocks ({categoryCounts.inventory})</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-mono font-bold">
                  {scopedKpiMetrics.totalItemsInStock} in stock
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('CUSTOMER')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'CUSTOMER'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Customer & Dues ({categoryCounts.customer})</span>
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('ORDER')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'ORDER'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Order & Queries ({categoryCounts.orders})</span>
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('RETURN')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'RETURN'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Returns & Warranty ({categoryCounts.returns})</span>
              </button>

              <button
                type="button"
                onClick={() => setRecordCategoryFilter('ROUTINE')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  recordCategoryFilter === 'ROUTINE'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Routines ({categoryCounts.routines})</span>
              </button>
            </div>

            {/* Instant Search & Multi-Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by action, invoice #, customer name, phone, item, SKU, staff..."
                  value={recordSearchTerm}
                  onChange={(e) => setRecordSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {recordSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setRecordSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={recordStatusFilter}
                  onChange={(e) => setRecordStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">Success / Done</option>
                  <option value="PENDING">Pending Action</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Source Filter */}
                <select
                  value={recordSourceFilter}
                  onChange={(e) => setRecordSourceFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Channels</option>
                  <option value="POS_TERMINAL">POS Cashier</option>
                  <option value="RESTOCK_MODAL">Restock Console</option>
                  <option value="PRODUCT_MODAL">Catalog / SKU</option>
                  <option value="DUES_MODAL">Customer Dues</option>
                  <option value="ORDER_MODAL">Order Updater</option>
                  <option value="DAILY_ROUTINE_BAR">Routine Bar</option>
                  <option value="MANUAL">Manual Note</option>
                </select>
              </div>
            </div>

            {/* Master Table of All Day Records */}
            {filteredRecords.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No Records Found for the Selected Criteria</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Try adjusting the date, month selector, or search filters above, or log a new action or transaction.
                </p>
              </div>
            ) : (
              <div id="all-day-records-table-container" className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850">
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3">Time & Date</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3">Category</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3">Action & Summary</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3">Operator / Staff</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3">Financial / Entity Details</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 text-center">Status</th>
                      <th className="py-2 px-2 sm:py-2.5 sm:px-3 text-center">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {filteredRecords.map((log) => {
                      const catBadge = getCategoryBadge(log.category);
                      const IconComponent = catBadge.icon;
                      const hasInvoice = log.metadata?.invoiceNumber || (log.metadata?.invoiceId && invoices.find((i) => i.id === log.metadata?.invoiceId));

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Time & Date */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 whitespace-nowrap">
                            <div className="flex sm:flex-col items-baseline sm:items-start gap-1.5 sm:gap-0">
                              <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-[11px] sm:text-xs">
                                {log.time || '—'}
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono sm:mt-0.5">
                                {log.date}
                              </span>
                            </div>
                            {log.bsDate && (
                              <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                                {log.bsDate}
                              </div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-extrabold border ${catBadge.bg}`}
                            >
                              <IconComponent className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                              <span>{catBadge.label}</span>
                            </span>
                          </td>

                          {/* Action Title & Full Description */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 max-w-[170px] sm:max-w-xs md:max-w-sm">
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-[11px] sm:text-xs line-clamp-1 sm:line-clamp-none leading-tight">
                              {log.actionTitle}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] mt-0.5 leading-snug line-clamp-1 sm:line-clamp-2">
                              {log.description}
                            </div>
                          </td>

                          {/* Operator / Staff */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px] sm:text-xs leading-tight">
                              {log.staffName || 'Counter Staff'}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                              {log.source ? log.source.replace('_', ' ') : 'SYSTEM'}
                            </span>
                          </td>

                          {/* Financial & Entity Badges */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                              {/* Amount (रु) */}
                              {(log.metadata?.amount || log.metadata?.grandTotal) && (
                                <span className="px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px] sm:text-[11px] bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300">
                                  {formatNPR(log.metadata.amount || log.metadata.grandTotal)}
                                </span>
                              )}

                              {/* Invoice Number */}
                              {log.metadata?.invoiceNumber && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = invoices.find(
                                      (i) => i.invoiceNumber === log.metadata?.invoiceNumber
                                    );
                                    if (matched) onViewInvoice(matched);
                                  }}
                                  className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"
                                >
                                  <Receipt className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>{log.metadata.invoiceNumber}</span>
                                </button>
                              )}

                              {/* Customer Name / Phone */}
                              {log.metadata?.customerName && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                                  👤 {log.metadata.customerName}
                                </span>
                              )}

                              {/* SKU or Item */}
                              {(log.metadata?.itemName || log.metadata?.sku) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 max-w-[140px] sm:max-w-none truncate">
                                  📦 {log.metadata.itemName || log.metadata.sku}
                                  {log.metadata.quantity ? ` (${log.metadata.quantity})` : ''}
                                </span>
                              )}

                              {/* Payment Method */}
                              {log.metadata?.paymentMethod && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                  💳 {log.metadata.paymentMethod}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 sm:px-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                                log.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : log.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-0.5 sm:gap-1">
                              {hasInvoice && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = invoices.find(
                                      (i) => i.invoiceNumber === log.metadata?.invoiceNumber || i.id === log.metadata?.invoiceId
                                    );
                                    if (matched) onViewInvoice(matched);
                                  }}
                                  className="p-1 sm:p-1.5 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md sm:rounded-lg transition-colors"
                                  title="View Tax Invoice"
                                  aria-label="View Tax Invoice"
                                >
                                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                              )}

                              {log.metadata?.customerId && onNavigateToPosWithCustomer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cust = customers.find((c) => c.id === log.metadata?.customerId);
                                    if (cust) onNavigateToPosWithCustomer(cust);
                                  }}
                                  className="p-1 sm:p-1.5 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md sm:rounded-lg transition-colors"
                                  title="Open POS with Customer"
                                  aria-label="Open POS with Customer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                              )}

                              {onDeleteActionLog && !log.id.startsWith('syn-') && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteActionLog(log.id)}
                                  className="p-1 sm:p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md sm:rounded-lg transition-colors"
                                  title="Delete Log"
                                  aria-label="Delete Log"
                                >
                                  <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                              )}
                            </div>
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

        {/* Tab 2: Day-to-Day Sales & Billing Register with Auto-Incremental Loyalty */}
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

        {/* Tab 3: Daily Inventory Movement & Stock Log */}
        {activeTab === 'inventory' && (
          <div className="p-5 space-y-4">
            {/* Live Inventory Snapshot Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Total Current Stock
                  </div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {scopedKpiMetrics.totalItemsInStock}{' '}
                    <span className="text-xs font-normal text-slate-500">units across {scopedKpiMetrics.uniqueProductsCount} SKUs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Restocked in Scope
                  </div>
                  <div className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                    +{scopedKpiMetrics.totalUnitsRestocked}{' '}
                    <span className="text-xs font-normal text-slate-500">units added</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Units Sold in Scope
                  </div>
                  <div className="text-lg font-black font-mono text-amber-700 dark:text-amber-400">
                    {scopedKpiMetrics.totalUnitsSold}{' '}
                    <span className="text-xs font-normal text-slate-500">units deducted</span>
                  </div>
                </div>
              </div>
            </div>

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
                    {dailyInventoryMovement.map((m, mIdx) => (
                      <tr key={`${m.itemId}-${m.sku}-${mIdx}`} className="hover:bg-slate-50/80 transition-colors">
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

        {/* Tab 4: Customer Orders & Queries Notes */}
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
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredDayQueries.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                          {q.queryType.replace('_', ' ')}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            q.status === 'FULFILLED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.status === 'FOLLOWED_UP'
                              ? 'bg-blue-100 text-blue-800'
                              : q.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <span>{q.deviceModel}</span>
                      </h4>

                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{q.customerName}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-mono text-slate-600">{q.customerPhone}</span>
                        </div>
                        {q.estimatedBudget && (
                          <div className="text-[11px] font-mono text-emerald-700 font-bold">
                            Budget: {formatNPR(q.estimatedBudget)}
                          </div>
                        )}
                        {q.notes && (
                          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-1.5 border border-slate-100">
                            {q.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{q.time}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        {q.status !== 'FULFILLED' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateQuery({
                                ...q,
                                status: 'FULFILLED',
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold transition-colors"
                          >
                            Mark Fulfilled
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteQuery(q.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Modal: Add Manual Retail Action / Transaction Note */}
      {showAddManualLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                  Store Audit & Operation Log
                </span>
                <h3 className="text-lg font-black text-slate-900">Record Store Transaction / Note</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddManualLogModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualLog} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Transaction / Action Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributor stock shipment received / Cash drawer reconciliation"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Log Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as ActionCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="GENERAL_ACTION">General Store Action</option>
                    <option value="SALE">Billing & Retail Sale</option>
                    <option value="RESTOCK">Inventory Restock</option>
                    <option value="PRODUCT">Product & SKU Update</option>
                    <option value="CUSTOMER">Customer & Loyalty Note</option>
                    <option value="DUE_SETTLEMENT">Credit & Due Settlement</option>
                    <option value="CREDIT_ENTRY">Credit Entry (उधारो)</option>
                    <option value="ORDER_UPDATE">Order / Pre-Order Update</option>
                    <option value="RETURN_RMA">Warranty & Return (RMA)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Action Status</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as 'SUCCESS' | 'PENDING' | 'CANCELLED')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                  >
                    <option value="SUCCESS">Completed (Success)</option>
                    <option value="PENDING">Pending Action / Review</option>
                    <option value="CANCELLED">Cancelled / On Hold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Responsible Staff / Operator</label>
                <input
                  type="text"
                  placeholder="e.g. Counter Staff / Manager"
                  value={manualStaff}
                  onChange={(e) => setManualStaff(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Detailed Description & Notes</label>
                <textarea
                  rows={3}
                  placeholder="Enter details, supplier invoice numbers, customer remarks, or cash reconciliation notes..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddManualLogModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition-all shadow-xs"
                >
                  Record Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
