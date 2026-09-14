import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  Minus,
} from 'lucide-react';
import { Invoice } from '../types';

interface Props {
  invoices: Invoice[];
}

export interface MonthOverMonthDataPoint {
  monthKey: string;            // e.g. "2026-04"
  monthLabel: string;          // e.g. "Apr 2026"
  shortLabel: string;          // e.g. "Apr"
  revenue: number;             // Revenue in that month
  previousRevenue: number | null; // Prior month revenue for direct comparison
  momDollarChange: number | null; // revenue - previousRevenue
  momPercentChange: number | null; // ((revenue - previousRevenue) / previousRevenue) * 100
  profit: number;
  orderCount: number;
  avgOrderValue: number;
}

export function SalesTrendsChart({ invoices }: Props) {
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'all'>('6m');
  const [chartMetric, setChartMetric] = useState<'comparison' | 'growthRate' | 'revenueOnly'>('comparison');

  // Aggregate monthly data chronologically
  const monthlyData = useMemo<MonthOverMonthDataPoint[]>(() => {
    // Collect all valid invoice dates
    const dateList = invoices
      .map((inv) => inv.date?.slice(0, 7))
      .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}$/.test(d)))
      .sort();

    // Default to Sept 2026 if empty
    let latestYear = 2026;
    let latestMonth = 9;

    if (dateList.length > 0) {
      const last = dateList[dateList.length - 1];
      const [y, m] = last.split('-').map(Number);
      if (y && m) {
        latestYear = y;
        latestMonth = m;
      }
    }

    // Determine how many months to generate
    const totalMonths = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 18;

    // Generate continuous timeline backwards from latest
    const timeline: { year: number; month: number; key: string }[] = [];
    for (let i = totalMonths - 1; i >= 0; i--) {
      const d = new Date(latestYear, latestMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      timeline.push({ year: y, month: m, key });
    }

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Compute raw revenue per month
    const rawData = timeline.map(({ year, month, key }) => {
      const monthInvoices = invoices.filter((inv) => inv.date && inv.date.startsWith(key));
      const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
      const profit = monthInvoices.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
      const orderCount = monthInvoices.length;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      return {
        monthKey: key,
        monthLabel: `${monthNames[month - 1]} ${year}`,
        shortLabel: monthNames[month - 1],
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        orderCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      };
    });

    // Compute Month-over-Month metrics
    return rawData.map((item, index) => {
      let previousRevenue: number | null = null;
      let momDollarChange: number | null = null;
      let momPercentChange: number | null = null;

      if (index > 0) {
        previousRevenue = rawData[index - 1].revenue;
        momDollarChange = Math.round((item.revenue - previousRevenue) * 100) / 100;
        if (previousRevenue > 0) {
          momPercentChange = Number((((item.revenue - previousRevenue) / previousRevenue) * 100).toFixed(1));
        } else if (item.revenue > 0) {
          momPercentChange = 100.0;
        } else {
          momPercentChange = 0.0;
        }
      }

      return {
        ...item,
        previousRevenue,
        momDollarChange,
        momPercentChange,
      };
    });
  }, [invoices, timeRange]);

  // Overall metrics & statistics for summary badges
  const stats = useMemo(() => {
    if (monthlyData.length === 0) {
      return {
        latestRevenue: 0,
        prevRevenue: 0,
        latestMomDollar: 0,
        latestMomPercent: 0,
        peakMonth: null as MonthOverMonthDataPoint | null,
        avgMonthlyRevenue: 0,
        avgMomPercent: 0,
        positiveGrowthCount: 0,
      };
    }

    const latest = monthlyData[monthlyData.length - 1];
    const prev = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

    const latestRevenue = latest.revenue;
    const prevRevenue = prev ? prev.revenue : 0;
    const latestMomDollar = latest.momDollarChange ?? 0;
    const latestMomPercent = latest.momPercentChange ?? 0;

    let peak = monthlyData[0];
    let sumRevenue = 0;
    let sumMom = 0;
    let momCount = 0;
    let positiveCount = 0;

    monthlyData.forEach((pt) => {
      sumRevenue += pt.revenue;
      if (pt.revenue > peak.revenue) {
        peak = pt;
      }
      if (pt.momPercentChange !== null) {
        sumMom += pt.momPercentChange;
        momCount++;
        if (pt.momPercentChange > 0) {
          positiveCount++;
        }
      }
    });

    const avgMonthlyRevenue = monthlyData.length > 0 ? sumRevenue / monthlyData.length : 0;
    const avgMomPercent = momCount > 0 ? sumMom / momCount : 0;

    return {
      latestRevenue,
      prevRevenue,
      latestMomDollar,
      latestMomPercent,
      peakMonth: peak,
      avgMonthlyRevenue,
      avgMomPercent,
      positiveGrowthCount: positiveCount,
    };
  }, [monthlyData]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Sales Trends & Month-over-Month Revenue Comparison
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-month revenue trajectory, benchmark comparison, and MoM velocity analysis
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Time Range & Metric Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setTimeRange('6m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === '6m'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 6 Months
            </button>
            <button
              onClick={() => setTimeRange('12m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === '12m'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Months
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Extended View
            </button>
          </div>

          {/* Chart View Mode Selector */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setChartMetric('comparison')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartMetric === 'comparison'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Compare Current Month vs Previous Month Benchmark"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>MoM Benchmark</span>
            </button>
            <button
              onClick={() => setChartMetric('growthRate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartMetric === 'growthRate'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Revenue ($) with MoM Growth % Line"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Growth % Dual Axis</span>
            </button>
            <button
              onClick={() => setChartMetric('revenueOnly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartMetric === 'revenueOnly'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Clean Revenue Line Only"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Revenue Curve</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Latest Month Revenue & MoM Delta */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Latest Month Revenue</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-slate-900 mt-1.5">
            ${stats.latestRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {stats.latestMomPercent >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="w-3 h-3" />
                +{stats.latestMomPercent.toFixed(1)}% MoM
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                <ArrowDownRight className="w-3 h-3" />
                {stats.latestMomPercent.toFixed(1)}% MoM
              </span>
            )}
            <span className="text-[11px] font-mono-num text-slate-500">
              ({stats.latestMomDollar >= 0 ? `+$${stats.latestMomDollar.toFixed(0)}` : `-$${Math.abs(stats.latestMomDollar).toFixed(0)}`})
            </span>
          </div>
        </div>

        {/* Prior Month Benchmark */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Prior Month Baseline</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-slate-700 mt-1.5">
            ${stats.prevRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            Immediate baseline reference for current sales cycle
          </div>
        </div>

        {/* Peak Revenue Month */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Peak Sales Month</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-indigo-700 mt-1.5">
            ${stats.peakMonth ? stats.peakMonth.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '$0.00'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-semibold">
            Recorded in: <strong className="text-slate-800">{stats.peakMonth?.monthLabel || 'N/A'}</strong>
          </div>
        </div>

        {/* Average Monthly Run Rate */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Avg Monthly Run Rate</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold font-mono-num text-slate-900 mt-1.5">
            ${stats.avgMonthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Avg MoM Velocity: <strong className={stats.avgMomPercent >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
              {stats.avgMomPercent >= 0 ? `+${stats.avgMomPercent.toFixed(1)}%` : `${stats.avgMomPercent.toFixed(1)}%`}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Recharts Line Chart Container */}
      <div className="w-full bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/70">
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyData}
              margin={{ top: 20, right: chartMetric === 'growthRate' ? 25 : 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              
              {/* X Axis */}
              <XAxis
                dataKey="shortLabel"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />

              {/* Primary Y Axis (Revenue in $) */}
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
              />

              {/* Secondary Y Axis for MoM Growth Rate % */}
              {chartMetric === 'growthRate' && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#8b5cf6"
                  tick={{ fill: '#8b5cf6', fontSize: 11 }}
                  tickFormatter={(val) => `${val > 0 ? `+${val}%` : `${val}%`}`}
                  tickLine={false}
                  axisLine={false}
                />
              )}

              {/* Zero Reference Line for MoM Growth % */}
              {chartMetric === 'growthRate' && (
                <ReferenceLine
                  yAxisId="right"
                  y={0}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  label={{ value: '0% MoM Break-even', fill: '#94a3b8', fontSize: 10, position: 'insideBottomRight' }}
                />
              )}

              {/* Custom Interactive Tooltip */}
              <Tooltip content={<CustomSalesTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }}
              />

              {/* Prior Month Benchmark Line (Mode: comparison) */}
              {chartMetric === 'comparison' && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="previousRevenue"
                  name="Prior Month Benchmark ($)"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#94a3b8', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#64748b' }}
                />
              )}

              {/* Primary Actual Revenue Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Monthly Revenue ($)"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 5, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#3730a3', stroke: '#ffffff', strokeWidth: 3 }}
              />

              {/* MoM Growth % Line (Mode: growthRate) */}
              {chartMetric === 'growthRate' && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="momPercentChange"
                  name="MoM Growth Rate (%)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#047857' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-over-Month Sequence Breakdown Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Month-over-Month Performance Progression
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">
            Chronological performance comparison
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {monthlyData.map((pt, idx) => {
            const hasPrior = pt.momPercentChange !== null;
            const isPositive = (pt.momPercentChange ?? 0) >= 0;

            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all ${
                  idx === monthlyData.length - 1
                    ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-800">{pt.shortLabel}</span>
                  <span className="text-[10px] text-slate-400 font-mono-num">
                    {pt.monthKey.split('-')[0]}
                  </span>
                </div>

                <div className="text-sm font-extrabold font-mono-num text-slate-900 mt-1">
                  ${pt.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>

                <div className="mt-1.5 flex items-center gap-1">
                  {hasPrior ? (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDownRight className="w-2.5 h-2.5" />
                      )}
                      {isPositive ? `+${pt.momPercentChange}%` : `${pt.momPercentChange}%`}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-md">
                      <Minus className="w-2.5 h-2.5" />
                      Baseline
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 mt-1 font-mono-num">
                  {pt.orderCount} orders
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip component for recharts
function CustomSalesTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as MonthOverMonthDataPoint;

  return (
    <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-slate-200 min-w-[220px] text-xs space-y-2">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
        <span className="font-extrabold text-slate-900">{data.monthLabel}</span>
        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
          {data.orderCount} Orders
        </span>
      </div>

      <div className="space-y-1 font-mono-num">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Revenue:</span>
          <span className="font-extrabold text-indigo-700">
            ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {data.previousRevenue !== null && (
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-slate-500">Prior Month:</span>
            <span>
              ${data.previousRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {data.momDollarChange !== null && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-slate-500">MoM Variance:</span>
            <span className={`font-bold ${data.momDollarChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {data.momDollarChange >= 0 ? `+$${data.momDollarChange.toFixed(2)}` : `-$${Math.abs(data.momDollarChange).toFixed(2)}`}
              {data.momPercentChange !== null && ` (${data.momPercentChange >= 0 ? '+' : ''}${data.momPercentChange}%)`}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>Avg Order Value:</span>
          <span className="font-medium text-slate-800">
            ${data.avgOrderValue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
