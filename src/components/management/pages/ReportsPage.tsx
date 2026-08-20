'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, TrendingUp, Receipt, Wallet, Download, Filter, Package,
  CreditCard, FileJson, FileSpreadsheet, FileText, ChevronDown, ChevronUp,
  Search, Calendar, Users, Tag, IndianRupee, ShoppingBag, AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { downloadExcel, downloadCsv, type Sheet } from '@/lib/excel-export'

const PIE_COLORS = ['#f97316', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#0f172a', '#eab308']

type PeriodType = 'today' | '7d' | '30d' | 'monthly' | 'range'

export default function ReportsPage() {
  const shopFetch = useShopFetch()

  // ─── Filter state ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<PeriodType>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentMode, setPaymentMode] = useState('all')
  const [tableNumber, setTableNumber] = useState('all')
  const [billNoSearch, setBillNoSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [waiter, setWaiter] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedBill, setExpandedBill] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])

  // Compute from/to ISO strings based on the selected period
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
      case 'range': {
        const f = from ? new Date(from) : new Date(0)
        f.setHours(0, 0, 0, 0)
        const t = to ? new Date(to) : new Date()
        t.setHours(23, 59, 59, 999)
        return { fromIso: f.toISOString(), toIso: t.toISOString() }
      }
    }
  }, [period, from, to])

  // Build the query string from all filters
  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('from', fromIso)
    p.set('to', toIso)
    if (paymentMode !== 'all') p.set('paymentMode', paymentMode)
    if (tableNumber !== 'all') p.set('table', tableNumber)
    if (billNoSearch) p.set('billNo', billNoSearch)
    if (itemSearch) p.set('item', itemSearch)
    if (category !== 'all') p.set('category', category)
    if (waiter) p.set('waiter', waiter)
    if (minAmount) p.set('minAmount', minAmount)
    if (maxAmount) p.set('maxAmount', maxAmount)
    return p.toString()
  }, [fromIso, toIso, paymentMode, tableNumber, billNoSearch, itemSearch, category, waiter, minAmount, maxAmount])

  // Load report data whenever filters change
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await shopFetch(`/api/reports?${queryString}`)
        const d = await res.json()
        if (!cancelled) setData(d)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(load, 300) // debounce 300ms
    return () => { cancelled = true; clearTimeout(t) }
  }, [queryString, shopFetch])

  // Load categories for the filter dropdown
  useEffect(() => {
    shopFetch('/api/menu-categories')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories)) {
          setCategories(d.categories.map((c: any) => c.name))
        }
      })
      .catch(() => {})
  }, [shopFetch])

  const clearAllFilters = () => {
    setPaymentMode('all')
    setTableNumber('all')
    setBillNoSearch('')
    setItemSearch('')
    setCategory('all')
    setWaiter('')
    setMinAmount('')
    setMaxAmount('')
  }

  const activeFilterCount =
    (paymentMode !== 'all' ? 1 : 0) +
    (tableNumber !== 'all' ? 1 : 0) +
    (billNoSearch ? 1 : 0) +
    (itemSearch ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (waiter ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0)

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) return null
  const s = data.summary
  const bills: any[] = data.bills || []
  const itemizedRows: any[] = data.itemizedRows || []

  // ─── Stat cards ────────────────────────────────────────────────────────
  const stats = [
    { title: 'Sales Revenue', value: formatCurrency(s.salesRevenue), icon: TrendingUp, gradient: 'from-emerald-500 to-teal-500', sub: `${s.billCount} bills` },
    { title: 'Items Sold', value: String(s.totalItemsSold || 0), icon: ShoppingBag, gradient: 'from-orange-500 to-rose-500', sub: `${data.topItems?.length || 0} unique items` },
    { title: 'Avg Bill', value: formatCurrency(s.avgBill || 0), icon: IndianRupee, gradient: 'from-violet-500 to-fuchsia-500', sub: `per bill` },
    { title: 'Net Profit', value: formatCurrency(s.netProfit), icon: BarChart3, gradient: s.netProfit >= 0 ? 'from-blue-500 to-indigo-500' : 'from-rose-500 to-pink-500', sub: `after expenses` },
  ]

  // ─── Charts data ───────────────────────────────────────────────────────
  const paymentData = Object.entries(data.byPayment || {}).map(([mode, v]: [string, any]) => ({
    name: mode.toUpperCase(),
    value: v.total,
    count: v.count,
  }))

  const categoryData = (data.byCategory || []).slice(0, 8).map((c: any) => ({
    name: c.name.length > 15 ? c.name.slice(0, 12) + '…' : c.name,
    fullName: c.name,
    revenue: c.revenue,
    qty: c.qty,
  }))

  const hourlyData = (data.hourlyBreakdown || []).filter((h: any) => h.count > 0)

  // ─── Export handlers ───────────────────────────────────────────────────
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${period}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    const sheets: Sheet[] = []
    sheets.push({
      name: 'Summary',
      columns: ['Metric', 'Value'],
      rows: [
        ['Sales Revenue', s.salesRevenue],
        ['Bill Count', s.billCount],
        ['Items Sold', s.totalItemsSold || 0],
        ['Avg Bill', s.avgBill],
        ['Total Expenses', s.totalExpenses],
        ['Total Purchases', s.totalPurchases],
        ['Deleted Bill Amount', s.deletedBillAmount],
        ['Net Profit', s.netProfit],
        ['Period', period],
        ['Generated At', new Date().toISOString().replace('T', ' ').slice(0, 19)],
      ],
    })
    if (bills.length > 0) {
      sheets.push({
        name: 'Bills',
        columns: ['Bill No', 'Date', 'Table', 'Waiter', 'Customer', 'Items', 'Payment', 'Subtotal', 'Tax', 'Discount', 'Service', 'Total'],
        rows: bills.map((b: any) => [
          b.billNo,
          (b.paidAt || '').slice(0, 19).replace('T', ' '),
          b.tableNumber,
          b.order?.waiterName || '',
          b.order?.customerName || '',
          b.order?.items?.filter((i: any) => i.status !== 'cancelled').length || 0,
          (b.paymentMode || '').toUpperCase(),
          Number(b.subtotal) || 0,
          Number(b.taxAmount) || 0,
          Number(b.discount) || 0,
          Number(b.serviceCharge) || 0,
          Number(b.total) || 0,
        ]),
      })
    }
    if (itemizedRows.length > 0) {
      sheets.push({
        name: 'Itemized Sales',
        columns: ['Bill No', 'Date', 'Table', 'Waiter', 'Item', 'Category', 'Qty', 'Price', 'Line Total', 'Bill Total', 'Payment'],
        rows: itemizedRows.map((r: any) => [
          r.billNo,
          (r.paidAt || '').slice(0, 19).replace('T', ' '),
          r.tableNumber,
          r.waiterName || '',
          r.itemName,
          r.category,
          r.quantity,
          r.price,
          r.lineTotal,
          r.billTotal,
          (r.paymentMode || '').toUpperCase(),
        ]),
      })
    }
    if ((data.topItems || []).length > 0) {
      sheets.push({
        name: 'Item-Wise Sales',
        columns: ['Item Name', 'Category', 'Qty Sold', 'Avg Price', 'Revenue', '% of Sales'],
        rows: (data.topItems || []).map((it: any) => [
          it.name,
          it.category || 'General',
          Number(it.qty) || 0,
          it.qty > 0 ? Number((it.revenue / it.qty).toFixed(2)) : 0,
          Number(it.revenue) || 0,
          s.salesRevenue > 0 ? Number(((it.revenue / s.salesRevenue) * 100).toFixed(1)) : 0,
        ]),
      })
    }
    if ((data.byCategory || []).length > 0) {
      sheets.push({
        name: 'By Category',
        columns: ['Category', 'Qty Sold', 'Revenue'],
        rows: (data.byCategory || []).map((c: any) => [c.name, Number(c.qty) || 0, Number(c.revenue) || 0]),
      })
    }
    if ((data.dailyBreakdown || []).length > 0) {
      sheets.push({
        name: 'Daily Breakdown',
        columns: ['Date', 'Sales', 'Expenses', 'Bill Count'],
        rows: (data.dailyBreakdown || []).map((d: any) => [
          d.date, Number(d.sales || 0) || 0, Number(d.expenses || 0) || 0, Number(d.count || 0) || 0,
        ]),
      })
    }
    const paymentEntries = Object.entries(data.byPayment || {})
    if (paymentEntries.length > 0) {
      sheets.push({
        name: 'Payment Modes',
        columns: ['Mode', 'Total', 'Count'],
        rows: paymentEntries.map(([mode, v]: [string, any]) => [
          mode.toUpperCase(), Number(v.total || 0) || 0, Number(v.count || 0) || 0,
        ]),
      })
    }
    const expenseEntries = Object.entries(data.expenseByCategory || {})
    if (expenseEntries.length > 0) {
      sheets.push({
        name: 'Expenses by Category',
        columns: ['Category', 'Amount'],
        rows: expenseEntries.map(([cat, amt]: [string, any]) => [cat, Number(amt) || 0]),
      })
    }
    const dateStr = new Date().toISOString().split('T')[0]
    downloadExcel(sheets, `sales-report-${period}-${dateStr}`)
  }

  const handleExportCsv = () => {
    // Export the itemized sales as CSV — most useful for accountants
    const sheet: Sheet = {
      name: 'Itemized Sales',
      columns: ['Bill No', 'Date', 'Table', 'Waiter', 'Customer', 'Item', 'Category', 'Qty', 'Price', 'Line Total', 'Bill Total', 'Payment'],
      rows: itemizedRows.length > 0
        ? itemizedRows.map((r: any) => [
            r.billNo,
            (r.paidAt || '').slice(0, 19).replace('T', ' '),
            r.tableNumber,
            r.waiterName || '',
            r.customerName || '',
            r.itemName,
            r.category,
            r.quantity,
            r.price,
            r.lineTotal,
            r.billTotal,
            (r.paymentMode || '').toUpperCase(),
          ])
        : bills.map((b: any) => [
            b.billNo,
            (b.paidAt || '').slice(0, 19).replace('T', ' '),
            b.tableNumber,
            b.order?.waiterName || '',
            b.order?.customerName || '',
            b.order?.items?.filter((i: any) => i.status !== 'cancelled').length || 0,
            '',
            '',
            '',
            '',
            Number(b.total) || 0,
            (b.paymentMode || '').toUpperCase(),
          ]),
    }
    const dateStr = new Date().toISOString().split('T')[0]
    downloadCsv(sheet, `sales-detail-${period}-${dateStr}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Sales Reports</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">Detailed sales analytics with advanced filters · {s.billCount} bills · {s.totalItemsSold || 0} items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="border-sky-300 text-sky-700 hover:bg-sky-50">
            <FileText className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson}>
            <FileJson className="w-3.5 h-3.5 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* ─── Filter bar ────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-md rounded-2xl p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">{activeFilterCount} active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-[10px] text-rose-500 h-7">
                Clear all
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="text-[10px] h-7">
              {showAdvanced ? 'Less' : 'More'} filters
              {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Period */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="range">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment mode */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> Payment</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="space-y-1.5">
            <Label className="text-xs">Table</Label>
            <Select value={tableNumber} onValueChange={setTableNumber}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                <SelectItem value="0">Direct Counter</SelectItem>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>Table {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bill # search */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Search className="w-3 h-3" /> Bill #</Label>
            <Input
              value={billNoSearch}
              onChange={(e) => setBillNoSearch(e.target.value)}
              placeholder="e.g. 1001"
              className="h-9"
            />
          </div>
        </div>

        {/* Date range (only when period === 'range') */}
        {period === 'range' && (
          <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
          </div>
        )}

        {/* Advanced filters (collapsible) */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Package className="w-3 h-3" /> Item Search</Label>
                  <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="e.g. Pizza" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3" /> Waiter</Label>
                  <Input value={waiter} onChange={(e) => setWaiter(e.target.value)} placeholder="e.g. Riya" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min ₹</Label>
                    <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max ₹</Label>
                    <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" className="h-9" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-500">Active:</span>
            {paymentMode !== 'all' && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">{paymentMode.toUpperCase()}</Badge>}
            {tableNumber !== 'all' && <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700">Table {tableNumber}</Badge>}
            {billNoSearch && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">#{billNoSearch}</Badge>}
            {itemSearch && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">"{itemSearch}"</Badge>}
            {category !== 'all' && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700">{category}</Badge>}
            {waiter && <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700">Waiter: {waiter}</Badge>}
            {minAmount && <Badge variant="outline" className="text-[10px] bg-slate-50">Min ₹{minAmount}</Badge>}
            {maxAmount && <Badge variant="outline" className="text-[10px] bg-slate-50">Max ₹{maxAmount}</Badge>}
          </div>
        )}
      </Card>

      {/* ─── Stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((st, i) => (
          <motion.div key={st.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${st.gradient} opacity-95`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-white/80 uppercase tracking-wide">{st.title}</span>
                  <st.icon className="w-4 h-4 text-white/80" />
                </div>
                <div className="text-xl sm:text-2xl font-bold">{st.value}</div>
                <div className="text-[10px] text-white/70">{st.sub}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ─── Charts row 1: Sales trend + Payment pie ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Sales vs Expenses (Daily)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-2 sm:px-4 pb-4">
            {data.dailyBreakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₹${v}`} axisLine={false} tickLine={false} width={45} />
                  <RechartsTooltip formatter={(v: any, name: string) => [formatCurrency(Number(v)), name === 'sales' ? 'Sales' : 'Expenses']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">No data for the period</div>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-2 sm:px-4 pb-4">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {paymentData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">No payment data</div>}
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts row 2: Hourly + Category ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Hourly Sales</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-2 sm:px-4 pb-4">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₹${v}`} axisLine={false} tickLine={false} width={45} />
                  <RechartsTooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Sales']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">No hourly data</div>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-2 sm:px-4 pb-4">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₹${v}`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={100} />
                  <RechartsTooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">No category data</div>}
          </CardContent>
        </Card>
      </div>

      {/* ─── Detailed Sales Table (expandable per bill) ──────────────── */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-1 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Detailed Sales ({bills.length} bills)
            </CardTitle>
            <span className="text-[10px] text-slate-400">Click a row to expand itemized details</span>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2 w-6"></th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Bill #</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Date / Time</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Table</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Waiter</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Items</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Payment</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Subtotal</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Tax</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Disc</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-slate-400">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      No bills match the current filters
                    </td>
                  </tr>
                ) : (
                  bills.slice(0, 200).map((b: any) => {
                    const isExpanded = expandedBill === b.id
                    const items = (b.order?.items || []).filter((i: any) => i.status !== 'cancelled')
                    return (
                      <>
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => setExpandedBill(isExpanded ? null : b.id)}
                        >
                          <td className="px-3 py-2 text-slate-400">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-900">#{b.billNo}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDateTime(b.paidAt)}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">Table {b.tableNumber}</Badge></td>
                          <td className="px-3 py-2 text-slate-600">{b.order?.waiterName || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{items.length}</td>
                          <td className="px-3 py-2"><Badge variant="outline" className="text-[9px] uppercase">{b.paymentMode}</Badge></td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(b.subtotal)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(b.taxAmount)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(b.discount)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(b.total)}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${b.id}-items`} className="bg-amber-50/50">
                            <td colSpan={11} className="px-6 py-3">
                              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="text-left font-semibold text-slate-600 px-3 py-1.5">Item</th>
                                      <th className="text-right font-semibold text-slate-600 px-3 py-1.5">Qty</th>
                                      <th className="text-right font-semibold text-slate-600 px-3 py-1.5">Price</th>
                                      <th className="text-right font-semibold text-slate-600 px-3 py-1.5">Line Total</th>
                                      {b.order?.customerName && <th className="text-left font-semibold text-slate-600 px-3 py-1.5">Customer</th>}
                                      {b.order?.notes && <th className="text-left font-semibold text-slate-600 px-3 py-1.5">Notes</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {items.map((it: any) => (
                                      <tr key={it.id}>
                                        <td className="px-3 py-1.5 text-slate-800 font-medium">{it.name}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-600">{it.quantity}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-600">{formatCurrency(it.price)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{formatCurrency(it.price * it.quantity)}</td>
                                        {b.order?.customerName && <td className="px-3 py-1.5 text-slate-600" rowSpan={items.length}>{b.order.customerName}</td>}
                                        {b.order?.notes && <td className="px-3 py-1.5 text-slate-500 italic" rowSpan={items.length}>{b.order.notes}</td>}
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                    <tr>
                                      <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-600">Bill Total</td>
                                      <td className="px-3 py-2 text-right font-bold text-orange-700">{formatCurrency(b.total)}</td>
                                      {(b.order?.customerName || b.order?.notes) && <td className="px-3 py-2"></td>}
                                      {b.order?.notes && <td className="px-3 py-2"></td>}
                                    </tr>
                                  </tfoot>
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
              {bills.length > 0 && (
                <tfoot className="bg-slate-900 text-white sticky bottom-0">
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-right font-semibold">
                      Total ({bills.length} bills{bills.length > 200 ? ', showing 200' : ''})
                    </td>
                    <td className="px-3 py-3 text-right font-bold">{formatCurrency(bills.reduce((s, b) => s + (b.subtotal || 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-bold">{formatCurrency(bills.reduce((s, b) => s + (b.taxAmount || 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-bold">{formatCurrency(bills.reduce((s, b) => s + (b.discount || 0), 0))}</td>
                    <td className="px-3 py-3 text-right font-bold text-orange-400">{formatCurrency(bills.reduce((s, b) => s + (b.total || 0), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Item-Wise Sales Report (full table) ─────────────────────── */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-1 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Item-Wise Sales Report ({(data.topItems || []).length} items)
            </CardTitle>
            <span className="text-[10px] text-slate-400">Every item sold in the selected period</span>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">#</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Item Name</th>
                  <th className="text-left font-semibold text-slate-600 px-3 py-2">Category</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Qty Sold</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Avg Price</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">Revenue</th>
                  <th className="text-right font-semibold text-slate-600 px-3 py-2">% of Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.topItems || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      <Package className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      No items sold in this period
                    </td>
                  </tr>
                ) : (
                  (data.topItems || []).map((it: any, i: number) => {
                    const totalRevenue = s.salesRevenue || 1
                    const pct = ((it.revenue / totalRevenue) * 100).toFixed(1)
                    const avgPrice = it.qty > 0 ? it.revenue / it.qty : 0
                    return (
                      <tr key={it.name} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{it.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[9px] bg-slate-50">
                            {it.category || 'General'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{it.qty}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(avgPrice)}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(it.revenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{pct}%</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {(data.topItems || []).length > 0 && (
                <tfoot className="bg-slate-900 text-white sticky bottom-0">
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-right font-semibold">
                      Total ({(data.topItems || []).length} items)
                    </td>
                    <td className="px-3 py-3 text-right font-bold">
                      {(data.topItems || []).reduce((s: number, it: any) => s + (it.qty || 0), 0)}
                    </td>
                    <td></td>
                    <td className="px-3 py-3 text-right font-bold text-orange-400">
                      {formatCurrency((data.topItems || []).reduce((s: number, it: any) => s + (it.revenue || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Category-Wise Sales Report + Expense breakdown ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Category-Wise Sales</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Category</th>
                    <th className="text-right font-semibold text-slate-600 px-3 py-2">Qty Sold</th>
                    <th className="text-right font-semibold text-slate-600 px-3 py-2">Revenue</th>
                    <th className="text-right font-semibold text-slate-600 px-3 py-2">% </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.byCategory || []).length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-slate-400">No category data</td></tr>
                  ) : (
                    (data.byCategory || []).map((c: any) => {
                      const totalRev = s.salesRevenue || 1
                      const pct = ((c.revenue / totalRev) * 100).toFixed(1)
                      return (
                        <tr key={c.name} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">{c.name}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{c.qty}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(c.revenue)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{pct}%</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {(data.byCategory || []).length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        {(data.byCategory || []).reduce((s: number, c: any) => s + (c.qty || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-violet-700">
                        {formatCurrency((data.byCategory || []).reduce((s: number, c: any) => s + (c.revenue || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="pb-1 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-slate-900">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {Object.keys(data.expenseByCategory || {}).length > 0 ? (
                Object.entries(data.expenseByCategory).map(([cat, amt]: [string, any]) => (
                  <div key={cat} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50">
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{cat}</Badge>
                    <span className="text-xs font-bold text-slate-900">{formatCurrency(amt)}</span>
                  </div>
                ))
              ) : <div className="py-6 text-center text-xs text-slate-400">No expenses in this period</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
