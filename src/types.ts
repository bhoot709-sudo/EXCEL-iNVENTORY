export type ProductCategory = 
  | 'Smartphones' 
  | 'Tablets' 
  | 'Audio' 
  | 'Wearables' 
  | 'Chargers & Power' 
  | 'Protection & Cases' 
  | 'Cables & Adapters';

export interface InventoryItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: ProductCategory;
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

export interface ReturnedProduct {
  id: string;
  returnDate: string;
  invoiceNumber: string;
  itemBarcode: string;
  itemName: string;
  itemBrand: string;
  serialOrImei?: string;
  customerName: string;
  customerPhone: string;
  returnReason: 'DEFECTIVE_HARDWARE' | 'WRONG_ITEM' | 'BUYER_REMORSE' | 'BATTERY_ISSUE' | 'DAMAGED_IN_BOX';
  condition: 'RESTOCKABLE_NEW' | 'DEFECTIVE_RMA' | 'OPEN_BOX_DISCOUNT';
  actionTaken: 'REFUNDED' | 'REPLACED' | 'STORE_CREDIT';
  refundAmount: number;
  restockedToInventory: boolean;
  notes?: string;
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
