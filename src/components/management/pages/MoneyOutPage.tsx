'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, TrendingDown, Receipt, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { MoneyOut } from '@/lib/types'
import { EntryForm } from './ExpensesPage'
import { ReasonDialog, type PendingDelete } from './ReasonDialog'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'

const PURPOSES = ['Owner Draw', 'Loan Repayment', 'Asset Purchase', 'Donation', 'Personal', 'Misc']

// Shape of a deleted-bill row returned by /api/bills/deleted. Mirrors the
// DeletedBill Prisma model / client-data shape.
interface DeletedBill {
  id: string
  billNo: number
  tableNumber: number
  total: number
  paymentMode: string
  paymentStatus: string
  originalPaidAt: string
  originalCreatedAt: string
  reason: string | null
  deletedBy: string | null
  deletedById: string | null
  deletedAt: string
}

export default function MoneyOutPage() {
  const shopFetch = useShopFetch()
  const { user } = useSession()
  const [items, setItems] = useState<MoneyOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [pendingDel, setPendingDel] = useState<PendingDelete | null>(null)
  // Deleted bills — loaded from /api/bills/deleted. These are bills that
  // were voided via the History page; their totals are shown here as an
  // outflow so the cash flow on Money Out ties out with the dashboard.
  const [deletedBills, setDeletedBills] = useState<DeletedBill[]>([])
  const [deletedTotal, setDeletedTotal] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)
  const [showDeleted, setShowDeleted] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch('/api/moneyout')
    const data = await res.json()
    setItems(data.items)
    setLoading(false)
  }, [])

  // Load deleted bills alongside the money-out entries. Both feeds drive
  // the page's totals, so a single loading flag covers both.
  const loadDeleted = useCallback(async () => {
    try {
      const res = await shopFetch('/api/bills/deleted')
      if (!res.ok) return
      const data = await res.json()
      setDeletedBills(Array.isArray(data.items) ? data.items : [])
      setDeletedTotal(data.totals?.total || 0)
      setDeletedCount(data.totals?.count || 0)
    } catch (e) {
      console.warn('[moneyout] failed to load deleted bills:', e)
    }
  }, [])

  useEffect(() => {
    load()
    loadDeleted()
  }, [load, loadDeleted])

  const total = items.reduce((s, i) => s + i.amount, 0)
  const totalToday = items.filter((i) => new Date(i.date).toDateString() === new Date().toDateString()).reduce((s, i) => s + i.amount, 0)

  // Grand total = manual money out + voided bills. We show this in the
  // header so the user can see the combined outflow at a glance.
  const grandTotal = total + deletedTotal

  const save = async (data: any) => {
    const res = await shopFetch('/api/moneyout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, purpose: data.category, partyName: data.partyName || null }),
    })
    if (!res.ok) { toast.error('Failed to save'); return }
    toast.success('Money Out recorded')
    setShowAdd(false)
    load()
  }

  const del = async (id: string, reason: string) => {
    const item = items.find((i) => i.id === id)
    try {
      await shopFetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'money_out_deleted',
          details: {
            id,
            amount: item?.amount,
            purpose: item?.purpose,
            date: item?.date,
            reason,
            deletedBy: user?.name || 'unknown',
          },
        }),
      })
    } catch (e) {
      console.warn('[moneyout] audit log failed:', e)
    }
    const res = await shopFetch(`/api/moneyout?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); throw new Error('delete failed') }
    toast.success('Entry deleted')
    setPendingDel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Money Out</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">
            Today: {formatCurrency(totalToday)} · Total: {formatCurrency(total)}
            {deletedTotal > 0 && (
              <span className="text-rose-600 font-medium">
                {' '}· + {formatCurrency(deletedTotal)} deleted bills
                {' '}· <span className="font-semibold">Grand total: {formatCurrency(grandTotal)}</span>
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Entry
        </Button>
      </div>

      {/* ─── Deleted Bills summary banner ───────────────────────────────
          Shows up only when there are voided bills. Clicking opens a
          dialog with the full list (bill #, table, amount, reason, who
          deleted, when). This is the "Deleted Bill Amount" section. */}
      {deletedCount > 0 && (
        <Card
          className="border-0 shadow-md rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowDeleted(true)}
        >
          <div className="bg-gradient-to-r from-rose-500 to-red-500 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-white/80">Deleted Bills (voided sales)</div>
                <div className="text-xl font-bold">{formatCurrency(deletedTotal)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/80">{deletedCount} bill{deletedCount === 1 ? '' : 's'}</div>
              <div className="text-[10px] text-white/60 mt-0.5">Click to view →</div>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <TrendingDown className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No entries yet</h3>
          <p className="text-sm">Record owner draws, loan repayments, asset purchases, etc.</p>
        </Card>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Purpose</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Description</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Payment</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Amount</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {items.map((m) => (
                    <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(m.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{m.purpose}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.description || m.partyName || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-[10px]">{m.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">{formatCurrency(m.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-rose-500" onClick={() =>
                          setPendingDel({
                            id: m.id,
                            label: `${formatCurrency(m.amount)} · ${m.purpose}${m.description ? ' — ' + m.description : ''}`,
                          })
                        }>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-600">
                    Money Out Subtotal ({items.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{formatCurrency(total)}</td>
                  <td />
                </tr>
                {deletedTotal > 0 && (
                  <tr className="bg-rose-50 border-t border-rose-200">
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold text-rose-700">
                      + Deleted Bills ({deletedCount} voided)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{formatCurrency(deletedTotal)}</td>
                    <td />
                  </tr>
                )}
                {deletedTotal > 0 && (
                  <tr className="bg-slate-900 text-white border-t-2 border-slate-900">
                    <td colSpan={4} className="px-4 py-3 text-right font-semibold">
                      Grand Total Outflow
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(grandTotal)}</td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Money Out</DialogTitle></DialogHeader>
          <EntryForm
            categories={PURPOSES}
            onSubmit={save}
            onCancel={() => setShowAdd(false)}
            accentColor="from-amber-500 to-orange-500"
            catLabel="Purpose"
            descLabel="Description"
          />
        </DialogContent>
      </Dialog>

      {/* Delete reason dialog — always asks why before deleting */}
      <ReasonDialog
        pending={pendingDel}
        onConfirm={del}
        onCancel={() => setPendingDel(null)}
        entityLabel="Money Out Entry"
      />

      {/* ─── Deleted Bills detail dialog ─────────────────────────────────
          Lists every voided bill with bill #, table, original paid time,
          deletion time, who deleted it, reason, and amount. The amounts
          here are already counted in the page's grand total above. */}
      <Dialog open={showDeleted} onOpenChange={setShowDeleted}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Deleted Bills (Voided Sales)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 -mt-2">
            These bills were deleted from the History page. Their amounts are
            counted as outflow on this page and reduce the dashboard's net
            cash flow for the day they were originally paid.
          </p>
          {deletedBills.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              No deleted bills.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Bill #</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Table</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Originally Paid</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Deleted By</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Reason</th>
                    <th className="text-left font-semibold text-slate-600 px-3 py-2">Deleted At</th>
                    <th className="text-right font-semibold text-slate-600 px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedBills.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">#{d.billNo}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="bg-slate-50">Table {d.tableNumber}</Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{formatDateTime(d.originalPaidAt)}</td>
                      <td className="px-3 py-2 text-slate-700 text-xs">{d.deletedBy || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs max-w-[200px] truncate" title={d.reason || ''}>
                        {d.reason || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{formatDateTime(d.deletedAt)}</td>
                      <td className="px-3 py-2 text-right font-bold text-rose-700">{formatCurrency(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-rose-50 border-t-2 border-rose-200">
                    <td colSpan={6} className="px-3 py-3 text-right font-semibold text-rose-700">
                      Total ({deletedBills.length} bills)
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-rose-700">{formatCurrency(deletedTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
