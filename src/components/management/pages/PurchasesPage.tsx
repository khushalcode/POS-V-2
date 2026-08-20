'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ShoppingCart, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Purchase, Supplier, MenuItem } from '@/lib/types'
import { useShopFetch } from '@/hooks/use-shop-fetch'

export default function PurchasesPage() {
  const shopFetch = useShopFetch()
  const [items, setItems] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, sRes, mRes] = await Promise.all([
        shopFetch('/api/purchases'),
        shopFetch('/api/suppliers'),
        shopFetch('/api/menu'),
      ])
      const pData = await pRes.json()
      const sData = await sRes.json()
      const mData = await mRes.json()
      setItems(pData.purchases || [])
      setSuppliers(sData.suppliers || [])
      setMenu(mData.items || [])
    } catch (e) {
      console.error('[PurchasesPage] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [shopFetch])

  useEffect(() => { load() }, [load])

  const totalToday = items
    .filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, p) => s + p.total, 0)

  const totalMonth = items
    .filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, p) => s + p.total, 0)

  const save = async (data: any) => {
    const res = await shopFetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to save purchase'); return }
    toast.success('Purchase recorded')
    setShowAdd(false)
    load()
  }

  const del = async (id: string) => {
    const res = await shopFetch(`/api/purchases?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    toast.success('Purchase deleted')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Purchases</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">Stock-in records · Today: {formatCurrency(totalToday)} · This month: {formatCurrency(totalMonth)}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> New Purchase
        </Button>
      </div>

      {loading ? (
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No purchases yet</h3>
          <p className="text-sm">Record stock purchases from your suppliers.</p>
        </Card>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Invoice #</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Date</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Supplier</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Items</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {items.map((p) => {
                    const parsed = (() => { try { return JSON.parse(p.items) as any[] } catch { return [] } })()
                    return (
                      <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(p.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{p.supplierName || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{parsed.length} items</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(p.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => del(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
          <PurchaseForm suppliers={suppliers} menuItems={menu} onSubmit={save} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PurchaseForm({
  suppliers,
  menuItems,
  onSubmit,
  onCancel,
}: {
  suppliers: Supplier[]
  menuItems: MenuItem[]
  onSubmit: (d: any) => Promise<void>
  onCancel: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [notes, setNotes] = useState('')
  const [taxAmount, setTaxAmount] = useState('0')
  const [rows, setRows] = useState<Array<{ menuItemId?: string; name: string; qty: number; price: number; total: number }>>([
    { menuItemId: '', name: '', qty: 1, price: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)

  const supplier = suppliers.find((s) => s.id === supplierId)
  const subtotal = rows.reduce((s, r) => s + r.total, 0)
  const grandTotal = subtotal + Number(taxAmount || 0)

  const updateRow = (idx: number, patch: Partial<typeof rows[0]>) => {
    setRows((cur) => cur.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, ...patch }
      next.total = next.qty * next.price
      return next
    }))
  }

  const addRow = () => setRows((cur) => [...cur, { menuItemId: '', name: '', qty: 1, price: 0, total: 0 }])

  const removeRow = (idx: number) => setRows((cur) => cur.filter((_, i) => i !== idx))

  const onPickMenuItem = (idx: number, menuItemId: string) => {
    const m = menuItems.find((mi) => mi.id === menuItemId)
    if (m) {
      updateRow(idx, { menuItemId, name: m.name, price: m.cost })
    } else {
      updateRow(idx, { menuItemId: '' })
    }
  }

  const submit = async () => {
    const validRows = rows.filter((r) => r.name && r.qty > 0)
    if (validRows.length === 0) {
      toast.error('Add at least one item')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        supplierId: supplierId || null,
        supplierName: supplier?.name || null,
        paymentMode,
        notes,
        taxAmount: Number(taxAmount || 0),
        items: validRows,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payment Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <Label className="text-xs">Items</Label>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg">
              <div className="col-span-4">
                <Select value={r.menuItemId || ''} onValueChange={(v) => onPickMenuItem(idx, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick menu item" /></SelectTrigger>
                  <SelectContent>
                    {menuItems.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="col-span-4 h-8 text-xs"
                placeholder="Item name"
                value={r.name}
                onChange={(e) => updateRow(idx, { name: e.target.value })}
              />
              <Input
                type="number"
                className="col-span-1 h-8 text-xs"
                placeholder="Qty"
                value={r.qty}
                onChange={(e) => updateRow(idx, { qty: Number(e.target.value) || 0 })}
              />
              <Input
                type="number"
                className="col-span-2 h-8 text-xs"
                placeholder="Price"
                value={r.price}
                onChange={(e) => updateRow(idx, { price: Number(e.target.value) || 0 })}
              />
              <div className="col-span-1 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{formatCurrency(r.total).replace('₹', '')}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => removeRow(idx)} disabled={rows.length === 1}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addRow} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tax Amount ₹</Label>
          <Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      {/* Totals */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3 space-y-1">
          <div className="flex justify-between text-xs"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-600">Tax</span><span className="font-semibold">{formatCurrency(Number(taxAmount || 0))}</span></div>
          <div className="flex justify-between text-sm pt-1 border-t border-slate-200 mt-1">
            <span className="font-bold text-slate-900">Grand Total</span>
            <span className="font-bold text-rose-600">{formatCurrency(grandTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <DialogFooter>
        <DialogClose asChild><Button variant="outline" onClick={onCancel}>Cancel</Button></DialogClose>
        <Button onClick={submit} disabled={saving} className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Save Purchase
        </Button>
      </DialogFooter>
    </div>
  )
}
