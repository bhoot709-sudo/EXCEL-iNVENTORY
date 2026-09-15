import { useState, useId, useEffect, useMemo } from 'react';
import { 
  Scan, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  QrCode, 
  CreditCard, 
  Banknote, 
  Search, 
  Smartphone, 
  Percent, 
  AlertCircle,
  AlertTriangle,
  Tag,
  Users,
  Star,
  Award,
  X,
  UserCheck,
  UserPlus,
  Gift,
  Check
} from 'lucide-react';
import { InventoryItem, CartItem, Invoice, ShopConfig, Customer } from '../types';
import { useToast } from './Toast';
import { formatNPR, formatNPTTime, toBikramSambat } from '../utils/nepalLocale';

interface Props {
  inventory: InventoryItem[];
  customers: Customer[];
  shopConfig: ShopConfig;
  preselectedCustomerId?: string | null;
  onClearPreselectedCustomer?: () => void;
  onOpenScanner: () => void;
  onCompleteSale: (
    invoice: Invoice, 
    customerUpdate?: { customerId?: string; pointsDelta: number; newCustomer?: Customer }
  ) => void;
  onOpenInvoice: (invoice: Invoice) => void;
  onAddCustomer?: (customer: Customer) => void;
  initialCartItemToAdd?: InventoryItem | null;
  onClearInitialCartItemToAdd?: () => void;
}

