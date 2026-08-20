'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Receipt, Users, Truck, UtensilsCrossed,
  Table2, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, Clock,
  Calendar, Filter, ChevronDown, ChevronUp, Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { GlobalShortcutBar } from '@/components/shared/GlobalShortcutBar'

type PeriodType = 'today' | '7d' | '30d' | 'monthly'

interface DashboardPageProps {
  currentMode?: string
  onNavigate?: (mode: any) => void
}

export default function DashboardPage({ currentMode, onNavigate }: DashboardPageProps = {}) {
  const shopFetch = useShopFetch()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // Advanced filter state for the dashboard's "Sales Detail" table
  const [period, setPeriod] = useState<PeriodType>('today')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [tableFilter, setTableFilter] = useState('all')
  const [searchBillNo, setSearchBillNo] = useState('')
  const [expandedBill, setExpandedBill] = useState<string | null>(null)

  // Detailed sales data (filtered by the dashboard's own filter bar)
  const [salesData, setSalesData] = useState<any>(null)
  const [salesLoading, setSalesLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await shopFetch('/api/dashboard')
        const d = await res.json()
        if (mounted) setData(d)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [])

  // Compute from/to ISO strings for the sales-detail table
  const { fromIso, toIso } = useMemo(() => {
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    switch (period) {
      case 'today':
        return { fromIso: today.toISOString(), toIso: end.toISOString() }
      case '7d': {
        const d = new Date(today)
        d.setDate(d.getDate() - 6)
        return { fromIso: d.toISOString(), toIso: end.toISOString() }
      }
      case '30d': {
        const d = new Date(today)
        d.setDate(d.getDate() - 29)
        return { fromIso: d.toISOString(), toIso: end.toISOString() }
      }
      case 'monthly': {
        const d = new Date(today)
        d.setDate(1)
        return { fromIso: d.toISOString(), toIso: end.toISOString() }
      }
    }
  }, [period])

  // Load sales detail (filtered bills) from /api/reports
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setSalesLoading(true)
      try {
        const p = new URLSearchParams()
        p.set('from', fromIso)
        p.set('to', toIso)
        if (paymentFilter !== 'all') p.set('paymentMode', paymentFilter)
        if (tableFilter !== 'all') p.set('table', tableFilter)
        if (searchBillNo) p.set('billNo', searchBillNo)
        const res = await shopFetch(`/api/reports?${p.toString()}`)
        const d = await res.json()
        if (!cancelled) setSalesData(d)
      } finally {
        if (!cancelled) setSalesLoading(false)
      }
    }
    const t = setTimeout(load, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [fromIso, toIso, paymentFilter, tableFilter, searchBillNo, shopFetch])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const recentBills: any[] = data.recentBills || []
  const topItems: any[] = data.topItems || []
  const lowStock: any[] = data.lowStock || []
  const cashFlow: any = data.cashFlow || { salesIn: 0, otherIn: 0, expenses: 0, purchases: 0, otherOut: 0, deletedBills: 0, net: 0 }
  const chartData: any[] = data.chartData || []
  const catalog: any = data.catalog || { menuItems: 0, customers: 0, suppliers: 0 }
  const tables: any = data.tables || { occupied: 0, total: 0 }
  const deletedBills = (data as any).deletedBills || { amount: 0, count: 0 }

  const stats = [
    {
      title: "Today's Revenue",
      value: formatCurrency(data.today.revenue),
      sub: `${data.today.count} bills today`,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(data.month.revenue),
      sub: `${data.month.count} bills this month`,
      icon: Receipt,
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'All-Time Revenue',
      value: formatCurrency(data.allTime.revenue),
      sub: `${data.allTime.count} total bills`,
      icon: Wallet,
      gradient: 'from-violet-500 to-fuchsia-500',
    },
    {
      title: 'Tables Occupied',
      value: `${tables.occupied} / ${tables.total}`,
      sub: `${tables.total - tables.occupied} free`,
      icon: Table2,
      gradient: 'from-orange-500 to-rose-500',
    },
  ]

  const filteredSalesBills: any[] = salesData?.bills || []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Restaurant overview · auto-refreshing every 30s</p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-1 text-xs font-medium">
          <Clock className="w-3 h-3 mr-1" /> {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
        </Badge>
      </div>

      {/* Full-style global shortcut bar */}
      {onNavigate && currentMode && (
        <div className="rounded-2xl overflow-hidden shadow-md">
          <GlobalShortcutBar currentMode={currentMode as any} onNavigate={onNavigate} />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-95`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] sm:text-xs font-medium text-white/80 uppercase tracking-wide">{s.title}</span>
                  <s.icon className="w-4 h-4 text-white/80" />
                </div>
                <div className="text-xl sm:text-2xl font-bold">{s.value}</div>
                <div className="text-[10px] sm:text-xs text-white/70 mt-1">{s.sub}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart + recent bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <Card className="lg:col-span-2 border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Revenue Trend</CardTitle>
              <Badge variant="outline" className="text-[10px] px-2">7 Days</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-2 sm:px-4 pb-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v: number) => `₹${v}`}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <RechartsTooltip
                    formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']}
                    labelFormatter={(l: any) => new Date(l).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#revG)" dot={{ fill: '#f97316', r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">
                No revenue data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent bills */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Recent Bills</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="space-y-1.5">
              {recentBills.length > 0 ? (
                recentBills.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <Receipt className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 font-mono">#{b.billNo}</p>
                        <p className="text-[10px] text-slate-400">Table {b.tableNumber} · {timeAgo(b.paidAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">{formatCurrency(b.total)}</p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{b.paymentMode}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">No bills yet today</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Sales Detail with filters ──────────────────────────────────── */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 px-5 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-900">Sales Detail</CardTitle>
            <div className="text-[10px] text-slate-400">Click a row to expand</div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {/* Filter bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 px-2">
            <div className="space-y-1">
              <Label className="text-[10px] flex items-center gap-1"><Calendar className="w-3 h-3" /> Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="monthly">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Payment</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Table</Label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  <SelectItem value="0">Counter</SelectItem>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>Table {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] flex items-center gap-1"><Search className="w-3 h-3" /> Bill #</Label>
              <Input
                value={searchBillNo}
                onChange={(e) => setSearchBillNo(e.target.value)}
                placeholder="e.g. 1001"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2 w-6"></th>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2">Bill #</th>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2">Date</th>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2">Table</th>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2">Items</th>
                  <th className="text-left font-semibold text-slate-600 px-2 py-2">Payment</th>
                  <th className="text-right font-semibold text-slate-600 px-2 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesLoading ? (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400">Loading…</td></tr>
                ) : filteredSalesBills.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-slate-400">No bills match the current filters</td></tr>
                ) : (
                  filteredSalesBills.slice(0, 100).map((b: any) => {
                    const isExpanded = expandedBill === b.id
                    const items = (b.order?.items || []).filter((i: any) => i.status !== 'cancelled')
                    return (
                      <>
                        <tr key={b.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedBill(isExpanded ? null : b.id)}>
                          <td className="px-2 py-2 text-slate-400">{isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</td>
                          <td className="px-2 py-2 font-mono font-semibold text-slate-900">#{b.billNo}</td>
                          <td className="px-2 py-2 text-slate-600">{formatDateTime(b.paidAt)}</td>
                          <td className="px-2 py-2"><Badge variant="outline" className="text-[9px]">Table {b.tableNumber}</Badge></td>
                          <td className="px-2 py-2 text-slate-600">{items.length}</td>
                          <td className="px-2 py-2"><Badge variant="outline" className="text-[9px] uppercase">{b.paymentMode}</Badge></td>
                          <td className="px-2 py-2 text-right font-bold text-slate-900">{formatCurrency(b.total)}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${b.id}-items`} className="bg-amber-50/50">
                            <td colSpan={7} className="px-4 py-2">
                              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="text-left font-semibold text-slate-600 px-2 py-1">Item</th>
                                      <th className="text-right font-semibold text-slate-600 px-2 py-1">Qty</th>
                                      <th className="text-right font-semibold text-slate-600 px-2 py-1">Price</th>
                                      <th className="text-right font-semibold text-slate-600 px-2 py-1">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {items.map((it: any) => (
                                      <tr key={it.id}>
                                        <td className="px-2 py-1 text-slate-800 font-medium">{it.name}</td>
                                        <td className="px-2 py-1 text-right text-slate-600">{it.quantity}</td>
                                        <td className="px-2 py-1 text-right text-slate-600">{formatCurrency(it.price)}</td>
                                        <td className="px-2 py-1 text-right font-semibold text-slate-900">{formatCurrency(it.price * it.quantity)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
              {filteredSalesBills.length > 0 && (
                <tfoot className="bg-slate-900 text-white sticky bottom-0">
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-right font-semibold">
                      Total ({filteredSalesBills.length} bills)
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-orange-400">
                      {formatCurrency(filteredSalesBills.reduce((s: number, b: any) => s + (b.total || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top items + low stock + cash flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top items */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Top Selling (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4 space-y-2">
            {topItems.length > 0 ? (
              topItems.map((it, i) => (
                <div key={it.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-medium text-slate-800 truncate">{it.name}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-bold text-slate-900">{it.qty} sold</p>
                    <p className="text-[10px] text-slate-400">{formatCurrency(it.revenue)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">No sales yet</div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alert */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Low Stock</CardTitle>
              {lowStock.length > 0 && (
                <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                  {lowStock.length} items
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4 space-y-2">
            {lowStock.length > 0 ? (
              lowStock.map((it) => (
                <div key={it.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate">{it.name}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    it.stock === 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {it.stock} {it.unit}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-emerald-600">All items well-stocked</div>
            )}
          </CardContent>
        </Card>

        {/* Today's cash flow — now includes deleted bills line */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Today's Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <CashFlowRow label="Sales" amount={cashFlow.salesIn} icon={ArrowUpRight} color="text-emerald-600" />
            <CashFlowRow label="Other Income" amount={cashFlow.otherIn} icon={ArrowUpRight} color="text-emerald-600" />
            <CashFlowRow label="Expenses" amount={-cashFlow.expenses} icon={ArrowDownRight} color="text-rose-600" />
            <CashFlowRow label="Purchases" amount={-cashFlow.purchases} icon={ArrowDownRight} color="text-rose-600" />
            <CashFlowRow label="Other Out" amount={-cashFlow.otherOut} icon={ArrowDownRight} color="text-rose-600" />
            {deletedBills.amount > 0 && (
              <CashFlowRow label="Deleted Bills" amount={-deletedBills.amount} icon={ArrowDownRight} color="text-rose-600" />
            )}
            <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Net Today</span>
              <span className={`text-base font-bold ${cashFlow.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(cashFlow.net)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Catalog stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat icon={UtensilsCrossed} label="Menu Items" value={catalog.menuItems} color="text-orange-600 bg-orange-50" />
        <MiniStat icon={Users} label="Customers" value={catalog.customers} color="text-amber-600 bg-amber-50" />
        <MiniStat icon={Truck} label="Suppliers" value={catalog.suppliers} color="text-emerald-600 bg-emerald-50" />
      </div>
    </div>
  )
}

function CashFlowRow({ label, amount, icon: Icon, color }: { label: string; amount: number; icon: any; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600 flex items-center gap-1.5">
        <Icon className={`w-3 h-3 ${color}`} />
        {label}
      </span>
      <span className={`font-semibold ${amount >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="border-0 shadow-md rounded-2xl py-3 px-2 text-center">
      <div className={`${color} p-2 rounded-lg mx-auto w-fit`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg font-bold text-slate-900 mt-1.5">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </Card>
  )
}
