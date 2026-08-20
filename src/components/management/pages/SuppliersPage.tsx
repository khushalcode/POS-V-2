'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Edit, Trash2, Truck, Phone, Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Supplier } from '@/lib/types'
import { PartyForm } from './CustomersPage'
import { useShopFetch } from '@/hooks/use-shop-fetch'

export default function SuppliersPage() {
  const shopFetch = useShopFetch()
  const [items, setItems] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<Supplier | null>(null)
  const [delItem, setDelItem] = useState<Supplier | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch(`/api/suppliers?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setItems(data.suppliers)
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const save = async (data: any) => {
    const isEdit = !!editItem
    const res = await shopFetch('/api/suppliers', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...data, id: editItem!.id } : data),
    })
    if (!res.ok) { toast.error('Failed to save'); return }
    toast.success(isEdit ? 'Supplier updated' : 'Supplier added')
    setShowAdd(false)
    setEditItem(null)
    load()
  }

  const del = async () => {
    if (!delItem) return
    const res = await shopFetch(`/api/suppliers?id=${delItem.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    toast.success('Supplier deleted')
    setDelItem(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Suppliers</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">{items.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-48 sm:w-64 h-9 text-sm bg-white" />
          </div>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No suppliers yet</h3>
          <p className="text-sm">Add suppliers to track purchases.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {items.map((s, i) => (
              <motion.div key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}>
                <Card className="border-0 shadow-md rounded-2xl hover:shadow-lg transition-all group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-slate-900">{s.name}</h3>
                          <p className="text-[10px] text-slate-400">Since {new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditItem(s)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setDelItem(s)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /><span>{s.phone}</span></div>}
                      {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /><span className="truncate">{s.email}</span></div>}
                      {s.address && <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 text-slate-400 mt-0.5" /><span className="line-clamp-2">{s.address}</span></div>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={showAdd || !!editItem} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditItem(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <PartyForm initial={editItem} onSubmit={save} onCancel={() => { setShowAdd(false); setEditItem(null) }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete supplier</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Delete <strong>{delItem?.name}</strong>?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
