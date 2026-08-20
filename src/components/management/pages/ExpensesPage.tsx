'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Wallet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Expense } from '@/lib/types'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import { ReasonDialog, type PendingDelete } from './ReasonDialog'

const CATEGORIES = ['Rent', 'Salary', 'Utilities', 'Maintenance', 'Marketing', 'Supplies', 'Transport', 'Misc']

export default function ExpensesPage() {
  const shopFetch = useShopFetch()
  const { user } = useSession()
  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [pendingDel, setPendingDel] = useState<PendingDelete | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch('/api/expenses')
    const data = await res.json()
    setItems(data.expenses)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalToday = items
    .filter((e) => new Date(e.date).toDateString() === new Date().toDateString())
    .reduce((s, e) => s + e.amount, 0)
  const totalMonth = items
    .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
    .reduce((s, e) => s + e.amount, 0)
  const byCat = items.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})

  const save = async (data: any) => {
    const res = await shopFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to save'); return }
    toast.success('Expense recorded')
    setShowAdd(false)
    load()
  }

  const del = async (id: string, reason: string) => {
    const item = items.find((e) => e.id === id)
    try {
      await shopFetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'expense_deleted',
          details: {
            id,
            amount: item?.amount,
            category: item?.category,
            description: item?.description,
            date: item?.date,
            reason,
            deletedBy: user?.name || 'unknown',
          },
        }),
      })
    } catch (e) {
      console.warn('[expenses] audit log failed:', e)
    }
    const res = await shopFetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); throw new Error('delete failed') }
    toast.success('Expense deleted')
    setPendingDel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">Today: {formatCurrency(totalToday)} · This month: {formatCurrency(totalMonth)}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-red-500 to-rose-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Expense
        </Button>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(byCat).slice(0, 8).map(([cat, amt]) => (
          <Card key={cat} className="border-0 shadow-md rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{cat}</p>
            <p className="text-base font-bold text-slate-900">{formatCurrency(amt)}</p>
          </Card>
        ))}
        {Object.keys(byCat).length === 0 && (
          <Card className="col-span-full p-6 text-center text-slate-400 text-sm bg-white border-slate-200">
            No expenses recorded yet
          </Card>
        )}
      </div>

      {loading ? (
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No expenses yet</h3>
          <p className="text-sm">Record rent, salaries, utilities, and more.</p>
        </Card>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Category</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Description</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Payment</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Amount</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {items.map((e) => (
                    <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(e.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{e.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.description}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="uppercase text-[10px]">{e.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-rose-500" onClick={() =>
                          setPendingDel({
                            id: e.id,
                            label: `${formatCurrency(e.amount)} · ${e.category}${e.description ? ' — ' + e.description : ''}`,
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
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          <EntryForm
            categories={CATEGORIES}
            onSubmit={save}
            onCancel={() => setShowAdd(false)}
            accentColor="from-red-500 to-rose-500"
            catLabel="Category"
            descLabel="Description"
          />
        </DialogContent>
      </Dialog>

      {/* Delete reason dialog — always asks why before deleting */}
      <ReasonDialog
        pending={pendingDel}
        onConfirm={del}
        onCancel={() => setPendingDel(null)}
        entityLabel="Expense Entry"
      />
    </div>
  )
}

export function EntryForm({
  categories,
  onSubmit,
  onCancel,
  accentColor,
  catLabel,
  descLabel,
  amountLabel = 'Amount ₹',
}: {
  categories: string[]
  onSubmit: (d: any) => Promise<void>
  onCancel: () => void
  accentColor: string
  catLabel: string
  descLabel: string
  amountLabel?: string
}) {
  const [category, setCategory] = useState(categories[0] || '')
  const [customCat, setCustomCat] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        category: customCat || category,
        description,
        amount: Number(amount),
        paymentMode,
        date,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{catLabel}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="Or enter custom" className="mt-1.5 h-8 text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{descLabel}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{amountLabel}</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payment Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" onClick={onCancel}>Cancel</Button></DialogClose>
        <Button onClick={submit} disabled={saving} className={`bg-gradient-to-r ${accentColor} text-white`}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Save
        </Button>
      </DialogFooter>
    </div>
  )
}
