export type ProductCategory = 
  | 'Smartphones' 
  | 'Tablets' 
  | 'Audio' 
  | 'Wearables' 
  | 'Chargers & Power' 
  | 'Protection & Cases' 
  | 'Cables & Adapters'
  | (string & {});

export interface InventoryItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: ProductCategory;
  modelNumber?: string;   // Model number / code (e.g. A2848, SM-S928B)
  model?: string;         // Alternative model alias
  costPrice: number;      // Wholesale / Purchase Cost
  sellingPrice: number;   // Retail Price
  stockQuantity: number;  // Current stock level
  reorderLevel: number;   // Low stock threshold
  imeiRequired: boolean;  // E.g. for high-value phones
  supplier: string;
  lastRestockedDate: string;
}

export interface CartItem {
  item: InventoryItem;
  quantity: number;
  selectedImeis?: string[];
  unitDiscount: number; // in currency
}

export interface InvoiceItem {
  itemId: string;
  sku: string;
  name: string;
  brand: string;
  barcode: string;
  imeiList?: string[];
  quantity: number;
  costPrice: number;
  unitPrice: number;
  discount: number;
  total: number;
  profit: number;
}

export type CustomerTier = 'Bronze' | 'Silver' | 'Gold' | 'VIP Platinum';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  loyaltyPoints: number;
  tier: CustomerTier;
  dueAmount?: number; // Outstanding credit / udhaaro balance
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number; // percentage e.g. 8%
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  totalProfit: number;
  paymentMethod: 'UPI_QR' | 'CARD' | 'CASH' | 'SPLIT';
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED';
  transactionRef?: string;
  notes?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  customerPreviousPoints?: number;
  customerNewPoints?: number;
}

export type QueryCategory = 
  | 'PREORDER' 
  | 'SPECIAL_REQUEST' 
  | 'PRICE_ENQUIRY' 
  | 'REPAIR_SERVICE' 
  | 'STOCK_RESERVATION';

export type QueryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type QueryStatus = 'PENDING' | 'FOLLOWED_UP' | 'FULFILLED' | 'CANCELLED';

export interface DailyOrderQuery {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 02:45 PM NPT
  bsDate?: string; // e.g. 2083 Bhadra 29 BS
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  queryType: QueryCategory;
  deviceModel: string;
  estimatedBudget?: number;
  notes: string;
  priority: QueryPriority;
  status: QueryStatus;
  followedUpAt?: string;
  assignedStaff?: string;
  resolutionNotes?: string;
}

export type ReturnReason = 
  | 'DEFECTIVE_HARDWARE' 
  | 'WRONG_ITEM' 
  | 'BUYER_REMORSE' 
  | 'BATTERY_ISSUE' 
  | 'DAMAGED_IN_BOX'
  | 'SCREEN_DEFECT'
  | 'SOFTWARE_CRASH'
  | 'AUDIO_PORT_ISSUE'
  | 'OTHER';

export type WarrantyStatus = 
  | 'UNDER_WARRANTY' 
  | 'OUT_OF_WARRANTY' 
  | 'EXTENDED_WARRANTY' 
  | 'VOID_DAMAGE' 
  | 'VENDOR_RMA';

export type ReturnResolution = 
  | 'REFUND' 
  | 'EXCHANGE' 
  | 'REPAIR' 
  | 'STORE_CREDIT' 
  | 'REJECTED';

export interface ReturnedProduct {
  id: string;
  returnDate: string;
  invoiceNumber: string;
  purchaseDate?: string;
  itemBarcode: string;
  itemName: string;
  itemBrand: string;
  serialOrImei?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  returnReason: ReturnReason;
  condition: 'RESTOCKABLE_NEW' | 'DEFECTIVE_RMA' | 'OPEN_BOX_DISCOUNT';
  warrantyStatus?: WarrantyStatus;
  warrantyExpiryDate?: string;
  warrantyDurationMonths?: number;
  resolution?: ReturnResolution;
  actionTaken?: 'REFUNDED' | 'REPLACED' | 'STORE_CREDIT' | 'REPAIRED' | 'REJECTED';
  refundAmount: number;
  repairCost?: number;
  exchangeItemName?: string;
  restockedToInventory: boolean;
  notes?: string;
  status?: 'RECEIVED' | 'IN_DIAGNOSIS' | 'IN_REPAIR' | 'RESOLVED' | 'CLOSED';
}

export type ActionCategory = 
  | 'SALE'
  | 'RESTOCK'
  | 'PRODUCT'
  | 'CATEGORY'
  | 'DUE_SETTLEMENT'
  | 'CREDIT_ENTRY'
  | 'ORDER_UPDATE'
  | 'ROUTINE_LAUNCH'
  | 'INVENTORY_UPDATE'
  | 'RETURN_RMA'
  | 'CUSTOMER'
  | 'MARKET_SCOUT'
  | 'GENERAL_ACTION';

