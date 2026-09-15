import React from 'react';
import { 
  ShoppingCart, 
  PackagePlus, 
  Tag, 
  Wallet, 
  Clock, 
  Plus, 
  Boxes, 
  AlertTriangle,
  ChevronRight,
  Zap
} from 'lucide-react';
import { formatNPR } from '../utils/nepalLocale';

interface Props {
  onOpenNewSale: () => void;
  onOpenRestock: () => void;
  onOpenAddProductCategory: () => void;
  onOpenCustomerDues: () => void;
  onOpenOrderStatusUpdater: () => void;
  lowStockCount?: number;
  customerDuesCount?: number;
  totalDuesAmount?: number;
  pendingOrdersCount?: number;
  categoriesCount?: number;
}

export function DailyRoutineActionBar({
  onOpenNewSale,
  onOpenRestock,
  onOpenAddProductCategory,
  onOpenCustomerDues,
  onOpenOrderStatusUpdater,
  lowStockCount = 0,
  customerDuesCount = 0,
  totalDuesAmount = 0,
  pendingOrdersCount = 0,
  categoriesCount = 7,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
      {/* Top Banner Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-2xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span>Daily Routine Quick Tasks</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide uppercase">
                One-Click Actions
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Essential day-to-day retail operations: instant sales, restocks, new products, credit ledger & orders.
            </p>
          </div>
        </div>
      </div>

      {/* 5 Routine Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. New Sale (POS) */}
        <button
          type="button"
          onClick={onOpenNewSale}
          className="group text-left p-3.5 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono">
              POS Terminal
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors flex items-center justify-between">
              <span>New Sale</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Start fresh retail bill & QR payment
            </p>
          </div>
        </button>

        {/* 2. Restocks */}
        <button
          type="button"
          onClick={onOpenRestock}
          className="group text-left p-3.5 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 via-blue-50/40 to-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <PackagePlus className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              lowStockCount > 0 
                ? 'bg-amber-100 text-amber-800 animate-pulse' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {lowStockCount > 0 ? `${lowStockCount} Low Stock` : 'Optimal Stock'}
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors flex items-center justify-between">
              <span>Restock Items</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Replenish depleted quantities
            </p>
          </div>
        </button>

        {/* 3. Add Product & Categories */}
        <button
          type="button"
          onClick={onOpenAddProductCategory}
          className="group text-left p-3.5 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-violet-50/40 to-white hover:border-violet-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-violet-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Tag className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-violet-800 bg-violet-100/80 px-2 py-0.5 rounded-md">
              {categoriesCount} Categories
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-violet-700 transition-colors flex items-center justify-between">
              <span>+ Product & Category</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Create SKU, barcode & category
            </p>
          </div>
        </button>

        {/* 4. Due Amounts on Customers (उधारो) */}
        <button
          type="button"
          onClick={onOpenCustomerDues}
          className="group text-left p-3.5 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-white hover:border-amber-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-amber-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md font-mono">
              {customerDuesCount} Pending
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-800 transition-colors flex items-center justify-between">
              <span>Customer Dues (उधारो)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 font-mono">
              {totalDuesAmount > 0 ? `${formatNPR(totalDuesAmount)} due` : 'Zero outstanding dues'}
            </p>
          </div>
        </button>

        {/* 5. Order Status Updater */}
        <button
          type="button"
          onClick={onOpenOrderStatusUpdater}
          className="group text-left p-3.5 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-indigo-50/40 to-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              pendingOrdersCount > 0
                ? 'bg-rose-100 text-rose-800 animate-pulse'
                : 'bg-indigo-100 text-indigo-800'
            }`}>
              {pendingOrdersCount} Inquiries
            </span>
          </div>

          <div className="mt-3">
            <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors flex items-center justify-between">
              <span>Order Status Updater</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              Update pre-orders, repairs & quotes
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
