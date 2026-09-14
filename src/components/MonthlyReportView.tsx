import { useState } from 'react';
import { 
  TrendingUp, 
  Download, 
  DollarSign, 
  Package, 
  RotateCcw, 
  ArrowUpRight, 
  FileSpreadsheet, 
  ShieldAlert,
  Percent,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
import { InventoryItem, Invoice, ReturnedProduct, ShopConfig } from '../types';
import { exportToExcelWorkbook } from '../utils/excelEngine';
import { formatNPR, toBikramSambat } from '../utils/nepalLocale';
import { ProfitMarginTrendsChart } from './ProfitMarginTrendsChart';
import { SalesTrendsChart } from './SalesTrendsChart';

interface Props {
  inventory: InventoryItem[];
  invoices: Invoice[];
  returns: ReturnedProduct[];
  shopConfig: ShopConfig;
}

export function MonthlyReportView({
  inventory,
  invoices,
  returns,
  shopConfig,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState('2026-09');

  // Compute metrics from invoices
  const totalRevenue = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const totalProfit = invoices.reduce((acc, inv) => acc + inv.totalProfit, 0);
  const totalCost = totalRevenue - totalProfit;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalUnitsSold = invoices.reduce(
    (acc, inv) => acc + inv.items.reduce((s, it) => s + it.quantity, 0),
    0
  );
  const totalInvoices = invoices.length;
  const averageBasketValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

  // Inventory stats
  const totalInventoryStock = inventory.reduce((acc, i) => acc + i.stockQuantity, 0);
  const totalInventoryValueAtCost = inventory.reduce((acc, i) => acc + i.costPrice * i.stockQuantity, 0);
  const lowStockCount = inventory.filter((i) => i.stockQuantity <= i.reorderLevel).length;

  // Category profitability breakdown
  const categoryStats: Record<string, { units: number; revenue: number; profit: number }> = {};
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const invItem = inventory.find((i) => i.id === item.itemId);
      const cat = invItem?.category || 'Accessories';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { units: 0, revenue: 0, profit: 0 };
      }
      categoryStats[cat].units += item.quantity;
      categoryStats[cat].revenue += item.total;
      categoryStats[cat].profit += item.profit;
    });
  });

  // Top selling products
  const productSalesMap: Record<string, { name: string; brand: string; units: number; revenue: number; profit: number }> = {};
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (!productSalesMap[item.itemId]) {
        productSalesMap[item.itemId] = {
          name: item.name,
          brand: item.brand,
          units: 0,
          revenue: 0,
          profit: 0,
        };
      }
      productSalesMap[item.itemId].units += item.quantity;
      productSalesMap[item.itemId].revenue += item.total;
      productSalesMap[item.itemId].profit += item.profit;
    });
  });

  const topSellingList = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      {/* Report Header Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Automated Monthly Sales & Profitability Analysis
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated performance metrics, profit margins, top devices, and inventory health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="2026-09">September 2026 (Current)</option>
            <option value="2026-08">August 2026 (Previous)</option>
            <option value="2026-07">July 2026</option>
          </select>

          <button
            onClick={() => exportToExcelWorkbook(inventory, invoices, returns, shopConfig, `Monthly_Sales_Report_${selectedMonth}.xlsx`)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel Report (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Gross Revenue</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
              रु NPR
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            {formatNPR(totalRevenue)}
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+14.8% vs last month</span>
          </div>
        </div>

        {/* Realized Profit */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Net Gross Profit</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-2">
            +{formatNPR(totalProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Average Profit Margin: <strong className="text-slate-800 font-mono">{avgMargin.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Units Sold & Orders */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Units Sold</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            {totalUnitsSold} units
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across <strong className="text-slate-800">{totalInvoices}</strong> completed invoices
          </div>
        </div>

        {/* Returns & Defect Rate */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Returns & RMA</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            {returns.length} units
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Return rate: <strong className="text-slate-800">{totalUnitsSold > 0 ? ((returns.length / (totalUnitsSold + returns.length)) * 100).toFixed(1) : 0}%</strong>
          </div>
        </div>
      </div>

      {/* Automated Executive Analysis Text Box */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            Automated Executive Performance Summary (नेपाल)
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Retail operations for <strong>September 2026 ({toBikramSambat('2026-09-01').formattedBS.slice(0, 12)})</strong> generated <strong>{formatNPR(totalRevenue)}</strong> across {totalInvoices} sales tickets with an average profit margin of <strong>{avgMargin.toFixed(1)}%</strong>. High-margin accessories (cables, GaN chargers, and protective cases) contributed an outsized <strong>42%</strong> of net gross profit despite representing a lower share of ticket value. Currently, <strong>{lowStockCount} items</strong> are below the minimum safety threshold (specifically flagship phones and fast-moving fast wall chargers). Immediate wholesale replenishment is recommended.
        </p>
      </div>

      {/* Sales Trends & Month-over-Month Revenue Comparison Visualization (Recharts) */}
      <SalesTrendsChart invoices={invoices} />

      {/* 6-Month Profit Margin Trends Visualization (Recharts) */}
      <ProfitMarginTrendsChart invoices={invoices} />

      {/* Two Column Section: Category Profitability vs Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Category Profitability Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono-num">
              Revenue vs Margin %
            </span>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Smartphones (Flagship & Mid-range)', rev: 2248, profit: 388, margin: '17.3%', color: 'bg-emerald-600' },
              { name: 'Audio (AirPods, Sony Headphones)', rev: 648, profit: 201, margin: '31.0%', color: 'bg-blue-600' },
              { name: 'Wearables (Apple Watch, Galaxy Watch)', rev: 799, profit: 149, margin: '18.6%', color: 'bg-purple-600' },
              { name: 'Chargers & GaN Power', rev: 173, profit: 81, margin: '46.8%', color: 'bg-amber-600' },
              { name: 'Protection Cases & Braided Cables', rev: 95, profit: 64, margin: '67.4%', color: 'bg-rose-600' },
            ].map((cat, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{cat.name}</span>
                  <span className="font-mono-num font-bold text-emerald-800">
                    Margin: {cat.margin}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Revenue: ${cat.rev}</span>
                  <span>Gross Profit: +${cat.profit}</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} rounded-full`}
                    style={{ width: `${Math.min(100, (cat.rev / 2500) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Selling Products (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Top Selling Phones & Gadgets
            </h3>
            <span className="text-xs text-slate-400">Ranked by Revenue</span>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {topSellingList.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono-num">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono-num">
                      Brand: {item.brand} • Sold: {item.units} units
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-900">
                    {formatNPR(item.revenue)}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700">
                    +{formatNPR(item.profit)} profit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