export interface ActionLog {
  id: string;
  timestamp: string;      // ISO string e.g. 2026-09-16T12:00:00.000Z
  date: string;           // YYYY-MM-DD
  time: string;           // e.g. 05:45 PM NPT
  bsDate?: string;        // e.g. 2083 Bhadra 31 BS
  category: ActionCategory;
  actionTitle: string;
  description: string;
  staffName?: string;
  source: 'DAILY_ROUTINE_BAR' | 'POS_TERMINAL' | 'RESTOCK_MODAL' | 'PRODUCT_MODAL' | 'DUES_MODAL' | 'ORDER_MODAL' | 'MARKET_SCOUT' | 'MANUAL';
  status: 'SUCCESS' | 'PENDING' | 'CANCELLED';
  metadata?: {
    itemId?: string;
    itemName?: string;
    quantity?: number;
    amount?: number;
    customerId?: string;
    customerName?: string;
    invoiceNumber?: string;
    orderId?: string;
    previousStatus?: string;
    newStatus?: string;
    details?: string;
    categoryName?: string;
    paymentMethod?: string;
    supplier?: string;
    [key: string]: any;
  };
}

export interface ShopConfig {
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxId: string; // GSTIN / VAT / EIN
  currency: string;
  currencySymbol: string;
  merchantUpiId: string; // E.g. gadgetstore@icici or merchant link
  defaultTaxRate: number;
  returnPolicyDays: number;
}

export interface MonthlySalesSummary {
  month: string; // e.g., '2026-08', '2026-09'
  monthName: string; // 'September 2026'
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  unitsSold: number;
  invoicesCount: number;
  topSellingItems: { name: string; brand: string; units: number; revenue: number }[];
  categoryBreakdown: { category: string; revenue: number; profit: number; percentage: number }[];
  returnsCount: number;
  refundedValue: number;
}

export interface RegionalDealerInfo {
  name: string;
  hubLocation: string;
  dealerType: 'Authorized National Importer' | 'Regional Main Distributor' | 'Wholesale Mobile Depot' | 'Direct Border Importer';
  contactPhone?: string;
  keyBrandsCovered: string[];
  averageLeadTime: string;
  creditTerms?: string;
}

export interface MarketScoutTrendingItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  searchVolumeLevel: 'VERY HIGH' | 'HIGH' | 'TRENDING' | 'STEADY';
  estimatedRetailPrice: number;
  estimatedCostPrice: number;
  profitMarginPercent: number;
  priceSource: string; // e.g. 'Official Brand Website (Nepal)', 'Gadgets in Nepal / GadgetsByte', 'Daraz Nepal Mall', 'Authorized Distributor'
  sourceUrl?: string;
  priceVerified: boolean;
  liveAvailability: 'IN STOCK' | 'HIGH DEMAND' | 'NEW LAUNCH' | 'PRE-ORDER';
  demandReason: string;
  targetAudience: string;
  recommendedInitialStock: number;
  stockPriority: 'MUST HAVE' | 'HIGH PROFIT' | 'TREND EXPLORER';
  suggestedSku: string;
  barcode: string;
  imeiRequired: boolean;
  marketHub?: string;
  regionalDealer?: string;
  regionalLeadTime?: string;
  regionalDemandProfile?: string;
}

export interface MarketScoutReport {
  location: string;
  category: string;
  query?: string;
  generatedAt: string;
  marketSummary: string;
  sourcesConsulted: string[];
  topSearchKeywords: string[];
  trendingItems: MarketScoutTrendingItem[];
  regionalDealersList?: RegionalDealerInfo[];
  regionalLogisticsInsight?: string;
  sourcingAdvice: string[];
  note?: string;
}

export interface KeywordSpikeAlert {
  keyword: string;
  location: string;
  searchVolume: 'VERY HIGH' | 'HIGH' | 'TRENDING' | 'STEADY';
  surgePercent: number;
  category?: string;
  timestamp: string;
  priceRange?: string;
  demandSummary?: string;
}

export type LabelReminderSource = 'NEW_PRODUCT' | 'RESTOCK' | 'MARKET_SCOUT' | 'EXCEL_IMPORT' | 'MANUAL';
export type LabelReminderStatus = 'PENDING' | 'PRINTED' | 'STICKERED';

export interface LabelPrintReminder {
  id: string;
  itemId: string;
  itemName: string;
  brand: string;
  category: string;
  sku: string;
  barcode: string;
  sellingPrice: number;
  costPrice?: number;
  quantityNeeded: number;
  createdAt: string; // ISO string
  createdTime: string; // formatted NPT / time
  source: LabelReminderSource;
  status: LabelReminderStatus;
  batchTag?: string;
  stickeredAt?: string;
  stickeredBy?: string;
  notes?: string;
}

export type TabKey = 'daily' | 'excel' | 'inventory' | 'pos' | 'customers' | 'returns' | 'monthly' | 'calendar';

