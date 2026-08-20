'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { MoneyIn } from '@/lib/types'
import { EntryForm } from './ExpensesPage'
import { ReasonDialog, type PendingDelete } from './ReasonDialog'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'

const SOURCES = ['Investment', 'Loan', 'Refund', 'Owner Contribution', 'Asset Sale', 'Misc']

export default function MoneyInPage() {
  const shopFetch = useShopFetch()
  const { user, currentShop } = useSession()
  const [items, setItems] = useState<MoneyIn[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [pendingDel, setPendingDel] = useState<PendingDelete | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch('/api/moneyin')
    const data = await res.json()
    setItems(data.items)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const total = items.reduce((s, i) => s + i.amount, 0)
  const totalToday = items.filter((i) => new Date(i.date).toDateString() === new Date().toDateString()).reduce((s, i) => s + i.amount, 0)
  const [salesData, setSalesData] = useState({ todayRevenue: 0, todayCount: 0, monthRevenue: 0, monthCount: 0, allTimeRevenue: 0 })

  // Fetch sales amounts from dashboard
  useEffect(() => {
    shopFetch('/api/dashboard').then((r) => r.json()).then((d) => {
      setSalesData({
        todayRevenue: d.today?.revenue || 0,
        todayCount: d.today?.count || 0,
        monthRevenue: d.month?.revenue || 0,
        monthCount: d.month?.count || 0,
        allTimeRevenue: d.allTime?.revenue || 0,
      })
    }).catch(() => {})
  }, [shopFetch])

  const save = async (data: any) => {
    const res = await shopFetch('/api/moneyin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, source: data.category, partyName: data.partyName || null }),
    })
    if (!res.ok) { toast.error('Failed to save'); return }
    toast.success('Money In recorded')
    setShowAdd(false)
    load()
  }

  const del = async (id: string, reason: string) => {
    // Audit log the reason first (best-effort)
    const item = items.find((i) => i.id === id)
    try {
      await shopFetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'money_in_deleted',
          details: {
            id,
            amount: item?.amount,
            source: item?.source,
            date: item?.date,
            reason,
            deletedBy: user?.name || 'unknown',
          },
        }),
      })
    } catch (e) {
      console.warn('[moneyin] audit log failed:', e)
    }
    const res = await shopFetch(`/api/moneyin?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); throw new Error('delete failed') }
    toast.success('Entry deleted')
    setPendingDel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Money In</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">Today: {formatCurrency(totalToday)} · Total: {formatCurrency(total)}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Entry
        </Button>
      </div>

      {/* Sales amount summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-95" />
          <CardContent className="relative p-4 text-white">
            <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">Today's Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(salesData.todayRevenue)}</p>
            <p className="text-[10px] text-white/70">{salesData.todayCount} bills</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-95" />
          <CardContent className="relative p-4 text-white">
            <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">Monthly Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(salesData.monthRevenue)}</p>
            <p className="text-[10px] text-white/70">{salesData.monthCount} bills</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 opacity-95" />
          <CardContent className="relative p-4 text-white">
            <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide">All-Time Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(salesData.allTimeRevenue)}</p>
            <p className="text-[10px] text-white/70">Total revenue</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No entries yet</h3>
          <p className="text-sm">Record investments, loans, refunds, and other inflows.</p>
        </Card>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Source</th>
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
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{m.source}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.description || m.partyName || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-[10px]">{m.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(m.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-rose-500" onClick={() =>
                          setPendingDel({
                            id: m.id,
                            label: `${formatCurrency(m.amount)} · ${m.source}${m.description ? ' — ' + m.description : ''}`,
                          })
                        }>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Money In</DialogTitle></DialogHeader>
          <EntryForm
            categories={SOURCES}
            onSubmit={save}
            onCancel={() => setShowAdd(false)}
            accentColor="from-emerald-500 to-teal-500"
            catLabel="Source"
            descLabel="Description"
          />
        </DialogContent>
      </Dialog>

      {/* Delete reason dialog — always asks why before deleting */}
      <ReasonDialog
        pending={pendingDel}
        onConfirm={del}
        onCancel={() => setPendingDel(null)}
        entityLabel="Money In Entry"
      />
    </div>
  )
}
