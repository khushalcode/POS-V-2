'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Edit, Trash2, Store, Loader2, Table2, ChevronDown, ChevronRight,
  MapPin, Phone, Hash, Palette, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession, type Shop } from '@/lib/session'

// ─── Types ─────────────────────────────────────────────────────
interface ShopRow extends Shop {
  active: boolean
}
interface TableRow {
  id: string
  shopId: string
  number: number
  name: string
  capacity: number
  status: string
}

// ─── Page ──────────────────────────────────────────────────────
export default function ShopsPage() {
  const shopFetch = useShopFetch()
  const { refreshShops } = useSession()
  const [shops, setShops] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null)
  const [shopTables, setShopTables] = useState<Record<string, TableRow[]>>({})

  // Shop dialog state
  const [showAddShop, setShowAddShop] = useState(false)
  const [editShop, setEditShop] = useState<ShopRow | null>(null)
  const [delShop, setDelShop] = useState<ShopRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Table dialog state
  const [showAddTable, setShowAddTable] = useState(false)
  const [editTable, setEditTable] = useState<TableRow | null>(null)
  const [delTable, setDelTable] = useState<TableRow | null>(null)
  const [tableSaving, setTableSaving] = useState(false)
  const [tableForShopId, setTableForShopId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await shopFetch('/api/shops')
      const data = await res.json()
      setShops(data.shops || [])
      // Refresh the session's shop list so the switcher in the header stays in sync
      refreshShops(data.shops || [])
    } finally {
      setLoading(false)
    }
  }, [shopFetch, refreshShops])

  useEffect(() => { load() }, [load])

  const loadTables = useCallback(async (shopId: string) => {
    // Use the same shopFetch but override the shopId scope by passing it in the URL
    // — use-shop-fetch uses the URL only for routing; tables.list reads shopId param from body.
    // Since useShopFetch always uses the session's currentShop id, we hit /api/tables
    // for the CURRENT shop only. To manage tables for ANY shop, we use a small inline approach:
    // we fetch via a special URL /api/tables?shopId=... which the shim handles below.
    const res = await shopFetch(`/api/tables?shopId=${shopId}`)
    const data = await res.json()
    setShopTables((prev) => ({ ...prev, [shopId]: data.tables || [] }))
  }, [shopFetch])

  const toggleExpand = (shopId: string) => {
    setExpandedShopId((prev) => {
      const next = prev === shopId ? null : shopId
      if (next && !shopTables[shopId]) loadTables(shopId)
      return next
    })
  }

  // ─── Shop save/delete ───
  const saveShop = async (data: any) => {
    setSaving(true)
    try {
      const isEdit = !!editShop
      const res = await shopFetch('/api/shops', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(isEdit ? { ...data, id: editShop!.id } : data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to save shop')
        return
      }
      toast.success(isEdit ? 'Shop updated' : 'Shop created')
      setShowAddShop(false)
      setEditShop(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteShop = async () => {
    if (!delShop) return
    setSaving(true)
    try {
      const res = await shopFetch(`/api/shops?id=${delShop.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to delete shop')
        return
      }
      toast.success(`Shop "${delShop.name}" deleted`)
      setDelShop(null)
      if (expandedShopId === delShop.id) setExpandedShopId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  // ─── Table save/delete ───
  const saveTable = async (data: any) => {
    if (!tableForShopId) return
    setTableSaving(true)
    try {
      const isEdit = !!editTable
      const payload = { ...data, shopId: tableForShopId, ...(isEdit ? { id: editTable!.id } : {}) }
      const res = await shopFetch('/api/tables', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to save table')
        return
      }
      toast.success(isEdit ? 'Table updated' : 'Table added')
      setShowAddTable(false)
      setEditTable(null)
      await loadTables(tableForShopId)
    } finally {
      setTableSaving(false)
    }
  }

  const handleDeleteTable = async () => {
    if (!delTable) return
    setTableSaving(true)
    try {
      const res = await shopFetch(`/api/tables?id=${delTable.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to delete table')
        return
      }
      toast.success(`Table "${delTable.name}" deleted`)
      setDelTable(null)
      await loadTables(delTable.shopId)
    } finally {
      setTableSaving(false)
    }
  }

  // Open table dialog helpers
  const openAddTable = (shopId: string) => {
    setTableForShopId(shopId)
    setEditTable(null)
    setShowAddTable(true)
  }
  const openEditTable = (t: TableRow) => {
    setTableForShopId(t.shopId)
    setEditTable(t)
    setShowAddTable(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" /> Shops &amp; Tables
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create new restaurant locations, manage their dining tables, and toggle shop active state.
          </p>
        </div>
        <Button onClick={() => { setEditShop(null); setShowAddShop(true) }} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Shop
        </Button>
      </div>

      {/* Shops list */}
      {shops.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-slate-500">
          No shops yet. Click <strong>Add Shop</strong> to create your first restaurant location.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const isExpanded = expandedShopId === shop.id
            const tables = shopTables[shop.id] || []
            const colorClasses: Record<string, string> = {
              orange: 'from-orange-500 to-rose-500',
              emerald: 'from-emerald-500 to-teal-500',
              violet: 'from-violet-500 to-fuchsia-500',
            }
            return (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden border-0 shadow-md">
                  {/* Shop header bar */}
                  <div className={`bg-gradient-to-r ${colorClasses[shop.color] || colorClasses.orange} px-4 py-3 flex items-center gap-3`}>
                    <button
                      onClick={() => toggleExpand(shop.id)}
                      className="text-white/90 hover:text-white shrink-0"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-white">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate">{shop.name}</h3>
                        <Badge variant="outline" className="bg-white/20 border-white/30 text-white text-[10px] uppercase">
                          {shop.code}
                        </Badge>
                        {!shop.active && (
                          <Badge className="bg-rose-900/40 border border-rose-300/40 text-rose-100 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-white/80 truncate">
                        {shop.address || 'No address'} · {shop.phone || 'No phone'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 h-8 px-2"
                        onClick={() => { setEditShop(shop); setShowAddShop(true) }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-rose-900/40 h-8 px-2"
                        onClick={() => setDelShop(shop)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Shop details + tables (expanded) */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="p-4 space-y-3">
                          {/* Quick stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <Stat label="Tax Rate" value={`${shop.taxRate}%`} />
                            <Stat label="Service Rate" value={`${shop.serviceRate ?? 0}%`} />
                            <Stat label="Currency" value={shop.currency} />
                            <Stat label="GSTIN" value={shop.gstin || '—'} />
                          </div>

                          {/* Tables section */}
                          <div className="border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Table2 className="w-4 h-4 text-slate-500" />
                                <h4 className="text-sm font-semibold">Tables ({tables.length})</h4>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAddTable(shop.id)}
                                className="h-7 text-xs"
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add Table
                              </Button>
                            </div>

                            {tables.length === 0 ? (
                              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                                No tables yet for this shop.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {tables.map((t) => (
                                  <div
                                    key={t.id}
                                    className="bg-white border border-slate-200 rounded-lg p-2.5 hover:shadow-sm transition-shadow"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold truncate">#{t.number} · {t.name}</p>
                                        <p className="text-[10px] text-slate-500">Cap: {t.capacity}</p>
                                        <Badge
                                          variant="outline"
                                          className={`mt-1 text-[9px] ${
                                            t.status === 'available'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : 'bg-rose-50 text-rose-700 border-rose-200'
                                          }`}
                                        >
                                          {t.status}
                                        </Badge>
                                      </div>
                                      <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                          onClick={() => openEditTable(t)}
                                          className="text-slate-400 hover:text-blue-600 p-0.5"
                                          aria-label="Edit table"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setDelTable(t)}
                                          className="text-slate-400 hover:text-rose-600 p-0.5"
                                          aria-label="Delete table"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ─── Shop Add/Edit Dialog ─── */}
      <Dialog open={showAddShop || !!editShop} onOpenChange={(o) => { if (!o) { setShowAddShop(false); setEditShop(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editShop ? 'Edit Shop' : 'Add New Shop'}</DialogTitle>
          </DialogHeader>
          <ShopForm
            initial={editShop}
            saving={saving}
            onSubmit={saveShop}
            onCancel={() => { setShowAddShop(false); setEditShop(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Shop Delete Confirm ─── */}
      <Dialog open={!!delShop} onOpenChange={(o) => !o && setDelShop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> Delete Shop
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              You are about to delete <strong>{delShop?.name}</strong> ({delShop?.code}).
            </p>
            <p className="text-rose-600 font-medium">
              This will also permanently delete all its tables, menu items, orders, and bills.
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteShop} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Table Add/Edit Dialog ─── */}
      <Dialog open={showAddTable || !!editTable} onOpenChange={(o) => { if (!o) { setShowAddTable(false); setEditTable(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTable ? 'Edit Table' : 'Add Table'}</DialogTitle>
          </DialogHeader>
          <TableForm
            initial={editTable}
            saving={tableSaving}
            onSubmit={saveTable}
            onCancel={() => { setShowAddTable(false); setEditTable(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Table Delete Confirm ─── */}
      <Dialog open={!!delTable} onOpenChange={(o) => !o && setDelTable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" /> Delete Table
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete <strong>#{delTable?.number} · {delTable?.name}</strong>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={tableSaving}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteTable} disabled={tableSaving}>
              {tableSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className="text-xs font-medium text-slate-700 truncate">{value}</p>
    </div>
  )
}

interface ShopFormProps {
  initial: ShopRow | null
  saving: boolean
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

function ShopForm({ initial, saving, onSubmit, onCancel }: ShopFormProps) {
  const [f, setF] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    color: initial?.color || 'orange',
    address: initial?.address || '',
    phone: initial?.phone || '',
    gstin: initial?.gstin || '',
    taxRate: String(initial?.taxRate ?? 5),
    serviceRate: String(initial?.serviceRate ?? 0),
    currency: initial?.currency || 'Rs.',
    active: initial?.active !== false,
  })
  const set = (k: keyof typeof f, v: any) => setF((prev) => ({ ...prev, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim() || !f.code.trim()) {
      toast.error('Name and Code are required')
      return
    }
    await onSubmit({
      ...f,
      taxRate: Number(f.taxRate) || 0,
      serviceRate: Number(f.serviceRate) || 0,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Shop Name <span className="text-rose-500">*</span></Label>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Spice Garden" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Code <span className="text-rose-500">*</span></Label>
          <Input
            value={f.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="SPICE"
            maxLength={10}
            required
            className="font-mono"
          />
          <p className="text-[10px] text-slate-400">Short uppercase code, max 10 chars. Must be unique.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Theme Color</Label>
          <Select value={f.color} onValueChange={(v) => set('color', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="orange">Orange</SelectItem>
              <SelectItem value="emerald">Emerald</SelectItem>
              <SelectItem value="violet">Violet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Currency</Label>
          <Input value={f.currency} onChange={(e) => set('currency', e.target.value)} placeholder="Rs." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</Label>
        <Input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="12 Marine Drive, Mumbai" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98200 11223" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Hash className="w-3 h-3" /> GSTIN</Label>
          <Input value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} placeholder="27SPICE2024G1Z9" className="font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tax Rate (%)</Label>
          <Input type="number" min="0" step="0.5" value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Service Charge (%)</Label>
          <Input type="number" min="0" step="0.5" value={f.serviceRate} onChange={(e) => set('serviceRate', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
        <div>
          <Label className="text-xs font-medium">Shop Active</Label>
          <p className="text-[10px] text-slate-500">Inactive shops are hidden from the shop switcher.</p>
        </div>
        <Switch checked={f.active} onCheckedChange={(v) => set('active', v)} />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={saving} className="bg-brand-gradient text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          {initial ? 'Save Changes' : 'Create Shop'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface TableFormProps {
  initial: TableRow | null
  saving: boolean
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

function TableForm({ initial, saving, onSubmit, onCancel }: TableFormProps) {
  const [f, setF] = useState({
    number: initial ? String(initial.number) : '',
    name: initial?.name || '',
    capacity: initial ? String(initial.capacity) : '4',
  })
  const set = (k: keyof typeof f, v: string) => setF((prev) => ({ ...prev, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(f.number)
    if (Number.isNaN(num) || num < 0) {
      toast.error('Table number must be a non-negative integer')
      return
    }
    await onSubmit({
      number: num,
      name: f.name.trim() || (num === 0 ? 'Direct Counter' : `Table ${num}`),
      capacity: Number(f.capacity) || 0,
    })
  }

  const isDirectCounter = initial?.number === 0

  return (
    <form onSubmit={submit} className="space-y-3">
      {isDirectCounter && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>This is the <strong>Direct Counter</strong> table (number 0) — used for takeaway &amp; Zomato orders. Editing is allowed but deletion is not recommended.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Table Number <span className="text-rose-500">*</span></Label>
          <Input
            type="number"
            min="0"
            value={f.number}
            onChange={(e) => set('number', e.target.value)}
            placeholder="1"
            required
            autoFocus
            disabled={isDirectCounter}
          />
          <p className="text-[10px] text-slate-400">Use 0 for Direct Counter. Must be unique per shop.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Capacity</Label>
          <Input
            type="number"
            min="0"
            value={f.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            placeholder="4"
          />
          <p className="text-[10px] text-slate-400">Number of seats. 0 for Direct Counter.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Display Name</Label>
        <Input
          value={f.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Table 1"
        />
        <p className="text-[10px] text-slate-400">Leave blank to auto-generate from the number.</p>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={saving} className="bg-brand-gradient text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          {initial ? 'Save Changes' : 'Add Table'}
        </Button>
      </DialogFooter>
    </form>
  )
}