export function PosBillingView({
  inventory,
  customers,
  shopConfig,
  preselectedCustomerId,
  onClearPreselectedCustomer,
  onOpenScanner,
  onCompleteSale,
  onOpenInvoice,
  onAddCustomer,
  initialCartItemToAdd,
  onClearInitialCartItemToAdd,
}: Props) {
  const toast = useToast();
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Customer selection & loyalty state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [enrollNewCustomer, setEnrollNewCustomer] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);

  // Customer verification warning states
  const [customerValidationError, setCustomerValidationError] = useState<string | null>(null);
  const [customerNameError, setCustomerNameError] = useState(false);
  const [customerPhoneError, setCustomerPhoneError] = useState(false);

  // Customer info inputs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [specialDiscount, setSpecialDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI_QR' | 'CARD' | 'CASH'>('UPI_QR');

  // Input field IDs for accessibility
  const searchInputId = useId();
  const customerNameId = useId();
  const customerPhoneId = useId();
  const discountInputId = useId();

  // If preselectedCustomerId changes or is passed, pick that customer
  useEffect(() => {
    if (preselectedCustomerId) {
      const match = customers.find((c) => c.id === preselectedCustomerId);
      if (match) {
        selectCustomer(match);
      }
    }
  }, [preselectedCustomerId, customers]);

  const selectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setCustomerEmail(cust.email || '');
    setCustomerSearchInput('');
    setShowCustomerDropdown(false);
    setEnrollNewCustomer(false);
    setRedeemPoints(0);
    setCustomerValidationError(null);
    setCustomerNameError(false);
    setCustomerPhoneError(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerSearchInput('');
    setRedeemPoints(0);
    setCustomerValidationError(null);
    setCustomerNameError(false);
    setCustomerPhoneError(false);
    if (onClearPreselectedCustomer) {
      onClearPreselectedCustomer();
    }
  };

  // Matching customers for picker
  const matchingCustomers = customerSearchInput.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearchInput.toLowerCase()) ||
          c.phone.includes(customerSearchInput) ||
          (c.email && c.email.toLowerCase().includes(customerSearchInput.toLowerCase()))
      )
    : customers.slice(0, 6);

  // If initialCartItemToAdd is passed from scan dashboard, auto-add to cart
  useEffect(() => {
    if (initialCartItemToAdd) {
      addToCart(initialCartItemToAdd);
      onClearInitialCartItemToAdd?.();
    }
  }, [initialCartItemToAdd, onClearInitialCartItemToAdd]);

  // Points redemption calculation: 1 loyalty point = रु 10 discount
  const maxRedeemablePoints = selectedCustomer 
    ? Math.min(selectedCustomer.loyaltyPoints, Math.floor(Math.max(0, cart.reduce((acc, c) => acc + (c.item.sellingPrice - c.unitDiscount) * c.quantity, 0) - specialDiscount) / 10))
    : 0;

  const pointsDiscountAmount = Math.min(
    Math.max(0, redeemPoints * 10),
    maxRedeemablePoints * 10
  );

  const totalDiscount = specialDiscount + pointsDiscountAmount;

  // Add to cart
  const addToCart = (item: InventoryItem) => {
    if (item.stockQuantity <= 0) {
      toast.warning(`Cannot add "${item.name}" - Item is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stockQuantity) {
          toast.warning(`Cannot add more: only ${item.stockQuantity} units available in stock.`);
          return prev;
        }
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1, unitDiscount: 0, selectedImeis: [] }];
    });
  };

  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (newQty > item.stockQuantity) {
      toast.warning(`Max available stock for "${item.name}" is ${item.stockQuantity} units.`);
      return;
    }

    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, quantity: newQty } : c))
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const updateItemDiscount = (itemId: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, unitDiscount: Math.max(0, discount) } : c))
    );
  };

  const updateItemImeis = (itemId: string, imeisStr: string) => {
    const list = imeisStr.split(',').map((s) => s.trim()).filter(Boolean);
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, selectedImeis: list } : c))
    );
  };

  // Cart calculations with 2-decimal floating point precision protection
  const subtotal = Math.round(
    cart.reduce((acc, c) => {
      const linePrice = Math.max(0, c.item.sellingPrice - c.unitDiscount);
      return acc + linePrice * c.quantity;
    }, 0) * 100
  ) / 100;

  const totalCost = Math.round(
    cart.reduce((acc, c) => acc + c.item.costPrice * c.quantity, 0) * 100
  ) / 100;

  const discountedSubtotal = Math.round(Math.max(0, subtotal - totalDiscount) * 100) / 100;
  const taxAmount = Math.round(((discountedSubtotal * shopConfig.defaultTaxRate) / 100) * 100) / 100;
  const grandTotal = Math.round((discountedSubtotal + taxAmount) * 100) / 100;
  const totalProfit = Math.round((discountedSubtotal - totalCost) * 100) / 100;
  const profitMargin = grandTotal > 0 ? Math.round(((totalProfit / grandTotal) * 100) * 10) / 10 : 0;
  // 1 loyalty point per रु 1,000 spent
  const pointsEarned = Math.max(1, Math.floor(grandTotal / 1000));

  // Process checkout with strict customer verification & deduplication of invoices
  const handleProceedToPayment = () => {
    if (isProcessingSale) return;

    if (cart.length === 0) {
      toast.warning('Cart is empty. Scan barcodes or select items to bill.');
      return;
    }

    // First verify any customer is selected or name & phone are provided
    const hasSelectedCustomer = Boolean(selectedCustomer);
    const hasName = Boolean(customerName.trim());
    const hasPhone = Boolean(customerPhone.trim());

    if (!hasSelectedCustomer && (!hasName || !hasPhone)) {
      setCustomerNameError(!hasName);
      setCustomerPhoneError(!hasPhone);

      let msg = '';
      if (!hasName && !hasPhone) {
        msg = 'कृपया ग्राहक छान्नुहोस् वा नाम र फोन नम्बर भर्नुहोस् (Please select a customer or enter name & phone number)';
      } else if (!hasName) {
        msg = 'ग्राहकको नाम अनिवार्य छ (Customer name is required before completing sale)';
      } else {
        msg = 'ग्राहकको फोन नम्बर अनिवार्य छ (Phone number is required for bill & warranty)';
      }

      setCustomerValidationError(msg);
      toast.warning(msg);

      // Focus the first missing input field
      if (!hasName) {
        document.getElementById(customerNameId)?.focus();
      } else if (!hasPhone) {
        document.getElementById(customerPhoneId)?.focus();
      }
      return;
    }

    setIsProcessingSale(true);

    try {
      // Collision-proof invoice identifier & human-readable number
      const timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uniqueSuffix = `${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const invoiceNumber = `INV-${timeStamp}-${uniqueSuffix}`;

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        invoiceNumber,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        customerId: selectedCustomer ? selectedCustomer.id : undefined,
        customerName: customerName.trim() || (selectedCustomer ? selectedCustomer.name : 'Retail Customer'),
        customerPhone: customerPhone.trim() || (selectedCustomer ? selectedCustomer.phone : 'N/A'),
        customerEmail: customerEmail.trim() || (selectedCustomer ? selectedCustomer.email : undefined),
        items: cart.map((c) => {
          const lineTotal = Math.round(Math.max(0, (c.item.sellingPrice - c.unitDiscount) * c.quantity) * 100) / 100;
          const lineCost = Math.round(c.item.costPrice * c.quantity * 100) / 100;
          return {
            itemId: c.item.id,
            sku: c.item.sku,
            name: c.item.name,
            brand: c.item.brand,
            barcode: c.item.barcode,
            imeiList: c.selectedImeis && c.selectedImeis.length > 0 ? c.selectedImeis : undefined,
            quantity: c.quantity,
            costPrice: c.item.costPrice,
            unitPrice: c.item.sellingPrice,
            discount: c.unitDiscount,
            total: lineTotal,
            profit: Math.round((lineTotal - lineCost) * 100) / 100,
          };
        }),
        subtotal,
        taxRate: shopConfig.defaultTaxRate,
        taxAmount,
        discountAmount: totalDiscount,
        grandTotal,
        totalProfit,
        paymentMethod,
        paymentStatus: 'PAID',
        transactionRef: `TXN-${paymentMethod}-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: redeemPoints > 0 
          ? `${paymentMethod} verified at counter. Redeemed ${redeemPoints} points (${formatNPR(pointsDiscountAmount)} discount).` 
          : `${paymentMethod} verified at counter.`,
        loyaltyPointsEarned: pointsEarned,
        loyaltyPointsRedeemed: redeemPoints,
        customerPreviousPoints: selectedCustomer ? selectedCustomer.loyaltyPoints : 0,
        customerNewPoints: selectedCustomer 
          ? selectedCustomer.loyaltyPoints + pointsEarned - redeemPoints 
          : pointsEarned,
      };

      let customerUpdateInfo: { customerId?: string; pointsDelta: number; newCustomer?: Customer } | undefined;

      if (selectedCustomer) {
        // Net points delta = points earned on purchase minus points redeemed
        const netDelta = pointsEarned - redeemPoints;
        customerUpdateInfo = {
          customerId: selectedCustomer.id,
          pointsDelta: netDelta,
        };
      } else if (enrollNewCustomer && customerName.trim() && customerPhone.trim()) {
        // Deduplication check: verify if a customer already exists with this phone number
        const normPhone = customerPhone.trim().replace(/\D/g, '');
        const existingCust = customers.find(
          (c) => c.phone.replace(/\D/g, '') === normPhone && normPhone.length >= 7
        );

        if (existingCust) {
          // Associate with existing customer profile instead of creating a duplicate!
          newInvoice.customerId = existingCust.id;
          newInvoice.customerName = existingCust.name;
          customerUpdateInfo = {
            customerId: existingCust.id,
            pointsDelta: pointsEarned,
          };
          toast.info(`Linked sale to existing customer account "${existingCust.name}".`);
        } else {
          const newCust: Customer = {
            id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            email: customerEmail.trim() || undefined,
            loyaltyPoints: pointsEarned,
            tier: 'Bronze',
            createdAt: new Date().toISOString().split('T')[0],
          };
          newInvoice.customerId = newCust.id;
          customerUpdateInfo = {
            newCustomer: newCust,
            pointsDelta: pointsEarned,
          };
          if (onAddCustomer) {
            onAddCustomer(newCust);
          }
        }
      }

      onCompleteSale(newInvoice, customerUpdateInfo);
      onOpenInvoice(newInvoice);

      // Reset checkout form
      setCart([]);
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setSpecialDiscount(0);
      setRedeemPoints(0);
      setEnrollNewCustomer(false);
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Filter items
  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = useMemo(() => {
    const defaults = ['All', 'Smartphones', 'Tablets', 'Wearables', 'Audio', 'Chargers & Power', 'Protection & Cases', 'Cables & Adapters'];
    const customInStock = inventory.map((i) => i.category).filter(Boolean);
    return Array.from(new Set([...defaults, ...customInStock]));
  }, [inventory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Product Catalog & Barcode Fast Search (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search & Barcode Scan Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <label htmlFor={searchInputId} className="sr-only">Search phones, gadgets, barcodes or SKUs</label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phones, gadgets, barcode (EAN/UPC) or SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <button
            id="pos-open-scanner-btn"
            onClick={onOpenScanner}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0"
          >
            <Scan className="w-4 h-4 text-emerald-400" />
            <span>Scan Barcode</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Catalog Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isLow = item.stockQuantity <= item.reorderLevel;
            const isOut = item.stockQuantity <= 0;
            const profit = item.sellingPrice - item.costPrice;
            const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0;

            return (
              <div
                key={item.id}
                className={`p-3.5 bg-white rounded-2xl border transition-all flex flex-col justify-between ${
                  isOut
                    ? 'border-slate-200 opacity-60'
                    : 'border-slate-200 hover:border-emerald-500 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.brand} • {item.category}
                    </span>
                    {isOut ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                        Low: {item.stockQuantity} left
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium font-mono-num">
                        Stock: {item.stockQuantity}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                    {item.name}
                  </h4>

                  <div className="mt-1 flex items-center gap-2 text-[11px] font-mono-num text-slate-500">
                    <span>Barcode: {item.barcode}</span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-base font-extrabold font-mono text-slate-900">
                      {formatNPR(item.sellingPrice)}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700">
                      +{formatNPR(profit)} profit ({margin.toFixed(0)}%)
                    </div>
                  </div>
                </div>

                <button
                  id={`add-to-cart-${item.id}`}
                  onClick={() => addToCart(item)}
                  disabled={isOut}
                  className={`mt-3 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isOut
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Bill</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Active Cashier Cart & Bill Summary (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between min-h-[600px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Current Sale & Bill
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono-num font-bold">
                {cart.reduce((acc, c) => acc + c.quantity, 0)} items
              </span>
            </div>

            {/* Customer Details & Loyalty Section */}
            <div className="py-3 border-b border-slate-100 space-y-2">
              {selectedCustomer ? (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                        {selectedCustomer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 leading-none">
                            {selectedCustomer.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {selectedCustomer.tier}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono-num">
                          {selectedCustomer.phone}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCustomer}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-emerald-100/60 transition-colors"
                      title="Clear / Change Customer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Loyalty Points Wallet & Redeem Controls */}
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium flex items-center gap-1 text-[11px]">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        Loyalty Points:
                      </span>
                      <span className="font-mono font-bold text-amber-600 text-xs">
                        ★ {selectedCustomer.loyaltyPoints} pts ({formatNPR(selectedCustomer.loyaltyPoints * 10)})
                      </span>
                    </div>

                    {/* Quick Redeem options */}
                    {selectedCustomer.loyaltyPoints >= 10 && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Redeem Points Discount:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {redeemPoints > 0 ? `-${formatNPR(pointsDiscountAmount)}` : 'रु 0'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setRedeemPoints(0)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                              redeemPoints === 0 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            None
                          </button>
                          {selectedCustomer.loyaltyPoints >= 20 && (
                            <button
                              type="button"
                              onClick={() => setRedeemPoints(Math.min(20, maxRedeemablePoints))}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                redeemPoints === 20 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              20 pts (रु 200)
                            </button>
                          )}
                          {selectedCustomer.loyaltyPoints >= 50 && (
                            <button
                              type="button"
                              onClick={() => setRedeemPoints(Math.min(50, maxRedeemablePoints))}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                redeemPoints === 50 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              50 pts (रु 500)
                            </button>
                          )}
                          {selectedCustomer.loyaltyPoints >= 100 && (
                            <button
                              type="button"
                              onClick={() => setRedeemPoints(Math.min(100, maxRedeemablePoints))}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                redeemPoints === 100 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              100 pts (रु 1,000)
                            </button>
                          )}
                          {maxRedeemablePoints > 0 && (
                            <button
                              type="button"
                              onClick={() => setRedeemPoints(maxRedeemablePoints)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                redeemPoints === maxRedeemablePoints && maxRedeemablePoints > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              Max ({maxRedeemablePoints} pts)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-emerald-800 font-medium flex items-center justify-between pt-1">
                      <span>Will earn on this bill:</span>
                      <span className="font-mono-num font-bold text-emerald-900">
                        +{pointsEarned} pts
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Select Existing Customer Search & Dropdown */}
                  <div className="relative">
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search existing customer (name or phone)..."
                          value={customerSearchInput}
                          onFocus={() => setShowCustomerDropdown(true)}
                          onChange={(e) => {
                            setCustomerSearchInput(e.target.value);
                            setShowCustomerDropdown(true);
                          }}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shrink-0"
                        title="Browse registered customers"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Pick</span>
                      </button>
                    </div>

                    {/* Dropdown for matching customers */}
                    {showCustomerDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 text-xs">
                        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <span>Select Customer</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomerDropdown(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ✕
                          </button>
                        </div>
                        {matchingCustomers.length === 0 ? (
                          <div className="px-3 py-2 text-center text-slate-400 text-[11px]">
                            No customer matched "{customerSearchInput}"
                          </div>
                        ) : (
                          matchingCustomers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 truncate">
                                    {c.name}
                                  </span>
                                  <span className="text-[9px] px-1 rounded bg-slate-100 font-semibold text-slate-600">
                                    {c.tier}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono-num">
                                  {c.phone}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono-num font-bold text-amber-600 shrink-0">
                                ★ {c.loyaltyPoints} pts
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer Validation Error Banner */}
                  {customerValidationError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-start gap-1.5 animate-fadeIn">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold text-[11px] text-rose-800">Customer Required / ग्राहक आवश्यक छ</p>
                        <p className="text-[10px] text-rose-600">{customerValidationError}</p>
                      </div>
                    </div>
                  )}

                  {/* Manual Guest Input (Name & Phone) with inline warning feedback */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={customerNameId} className="sr-only">Customer Name</label>
                      <input
                        id={customerNameId}
                        type="text"
                        placeholder="Customer Name *"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (customerNameError) setCustomerNameError(false);
                          if (customerValidationError && customerPhone.trim()) setCustomerValidationError(null);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none transition-all ${
                          customerNameError
                            ? 'bg-rose-50/70 border border-rose-400 text-rose-900 placeholder-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                        }`}
                      />
                      {customerNameError && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>Name required (नाम आवश्यक)</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor={customerPhoneId} className="sr-only">Customer Phone</label>
                      <input
                        id={customerPhoneId}
                        type="text"
                        placeholder="Customer Phone *"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (customerPhoneError) setCustomerPhoneError(false);
                          if (customerValidationError && customerName.trim()) setCustomerValidationError(null);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none transition-all ${
                          customerPhoneError
                            ? 'bg-rose-50/70 border border-rose-400 text-rose-900 placeholder-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                        }`}
                      />
                      {customerPhoneError && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mt-1">
                          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>Phone required (फोन आवश्यक)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {customerName.trim() && customerPhone.trim() && (
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={enrollNewCustomer}
                        onChange={(e) => setEnrollNewCustomer(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Register as new loyalty member & earn points</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="py-3 space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">Cart is Empty</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scan device barcode or click "Add to Bill"
                  </p>
                </div>
              ) : (
                cart.map((cartItem) => {
                  const lineTotal = Math.max(
                    0,
                    (cartItem.item.sellingPrice - cartItem.unitDiscount) * cartItem.quantity
                  );

                  return (
                    <div
                      key={cartItem.item.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            {cartItem.item.name}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            SKU: {cartItem.item.sku} • Price: {formatNPR(cartItem.item.sellingPrice)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(cartItem.item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* IMEI Input for Phones / High-Value Wearables */}
                      {cartItem.item.imeiRequired && (
                        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200">
                          <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <input
                            type="text"
                            placeholder="Enter Serial / IMEI number (comma separated)"
                            value={cartItem.selectedImeis?.join(', ') || ''}
                            onChange={(e) => updateItemImeis(cartItem.item.id, e.target.value)}
                            className="w-full text-[11px] font-mono focus:outline-none bg-transparent"
                          />
                        </div>
                      )}

                      {/* Quantity & Item Discount Controls */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity - 1)}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity + 1)}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900">
                            {formatNPR(lineTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checkout Financials */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono font-medium text-slate-800">{formatNPR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" />
                  Special Discount (रु)
                </span>
                <input
                  id={discountInputId}
                  type="number"
                  min="0"
                  value={specialDiscount || ''}
                  onChange={(e) => setSpecialDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono text-xs"
                />
              </div>
              {pointsDiscountAmount > 0 && (
                <div className="flex justify-between items-center text-amber-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Loyalty Reward ({redeemPoints} pts)
                  </span>
                  <span className="font-mono">-{formatNPR(pointsDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Nepal VAT ({shopConfig.defaultTaxRate}%)</span>
                <span className="font-mono text-slate-600">{formatNPR(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Expected Profit on Bill</span>
                <span className="font-mono">+{formatNPR(totalProfit)} ({profitMargin.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span className="font-mono text-emerald-800 font-black">
                  {formatNPR(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Payment Channel (नेपाल)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI_QR')}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'UPI_QR'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Scan & Pay with FonePay, eSewa, or any Nepali Mobile Banking App"
                >
                  <div className="flex items-center -space-x-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 ring-1 ring-white"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600 ring-1 ring-white"></span>
                  </div>
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>FonePay / eSewa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CARD'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Card POS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cash (रु)</span>
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              id="proceed-checkout-btn"
              onClick={handleProceedToPayment}
              disabled={cart.length === 0}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {paymentMethod === 'UPI_QR' ? (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>Generate FonePay & eSewa QR ({formatNPR(grandTotal)})</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Complete Sale & Print Tax Bill ({formatNPR(grandTotal)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
