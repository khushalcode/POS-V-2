'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Plus, Trash2, ChefHat, Bike, Store, Phone, MapPin, Loader2,
  Clock, CheckCircle2, Package, X, AlertCircle, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format'
import type { ZomatoOrder, ZomatoStatus } from '@/lib/types'
import { useShopFetch } from '@/hooks/use-shop-fetch'

const STATUS_LABELS: Record<ZomatoStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<ZomatoStatus, string> = {
  new: 'bg-rose-100 text-rose-700 border-rose-200',
  accepted: 'bg-amber-100 text-amber-700 border-amber-200',
  preparing: 'bg-blue-100 text-blue-700 border-blue-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  dispatched: 'bg-violet-100 text-violet-700 border-violet-200',
  delivered: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200 line-through',
}

export default function ZomatoPage() {
  const shopFetch = useShopFetch()
  const [orders, setOrders] = useState<ZomatoOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [delItem, setDelItem] = useState<ZomatoOrder | null>(null)
  const [pushing, setPushing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch('/api/zomato' + (filter !== 'all' ? `?status=${filter}` : ''))
    const data = await res.json()
    setOrders(data.orders)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  // Auto-poll every 20s for new orders (simulating Zomato webhook)
  useEffect(() => {
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await shopFetch('/api/zomato/sync', { method: 'POST' })
      const data = await res.json()
      if (data.count > 0) {
        toast.success(`Synced ${data.count} new order${data.count > 1 ? 's' : ''} from Zomato`)
      } else {
        toast.info('No new orders from Zomato')
      }
      load()
    } finally {
      setSyncing(false)
    }
  }

  const updateStatus = async (id: string, status: ZomatoStatus) => {
    setOrders((cur) => cur.map((o) => (o.id === id ? { ...o, status } : o)))
    await shopFetch(`/api/zomato/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (status === 'dispatched') toast.success('Order dispatched')
  }

  const pushToKitchen = async (order: ZomatoOrder) => {
    setPushing(order.id)
    try {
      const res = await shopFetch(`/api/zomato/${order.id}/push`, { method: 'POST' })
      if (!res.ok) {
        const e = await res.json()
        toast.error(e.error || 'Failed to push')
        return
      }
      toast.success(`${order.zomatoOrderId} pushed to kitchen`)
      load()
    } finally {
      setPushing(null)
    }
  }

  const handleAdd = async (data: any) => {
    const res = await shopFetch('/api/zomato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error('Failed to create'); return }
    toast.success('Manual Zomato order created')
    setShowAdd(false)
    load()
  }

  const del = async () => {
    if (!delItem) return
    await shopFetch(`/api/zomato/${delItem.id}`, { method: 'DELETE' })
    toast.success('Order deleted')
    setDelItem(null)
    load()
  }

  const counts = {
    new: orders.filter((o) => o.status === 'new').length,
    active: orders.filter((o) => ['accepted', 'preparing', 'ready'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Zomato Orders
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">ZOMATO</span>
          </h1>
          <p className="text-[10px] sm:text-sm text-slate-500">
            {counts.new} new · {counts.active} active · {counts.delivered} delivered today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 sm:w-40 h-9 text-xs bg-white"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAdd(true)} variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Manual
          </Button>
          <Button onClick={handleSync} disabled={syncing} className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sync
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <Bike className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Zomato orders yet</h3>
          <p className="text-sm mb-4">Click Sync to fetch orders from Zomato (simulated), or add a manual entry.</p>
          <Button onClick={handleSync} disabled={syncing} className="bg-gradient-to-r from-rose-500 to-red-500 text-white">
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sync Now
          </Button>
        </Card>
      )}

      {/* Order cards */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {orders.map((o, i) => {
              const items = (() => { try { return JSON.parse(o.items) as any[] } catch { return [] } })()
              return (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                >
                  <Card className={`border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all ${
                    o.status === 'new' ? 'ring-2 ring-rose-300' : ''
                  }`}>
                    {/* Header */}
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      o.status === 'new' ? 'bg-rose-50' :
                      o.status === 'delivered' ? 'bg-slate-50' :
                      o.status === 'cancelled' ? 'bg-rose-50' :
                      'bg-slate-50'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">{o.zomatoOrderId}</h3>
                          <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[o.status]}`}>
                            {STATUS_LABELS[o.status]}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500">{timeAgo(o.createdAt)} · {formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        {o.deliveryType === 'delivery' ? <Bike className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                        <span className="text-[10px] uppercase font-semibold">{o.deliveryType}</span>
                      </div>
                    </div>

                    {/* Body */}
                    <CardContent className="p-4 space-y-3">
                      {/* Customer */}
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{o.customerName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          {o.customerPhone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{o.customerPhone}</span>
                          )}
                          <Badge variant="outline" className="text-[9px] uppercase">{o.paymentMode}</Badge>
                        </div>
                        {o.address && (
                          <div className="flex items-start gap-1 text-xs text-slate-600 mt-1.5">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{o.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                        {items.map((it: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">{it.qty}× {it.name}</span>
                            <span className="font-medium text-slate-900">{formatCurrency(it.price * it.qty)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Notes */}
                      {o.notes && (
                        <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{o.notes}</span>
                        </div>
                      )}

                      {/* Totals */}
                      <div className="space-y-0.5 text-xs">
                        <div className="flex justify-between text-slate-500">
                          <span>Subtotal</span><span>{formatCurrency(o.subtotal)}</span>
                        </div>
                        {o.taxAmount > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>Tax</span><span>{formatCurrency(o.taxAmount)}</span>
                          </div>
                        )}
                        {o.packagingCharge > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>Packaging</span><span>{formatCurrency(o.packagingCharge)}</span>
                          </div>
                        )}
                        {o.deliveryFee > 0 && (
                          <div className="flex justify-between text-slate-500">
                            <span>Delivery</span><span>{formatCurrency(o.deliveryFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200 mt-1">
                          <span>Total</span><span>{formatCurrency(o.total)}</span>
                        </div>
                      </div>

                      {/* Internal link */}
                      {o.internalOrderId && (
                        <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Pushed to kitchen · Order ID: {o.internalOrderId.slice(-8)}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1.5 pt-1">
                        {o.status === 'new' && !o.internalOrderId && (
                          <Button
                            onClick={() => pushToKitchen(o)}
                            disabled={pushing === o.id}
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white"
                          >
                            {pushing === o.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ChefHat className="w-3.5 h-3.5 mr-1" />}
                            Push to Kitchen
                          </Button>
                        )}
                        {o.status === 'accepted' && (
                          <Button onClick={() => updateStatus(o.id, 'preparing')} size="sm" variant="outline" className="flex-1">
                            <ChefHat className="w-3.5 h-3.5 mr-1" /> Start Preparing
                          </Button>
                        )}
                        {o.status === 'preparing' && (
                          <Button onClick={() => updateStatus(o.id, 'ready')} size="sm" variant="outline" className="flex-1">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Ready
                          </Button>
                        )}
                        {o.status === 'ready' && o.deliveryType === 'delivery' && (
                          <Button onClick={() => updateStatus(o.id, 'dispatched')} size="sm" variant="outline" className="flex-1">
                            <Bike className="w-3.5 h-3.5 mr-1" /> Dispatch
                          </Button>
                        )}
                        {o.status === 'ready' && o.deliveryType === 'pickup' && (
                          <Button onClick={() => updateStatus(o.id, 'delivered')} size="sm" variant="outline" className="flex-1">
                            <Package className="w-3.5 h-3.5 mr-1" /> Picked Up
                          </Button>
                        )}
                        {o.status === 'dispatched' && (
                          <Button onClick={() => updateStatus(o.id, 'delivered')} size="sm" variant="outline" className="flex-1">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Delivered
                          </Button>
                        )}
                        {o.status === 'new' && (
                          <Button onClick={() => updateStatus(o.id, 'cancelled')} size="sm" variant="ghost" className="text-rose-500">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button onClick={() => setDelItem(o)} size="sm" variant="ghost" className="text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Manual entry dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Manual Zomato Order</DialogTitle>
          </DialogHeader>
          <ManualZomatoForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete order</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Delete <strong>{delItem?.zomatoOrderId}</strong>?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ManualZomatoForm({ onSubmit, onCancel }: { onSubmit: (d: any) => Promise<void>; onCancel: () => void }) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryType, setDeliveryType] = useState('delivery')
  const [address, setAddress] = useState('')
  const [paymentMode, setPaymentMode] = useState('prepaid')
  const [itemsRaw, setItemsRaw] = useState('Butter Chicken x1\nButter Naan x2')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    // Parse items: "Name xQty" or "Name qty" per line, with optional "@price"
    const lines = itemsRaw.split('\n').map((l) => l.trim()).filter(Boolean)
    const items = lines.map((line) => {
      const m = line.match(/^(.+?)\s*[x×]\s*(\d+)\s*(?:@\s*(\d+))?$/i)
        || line.match(/^(.+?)\s+(\d+)\s*(?:@\s*(\d+))?$/)
      if (m) {
        return {
          name: m[1].trim(),
          qty: Number(m[2]),
          price: m[3] ? Number(m[3]) : 100, // default price if not specified
        }
      }
      return { name: line, qty: 1, price: 100 }
    })
    if (!customerName || items.length === 0) {
      toast.error('Customer name and at least one item required')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        customerName,
        customerPhone,
        deliveryType,
        address,
        paymentMode,
        items,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Customer Name</Label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Doe" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="98765 43210" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Delivery Type</Label>
          <Select value={deliveryType} onValueChange={setDeliveryType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Payment</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prepaid">Prepaid</SelectItem>
              <SelectItem value="cod">Cash on Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {deliveryType === 'delivery' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Delivery Address</Label>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" rows={2} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Items (one per line, format: "Name xQty @Price")</Label>
        <Textarea
          value={itemsRaw}
          onChange={(e) => setItemsRaw(e.target.value)}
          placeholder={'Butter Chicken x1 @320\nButter Naan x2 @50'}
          rows={4}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-slate-400">Examples: "Paneer Tikka x2 @220" or "Cold Coffee x1 @120"</p>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1 bg-gradient-to-r from-rose-500 to-red-500 text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Create Order
        </Button>
      </div>
    </div>
  )
}
