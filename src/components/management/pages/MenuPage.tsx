'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Edit, Trash2, Package, X, Check, Loader2, SlidersHorizontal,
  Tags, GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import type { MenuItem } from '@/lib/types'
import { useShopFetch } from '@/hooks/use-shop-fetch'

// Default categories are now seeded server-side via /api/menu-categories.
// We keep this list only as a UI fallback before the first API load completes.
const DEFAULT_CATEGORIES = ['Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts', 'General']
const UNITS = ['Pcs', 'Plate', 'Bowl', 'Glass', 'Cup', 'Kg', 'Ltr']

// Color palette for categories. Keys match what the API stores in `color`.
const CATEGORY_COLORS: { key: string; label: string; badge: string; dot: string }[] = [
  { key: 'slate',  label: 'Slate',  badge: 'bg-slate-100 text-slate-700 border-slate-200',  dot: 'bg-slate-400' },
  { key: 'amber',  label: 'Amber',  badge: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  { key: 'rose',   label: 'Rose',   badge: 'bg-rose-100 text-rose-700 border-rose-200',    dot: 'bg-rose-400' },
  { key: 'orange', label: 'Orange', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  { key: 'sky',    label: 'Sky',    badge: 'bg-sky-100 text-sky-700 border-sky-200',        dot: 'bg-sky-400' },
  { key: 'violet', label: 'Violet', badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-400' },
  { key: 'emerald',label: 'Emerald',badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
]

export interface MenuCategory {
  id: string
  name: string
  color: string
  sortOrder: number
}

function colorBadge(colorKey: string): string {
  return (CATEGORY_COLORS.find((c) => c.key === colorKey) || CATEGORY_COLORS[0]).badge
}

export default function MenuPage() {
  const shopFetch = useShopFetch()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [delItem, setDelItem] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [showCategories, setShowCategories] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await shopFetch('/api/menu')
    const data = await res.json()
    setItems(data.items)
    setLoading(false)
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const res = await shopFetch('/api/menu-categories')
      if (!res.ok) {
        console.warn('[MenuPage] loadCategories failed:', res.status)
        return
      }
      const data = await res.json()
      if (Array.isArray(data.categories)) setCategories(data.categories)
    } catch (e) {
      console.warn('[MenuPage] loadCategories error:', e)
    }
  }, [shopFetch])

  useEffect(() => {
    load()
    loadCategories()
  }, [load, loadCategories])

  // Names available in the dropdowns. If the API hasn't loaded yet, or
  // returns an empty list, we fall back to DEFAULT_CATEGORIES so the UI
  // is never blank.
  const categoryNames = categories.length > 0 ? categories.map((c) => c.name) : DEFAULT_CATEGORIES

  const filtered = items.filter((it) => {
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter !== 'all' && it.category !== categoryFilter) return false
    if (stockFilter === 'instock' && it.stock <= 5) return false
    if (stockFilter === 'low' && (it.stock > 5 || it.stock === 0)) return false
    if (stockFilter === 'out' && it.stock > 0) return false
    return true
  })

  const handleCreate = async (data: any) => {
    const res = await shopFetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error('Failed to create item')
      return
    }
    toast.success('Item added')
    setShowAdd(false)
    load()
  }

  const handleUpdate = async (data: any) => {
    if (!editItem) return
    const res = await shopFetch(`/api/menu/${editItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error('Failed to update')
      return
    }
    toast.success('Item updated')
    setEditItem(null)
    load()
  }

  const handleDelete = async () => {
    if (!delItem) return
    const res = await shopFetch(`/api/menu/${delItem.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete')
      return
    }
    toast.success('Item deleted')
    setDelItem(null)
    load()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Menu Items</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">{items.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-40 sm:w-56 h-9 text-sm bg-white"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-32 sm:w-40 h-9 text-xs bg-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryNames.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-28 sm:w-32 h-9 text-xs bg-white">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="instock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowCategories(true)}
            className="h-9 text-xs"
            title="Add, rename, or remove menu categories"
          >
            <Tags className="w-4 h-4 mr-1" /> Categories
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {/* ─── Quick-access category chips bar ───────────────────────────
          Horizontal scrollable row of category buttons for instant
          filtering. Click a chip to filter items by that category.
          Click "All" to show everything. The active chip is highlighted. */}
      {!loading && categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 thin-scrollbar">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({items.length})
          </button>
          {categories.map((c) => {
            const count = items.filter((it) => it.category === c.name).length
            const colorMap: Record<string, string> = {
              amber: 'bg-amber-500',
              rose: 'bg-rose-500',
              orange: 'bg-orange-500',
              sky: 'bg-sky-500',
              violet: 'bg-violet-500',
              slate: 'bg-slate-500',
              emerald: 'bg-emerald-500',
            }
            const isActive = categoryFilter === c.name
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(isActive ? 'all' : c.name)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colorMap[c.color] || colorMap.slate}`} />
                {c.name}
                <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-slate-400'}`}>({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Items grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No items found</h3>
          <p className="text-sm">Try adjusting filters or add a new item.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((it, i) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.2) }}
              >
                <Card className="border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 group">
                  <CardContent className="p-0">
                    <div className="h-20 bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center relative overflow-hidden">
                      {it.image ? (
                        <img
                          src={it.image}
                          alt={it.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent && !parent.querySelector('.fallback-emoji')) {
                              const span = document.createElement('span')
                              span.className = 'fallback-emoji text-3xl'
                              span.textContent = getEmoji(it.name)
                              parent.appendChild(span)
                            }
                          }}
                        />
                      ) : (
                        <span className="text-3xl">{getEmoji(it.name)}</span>
                      )}
                      <Badge className={`absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0 ${
                        // Prefer the user-picked color from the categories list; fall
                        // back to the legacy static map so unknown categories still
                        // render with a reasonable color.
                        categories.find((c) => c.name === it.category)
                          ? colorBadge(categories.find((c) => c.name === it.category)!.color)
                          : catColor(it.category)
                      }`}>
                        {it.category}
                      </Badge>
                      <Badge variant="outline" className={`absolute bottom-1.5 left-1.5 text-[9px] px-1 py-0 ${
                        it.stock > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : it.stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {it.stock > 5 ? 'In Stock' : it.stock > 0 ? 'Low' : 'Out'}
                      </Badge>
                      {/* Edit & Delete — always visible (no longer hover-only).
                          A semi-transparent white backdrop keeps them legible
                          regardless of the underlying image/emoji. */}
                      <div className="absolute top-1.5 left-1.5 flex gap-1">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 bg-white/90 backdrop-blur shadow-sm hover:bg-white"
                          title="Edit item"
                          onClick={() => setEditItem(it)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 bg-white/90 backdrop-blur shadow-sm hover:bg-white text-rose-500 hover:text-rose-600"
                          title="Delete item"
                          onClick={() => setDelItem(it)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <h3 className="font-semibold text-[13px] text-slate-900 truncate">{it.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-bold text-orange-600">
                          {formatCurrency(it.price)}
                          <span className="text-[10px] font-normal text-slate-400">/{it.unit}</span>
                        </p>
                        <span className="text-[10px] text-slate-500">{it.stock} {it.unit}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showAdd || !!editItem} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditItem(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <ItemForm
            initial={editItem}
            categories={categoryNames}
            onSubmit={editItem ? handleUpdate : handleCreate}
            onCancel={() => { setShowAdd(false); setEditItem(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delItem} onOpenChange={(o) => !o && setDelItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete <strong>{delItem?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage categories dialog */}
      <CategoriesManager
        open={showCategories}
        onClose={() => setShowCategories(false)}
        categories={categories}
        onChange={loadCategories}
        onItemsChanged={load}
        shopFetch={shopFetch}
      />
    </div>
  )
}

function ItemForm({
  initial,
  categories,
  onSubmit,
  onCancel,
}: {
  initial: MenuItem | null
  categories: string[]
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [f, setF] = useState({
    name: initial?.name || '',
    category: initial?.category || 'General',
    price: initial?.price?.toString() || '',
    cost: initial?.cost?.toString() || '0',
    stock: initial?.stock?.toString() || '0',
    unit: initial?.unit || 'Pcs',
    image: initial?.image || '',
    available: initial?.available ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      toast.error('Image too large (max 500KB)')
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setF({ ...f, image: ev.target?.result as string })
      setUploading(false)
    }
    reader.onerror = () => {
      toast.error('Could not read image')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!f.name || !f.price) {
      toast.error('Name and price are required')
      return
    }
    setSaving(true)
    try {
      await onSubmit(f)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Paneer Tikka" />
      </div>

      {/* Image upload */}
      <div className="space-y-1.5">
        <Label className="text-xs">Item Image (optional)</Label>
        <div className="flex items-start gap-3">
          <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            {f.image ? (
              <img src={f.image} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{getEmoji(f.name || '')}</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-8 text-xs"
              >
                {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
              {f.image && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setF({ ...f, image: '' })}
                  className="h-8 text-xs text-rose-600"
                >
                  Remove
                </Button>
              )}
            </div>
            <Input
              value={f.image.startsWith('data:') ? '' : f.image}
              onChange={(e) => setF({ ...f, image: e.target.value })}
              placeholder="Or paste image URL"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-slate-400">PNG/JPG up to 500KB. Falls back to emoji if no image.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {/* Use the dynamic category list; if it's empty for any reason
                  fall back to a single General option so the dropdown isn't empty. */}
              {(categories.length > 0 ? categories : ['General']).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Unit</Label>
          <Select value={f.unit} onValueChange={(v) => setF({ ...f, unit: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Price ₹</Label>
          <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cost ₹</Label>
          <Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Stock</Label>
          <Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} placeholder="0" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="avail"
          checked={f.available}
          onChange={(e) => setF({ ...f, available: e.target.checked })}
          className="w-4 h-4 rounded"
        />
        <Label htmlFor="avail" className="text-xs cursor-pointer">Available for ordering</Label>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          {initial ? 'Update' : 'Add'} Item
        </Button>
      </div>
    </div>
  )
}

function getEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('chicken') || n.includes('mutton')) return '🍗'
  if (n.includes('fish')) return '🐟'
  if (n.includes('paneer') || n.includes('tikka')) return '🧀'
  if (n.includes('biryani') || n.includes('rice')) return '🍚'
  if (n.includes('naan') || n.includes('roti') || n.includes('paratha')) return '🍞'
  if (n.includes('chai') || n.includes('tea') || n.includes('coffee')) return '☕'
  if (n.includes('lassi') || n.includes('juice') || n.includes('soda')) return '🥤'
  if (n.includes('water')) return '💧'
  if (n.includes('ice cream') || n.includes('brownie')) return '🍨'
  if (n.includes('gulab') || n.includes('rasmalai')) return '🍮'
  if (n.includes('dal')) return '🍲'
  if (n.includes('spring') || n.includes('fingers') || n.includes('crispy')) return '🍟'
  return '🍽️'
}

function catColor(cat: string): string {
  const map: Record<string, string> = {
    Starters: 'bg-amber-100 text-amber-700 border-amber-200',
    'Main Course': 'bg-rose-100 text-rose-700 border-rose-200',
    Breads: 'bg-orange-100 text-orange-700 border-orange-200',
    Beverages: 'bg-sky-100 text-sky-700 border-sky-200',
    Desserts: 'bg-violet-100 text-violet-700 border-violet-200',
    General: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  return map[cat] || map.General
}

// ─────────────────────────────────────────────────────────────────────────
// CategoriesManager — modal dialog for adding / renaming / deleting menu
// categories. Talks to /api/menu-categories. When a category is renamed or
// deleted the parent refreshes the items list too (because menu items
// reference the category name as a plain string).
// ─────────────────────────────────────────────────────────────────────────
function CategoriesManager({
  open,
  onClose,
  categories,
  onChange,
  onItemsChanged,
  shopFetch,
}: {
  open: boolean
  onClose: () => void
  categories: MenuCategory[]
  onChange: () => Promise<void> | void
  onItemsChanged: () => Promise<void> | void
  shopFetch: (url: string, init?: RequestInit) => Promise<Response>
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('slate')
  const [busy, setBusy] = useState(false)
  // editingId / editingName hold the category currently being renamed inline.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [delConfirm, setDelConfirm] = useState<MenuCategory | null>(null)

  // Reset the "add new" form whenever the dialog is opened.
  useEffect(() => {
    if (open) {
      setNewName('')
      setNewColor('slate')
      setEditingId(null)
      setDelConfirm(null)
    }
  }, [open])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a category name')
      return
    }
    setBusy(true)
    try {
      const res = await shopFetch('/api/menu-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newColor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Failed to add category')
        return
      }
      toast.success(`Category "${name}" added`)
      setNewName('')
      setNewColor('slate')
      await onChange()
    } catch (e) {
      toast.error('Failed to add category')
    } finally {
      setBusy(false)
    }
  }

  const handleRenameSave = async (cat: MenuCategory) => {
    const name = editingName.trim()
    if (!name || name === cat.name) {
      setEditingId(null)
      return
    }
    setBusy(true)
    try {
      const res = await shopFetch(`/api/menu-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Failed to rename')
        return
      }
      toast.success('Category renamed')
      setEditingId(null)
      // Renaming changes the `category` string on MenuItem rows, so refresh items too.
      await Promise.all([onChange(), onItemsChanged()])
    } catch {
      toast.error('Failed to rename')
    } finally {
      setBusy(false)
    }
  }

  const handleColorChange = async (cat: MenuCategory, color: string) => {
    setBusy(true)
    try {
      const res = await shopFetch(`/api/menu-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) {
        toast.error('Failed to update color')
        return
      }
      await onChange()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) return
    setBusy(true)
    try {
      const res = await shopFetch(`/api/menu-categories/${delConfirm.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Failed to delete')
        return
      }
      toast.success(`Deleted "${delConfirm.name}" — items moved to "General"`)
      setDelConfirm(null)
      // Deleting reassigns items to "General", so refresh items too.
      await Promise.all([onChange(), onItemsChanged()])
    } catch {
      toast.error('Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          {/* Add new */}
          <div className="space-y-2">
            <Label className="text-xs">Add a new category</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Soups, Sides, Combo…"
                className="flex-1 h-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busy) handleAdd()
                }}
              />
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_COLORS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={busy || !newName.trim()}
                className="h-9 bg-gradient-to-r from-orange-500 to-rose-500 text-white"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Existing list */}
          <div className="border-t border-slate-200 pt-3">
            <Label className="text-xs text-slate-500">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
            </Label>
            <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {categories.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">
                  No categories yet. Add one above.
                </p>
              )}
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  {/* Color picker popover — quick inline */}
                  <Select
                    value={cat.color}
                    onValueChange={(v) => handleColorChange(cat, v)}
                    disabled={busy}
                  >
                    <SelectTrigger className="w-7 h-7 p-0 border-0 bg-transparent shadow-none">
                      <span className={`w-4 h-4 rounded-full ${
                        (CATEGORY_COLORS.find((c) => c.key === cat.color) || CATEGORY_COLORS[0]).dot
                      }`} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_COLORS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editingId === cat.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !busy) handleRenameSave(cat)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <span className="flex-1 text-sm text-slate-800">{cat.name}</span>
                  )}

                  {editingId === cat.id ? (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600"
                        onClick={() => handleRenameSave(cat)}
                        disabled={busy}
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingId(cat.id)
                          setEditingName(cat.name)
                        }}
                        disabled={busy}
                        title="Rename"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-500 hover:text-rose-600"
                        onClick={() => setDelConfirm(cat)}
                        disabled={busy}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Deleting a category moves its menu items into <strong>General</strong>.
              Renaming a category updates all items that use it.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button onClick={onClose}>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delConfirm} onOpenChange={(o) => !o && setDelConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete <strong>{delConfirm?.name}</strong>? All menu items in this category
            will be moved to <strong>General</strong>.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
