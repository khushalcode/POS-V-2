'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  ArrowLeft,
  Search,
  Calendar,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Eye,
  Loader2,
  IndianRupee,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PrintPreview } from '@/components/shared/PrintPreview'
import { BillReceipt } from '@/components/shared/Receipts'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import { GlobalShortcutBar } from '@/components/shared/GlobalShortcutBar'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Bill, PaymentMode } from '@/lib/types'

interface HistoryModeProps {
  onExit: () => void
  currentMode?: string
  onNavigate?: (mode: any) => void
}

export default function HistoryMode({ onExit, currentMode, onNavigate }: HistoryModeProps) {
  const { currentShop, user } = useSession()
  const shopFetch = useShopFetch()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [summary, setSummary] = useState({ totalRevenue: 0, totalBills: 0, byPayment: {} as Record<string, number> })
  const [previewBill, setPreviewBill] = useState<Bill | null>(null)
  const [settings, setSettings] = useState<any>(null)
  // Delete-bill dialog state. When set, shows a reason prompt; on confirm
  // we call DELETE /api/bills/[id] which archives the bill into DeletedBill
  // and removes it. After that the bills list is refreshed.
  const [delTarget, setDelTarget] = useState<Bill | null>(null)
  const [delReason, setDelReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (fromDate) params.set('from', new Date(fromDate).toISOString())
    if (toDate) {
      const t = new Date(toDate)
      t.setHours(23, 59, 59, 999)
      params.set('to', t.toISOString())
    }
    if (tableFilter !== 'all') params.set('table', tableFilter)
    if (search) params.set('q', search)
    const res = await shopFetch(`/api/bills?${params.toString()}`)
    const data = await res.json()
    setBills(data.bills)
    setSummary(data.summary)
    setLoading(false)
  }, [fromDate, toDate, tableFilter, search, shopFetch])

  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [load, currentShop?.id])

  // Load settings once
  useEffect(() => {
    shopFetch('/api/settings').then((r) => r.json()).then((d) => setSettings(d.settings)).catch(() => {})
  }, [shopFetch, currentShop?.id])

  // Delete (void) a bill. Archives it into DeletedBill via the API, then
  // reloads the bills list so the row disappears. The user is required to
  // provide a reason so the audit trail is meaningful.
  const handleDeleteBill = async () => {
    if (!delTarget) return
    setDeleting(true)
    try {
      const res = await shopFetch(`/api/bills/${delTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: delReason.trim() || 'No reason provided',
          deletedBy: user?.name || 'unknown',
          deletedById: user?.id || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Failed to delete bill')
        return
      }
      toast.success(`Bill #${delTarget.billNo} deleted (₹${delTarget.total.toFixed(2)} moved to Deleted Bills)`)
      setDelTarget(null)
      setDelReason('')
      load()
    } catch (e) {
      console.error('[HistoryMode] delete failed:', e)
      toast.error('Failed to delete bill')
    } finally {
      setDeleting(false)
    }
  }

  const todayRevenue = summary.totalRevenue

  return (
    <div className="min-h-screen img-bg">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Exit
            </Button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bills & History</h2>
              <p className="text-[10px] text-slate-500">Search, review and reprint past bills</p>
            </div>
          </div>
        </div>
      </header>

      {onNavigate && currentMode && <GlobalShortcutBar currentMode={currentMode as any} onNavigate={onNavigate} />}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(todayRevenue)}
            icon={IndianRupee}
            gradient="from-emerald-500 to-teal-500"
          />
          <StatCard
            label="Total Bills"
            value={String(summary.totalBills)}
            icon={Receipt}
            gradient="from-orange-500 to-rose-500"
          />
          <StatCard
            label="Avg Bill"
            value={summary.totalBills > 0 ? formatCurrency(todayRevenue / summary.totalBills) : '—'}
            icon={TrendingUp}
            gradient="from-violet-500 to-fuchsia-500"
          />
          <StatCard
            label="By Payment"
            value={
              Object.keys(summary.byPayment).length > 0
                ? Object.entries(summary.byPayment)
                    .map(([k, v]) => `${k.toUpperCase()}: ${formatCurrency(v)}`)
                    .join('  ·  ')
                : '—'
            }
            small
            icon={Wallet}
            gradient="from-sky-500 to-blue-500"
          />
        </div>

        {/* Filters */}
        <Card className="p-4 mb-5 bg-white border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Bill no or item…"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">From date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">To date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">Table</Label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Table {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Bills list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : bills.length === 0 ? (
          <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No bills found</h3>
            <p className="text-sm">Try adjusting the filters or date range.</p>
          </Card>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Bill #</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Date / Time</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Table</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Items</th>
                    <th className="text-left font-semibold text-slate-600 px-4 py-3">Payment</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.map((b, i) => (
                    <motion.tr
                      key={b.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.2) }}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">#{b.billNo}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(b.paidAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-slate-50">Table {b.tableNumber}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {b.order?.items?.filter((x: any) => x.status !== 'cancelled').length || 0} items
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge mode={b.paymentMode} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(b.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPreviewBill(b)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-500 hover:text-rose-600"
                            title="Delete / void this bill"
                            onClick={() => {
                              setDelTarget(b)
                              setDelReason('')
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-600">
                      Total ({bills.length} bills)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-violet-700">
                      {formatCurrency(bills.reduce((s, b) => s + b.total, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </main>

      <PrintPreview
        open={!!previewBill}
        onClose={() => setPreviewBill(null)}
        title={`Bill #${previewBill?.billNo}`}
        subtitle="Reprint — customer copy"
        copies={[
          { label: 'Customer Copy', banner: '*** CUSTOMER COPY ***' },
        ]}
      >
        {previewBill && <BillReceipt bill={previewBill} style={settings} />}
      </PrintPreview>

      {/* Delete / void bill dialog. Requires a reason so the audit trail
          is meaningful. The bill is archived into DeletedBill on confirm,
          its amount shows up in Money Out → Deleted Bills section. */}
      <Dialog open={!!delTarget} onOpenChange={(o) => { if (!o && !deleting) { setDelTarget(null); setDelReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bill #{delTarget?.billNo}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Bill amount</span>
                <span className="font-bold text-rose-700">{formatCurrency(delTarget?.total || 0)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-600">Table</span>
                <span className="font-medium">Table {delTarget?.tableNumber}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-600">Payment</span>
                <span className="font-medium uppercase">{delTarget?.paymentMode}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              This will <strong>permanently remove</strong> the bill and reverse its
              income entry. The amount will appear in <strong>Money Out → Deleted Bills</strong>
              {' '}and reduce today's net cash flow.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for deletion (required)</Label>
              <Input
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="e.g. Bill generated by mistake, customer cancelled, payment reversed…"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleting || !delReason.trim()}
              onClick={handleDeleteBill}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  small,
}: {
  label: string
  value: string
  icon: any
  gradient: string
  small?: boolean
}) {
  return (
    <Card className="p-4 border-0 shadow-md overflow-hidden relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-95`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
      <div className="relative text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-white/80 uppercase tracking-wide">{label}</span>
          <Icon className="w-4 h-4 text-white/80" />
        </div>
        <div className={small ? 'text-xs font-bold' : 'text-2xl font-bold'}>{value}</div>
      </div>
    </Card>
  )
}

function PaymentBadge({ mode }: { mode: PaymentMode }) {
  const map: Record<string, { icon: any; color: string; label: string }> = {
    cash: { icon: Banknote, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Cash' },
    upi: { icon: Smartphone, color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'UPI' },
    card: { icon: CreditCard, color: 'bg-sky-100 text-sky-700 border-sky-200', label: 'Card' },
    other: { icon: Wallet, color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Other' },
  }
  const m = map[mode] || map.other
  return (
    <Badge variant="outline" className={`text-[10px] ${m.color}`}>
      <m.icon className="w-3 h-3 mr-1" /> {m.label}
    </Badge>
  )
}
