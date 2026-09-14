import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  AreaChart, 
  Area, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  DollarSign, 
  Calendar, 
  Award, 
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Invoice } from '../types';

interface Props {
  invoices: Invoice[];
}

export interface MonthlyTrendPoint {
  monthKey: string;     // e.g. "2026-04"
  monthLabel: string;   // e.g. "Apr 2026"
  shortLabel: string;   // e.g. "Apr"
  revenue: number;
  cost: number;
  profit: number;
  margin: number;       // e.g. 24.5%
  invoiceCount: number;
  unitsSold: number;
}

export function ProfitMarginTrendsChart({ invoices }: Props) {
  const [chartMode, setChartMode] = useState<'margin' | 'combined' | 'breakdown'>('margin');

  // Compute last 6 months chronologically from the latest invoice date
  const trendData = useMemo<MonthlyTrendPoint[]>(() => {
    let latestYear = 2026;
    let latestMonth = 9; // September

    if (invoices.length > 0) {
      const dates = invoices
        .map((inv) => inv.date?.slice(0, 7))
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        const last = dates[dates.length - 1];
        const [y, m] = last.split('-').map(Number);
        if (y && m) {
          latestYear = y;
          latestMonth = m;
        }
      }
    }

    const monthKeys: { year: number; month: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(latestYear, latestMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthKeys.push({ year: y, month: m, key });
    }

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return monthKeys.map(({ year, month, key }) => {
      const monthInvoices = invoices.filter((inv) => inv.date && inv.date.startsWith(key));
      const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
      const profit = monthInvoices.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
      const cost = Math.max(0, revenue - profit);
      const margin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
      const unitsSold = monthInvoices.reduce(
        (sum, inv) => sum + (inv.items ? inv.items.reduce((s, it) => s + (it.quantity || 0), 0) : 0),
        0
      );

      return {
        monthKey: key,
        monthLabel: `${monthNames[month - 1]} ${year}`,
        shortLabel: monthNames[month - 1],
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin,
        invoiceCount: monthInvoices.length,
        unitsSold,
      };
    });
  }, [invoices]);

  // Aggregate statistics across the 6-month window
  const stats = useMemo(() => {
    const totalRev = trendData.reduce((acc, d) => acc + d.revenue, 0);
    const totalProf = trendData.reduce((acc, d) => acc + d.profit, 0);
    const avgMargin = totalRev > 0 ? Number(((totalProf / totalRev) * 100).toFixed(1)) : 0;

    let peakMonth = trendData[0] || { monthLabel: '', margin: 0 };
    let lowestMonth = trendData[0] || { monthLabel: '', margin: 0 };

    trendData.forEach((d) => {
      if (d.margin > peakMonth.margin) peakMonth = d;
      if (d.margin < lowestMonth.margin && d.revenue > 0) lowestMonth = d;
    });

    const firstMonth = trendData[0];
    const latestMonth = trendData[trendData.length - 1];
    const marginDelta = latestMonth && firstMonth ? latestMonth.margin - firstMonth.margin : 0;

    return {
      totalRev,
      totalProf,
      avgMargin,
      peakMonth,
      lowestMonth,
      marginDelta,
      currentMonthMargin: latestMonth ? latestMonth.margin : 0,
      currentMonthLabel: latestMonth ? latestMonth.monthLabel : '',
    };
  }, [trendData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyTrendPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 text-xs min-w-[210px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {data.monthLabel}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 font-mono-num border border-emerald-500/30">
              {data.margin.toFixed(1)}% Margin
            </span>
          </div>

          <div className="space-y-1.5 font-mono-num text-[11px]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Net Profit:</span>
              <span className="font-bold text-emerald-400">+${data.profit.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Gross Revenue:</span>
              <span className="font-bold text-slate-100">${data.revenue.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Wholesale Cost:</span>
              <span className="text-slate-400">${data.cost.toFixed(2)}</span>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-[10px]">
              <span>Invoices: {data.invoiceCount}</span>
              <span>Units: {data.unitsSold}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                6-Month Profit Margin Trends
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic margin trajectory and realized profit aggregated across {invoices.length} store sales tickets
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setChartMode('margin')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              chartMode === 'margin'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Margin % Curve
          </button>
          <button
            onClick={() => setChartMode('combined')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              chartMode === 'combined'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Margin & Net Profit ($)
          </button>
          <button
            onClick={() => setChartMode('breakdown')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              chartMode === 'breakdown'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Revenue vs Cost vs Profit
          </button>
        </div>
      </div>

      {/* 4 Quick Stat Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>6-Mo Avg Margin</span>
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-slate-900 mt-1">
            {stats.avgMargin.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Benchmark retail target: &ge;20%
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Peak Margin Month</span>
            <Award className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-blue-700 mt-1">
            {stats.peakMonth.margin.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats.peakMonth.monthLabel} (High accessories)
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>6-Mo Realized Profit</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-emerald-700 mt-1">
            +${stats.totalProf.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            From ${stats.totalRev.toFixed(2)} gross sales
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>6-Month Trajectory</span>
            {stats.marginDelta >= 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>
          <div className={`text-xl font-extrabold font-mono-num mt-1 ${
            stats.marginDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            {stats.marginDelta >= 0 ? `+${stats.marginDelta.toFixed(1)}%` : `${stats.marginDelta.toFixed(1)}%`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Current: {stats.currentMonthMargin.toFixed(1)}% ({stats.currentMonthLabel.split(' ')[0]})
          </div>
        </div>
      </div>

      {/* Recharts Chart Visualization Canvas */}
      <div className="w-full h-[320px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'margin' ? (
            /* Mode 1: Pure Margin % Trend Area & Line with Reference Line */
            <AreaChart data={trendData} margin={{ top: 15, right: 25, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="shortLabel" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis 
                unit="%" 
                domain={[0, (dataMax: number) => Math.max(35, Math.ceil(dataMax + 5))]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={stats.avgMargin} 
                stroke="#059669" 
                strokeDasharray="4 4" 
                label={{ 
                  value: `Avg ${stats.avgMargin.toFixed(1)}%`, 
                  fill: '#059669', 
                  fontSize: 10, 
                  fontWeight: 700, 
                  position: 'insideTopRight' 
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="margin" 
                name="Profit Margin %"
                stroke="#059669" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#marginGradient)" 
                activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : chartMode === 'combined' ? (
            /* Mode 2: Dual Axis - Profit Bar + Margin Line Overlay */
            <ComposedChart data={trendData} margin={{ top: 15, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="shortLabel" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              {/* Left Y-Axis: Net Profit ($) */}
              <YAxis 
                yAxisId="left"
                tickFormatter={(val) => `$${val}`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              {/* Right Y-Axis: Margin % */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                unit="%"
                domain={[0, (dataMax: number) => Math.max(35, Math.ceil(dataMax + 5))]}
                tick={{ fill: '#059669', fontSize: 11, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
              />
              <Bar 
                yAxisId="left"
                dataKey="profit" 
                name="Net Gross Profit ($)" 
                fill="#3b82f6" 
                radius={[6, 6, 0, 0]} 
                maxBarSize={38}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="margin" 
                name="Profit Margin %" 
                stroke="#059669" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#059669' }}
                activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </ComposedChart>
          ) : (
            /* Mode 3: Revenue vs Cost vs Profit Stacked/Grouped */
            <ComposedChart data={trendData} margin={{ top: 15, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="shortLabel" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(val) => `$${val}`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                iconType="circle"
              />
              <Bar dataKey="revenue" name="Gross Revenue ($)" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Bar dataKey="cost" name="Wholesale Cost ($)" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Line 
                type="monotone" 
                dataKey="profit" 
                name="Net Profit ($)" 
                stroke="#10b981" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: '#10b981' }} 
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 6-Month Data Table Row Breakdown */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Monthly Performance & Margin Breakdown Table
          </span>
          <span className="text-[11px] text-slate-400">
            Real-time computed from store sales invoices
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {trendData.map((d) => (
            <div 
              key={d.monthKey} 
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col justify-between space-y-1 hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{d.monthLabel}</span>
                <span className="text-[10px] text-slate-400 font-mono-num">{d.invoiceCount} inv</span>
              </div>
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-[11px] text-slate-500">Profit:</span>
                <span className="font-mono-num font-bold text-emerald-700">
                  +${d.profit.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Rev:</span>
                <span className="font-mono-num text-slate-700 font-semibold">
                  ${d.revenue.toFixed(0)}
                </span>
              </div>
              <div className="pt-1 mt-0.5 border-t border-slate-200/70 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold">Margin:</span>
                <span className={`font-mono-num font-extrabold text-[11px] px-1.5 py-0.2 rounded ${
                  d.margin >= 25 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : d.margin >= 20 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {d.margin.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
