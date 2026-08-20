'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Check, Minus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import { getItemEmoji } from '@/lib/menu-images'
import type { MenuItem, OrderItem } from '@/lib/types'

interface MenuPickerProps {
  items: MenuItem[]
  onAdd: (item: MenuItem, qty: number) => void
  disabled?: boolean
  /** Current order items — used to show selected state with quantity badges */
  orderItems?: OrderItem[]
}

export function MenuPicker({ items, onAdd, disabled, orderItems }: MenuPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Build a map of menuItemId → total quantity (only count non-cancelled items)
  const orderQtyMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const oi of (orderItems || [])) {
      if (oi.status === 'cancelled') continue
      map.set(oi.menuItemId, (map.get(oi.menuItemId) || 0) + oi.quantity)
    }
    return map
  }, [orderItems])

  // All unique categories from the menu items (for the quick-access chips)
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => set.add(it.category))
    return Array.from(set).sort()
  }, [items])

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    items.forEach((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return
      // Apply category chip filter
      if (activeCategory !== 'all' && item.category !== activeCategory) return
      const arr = map.get(item.category) || []
      arr.push(item)
      map.set(item.category, arr)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items, search, activeCategory])

  return (
    <div className="flex flex-col h-full">
      {/* Search — glassmorphism */}
      <div className="relative mb-3 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu…"
          className="pl-9 bg-white/70 backdrop-blur-md border-white/30 shadow-sm"
        />
      </div>

      {/* Quick-access category chips - horizontal scrollable row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 shrink-0 thin-scrollbar">
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
            activeCategory === 'all'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-white'
          }`}
        >
          All ({items.length})
        </button>
        {allCategories.map((cat) => {
          const count = items.filter((it) => it.category === cat).length
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? 'all' : cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white/80 text-slate-600 border border-slate-200 hover:bg-white'
              }`}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {/* Items grouped by category — glassmorphism cards */}
      <div className="overflow-y-auto flex-1 pr-1 space-y-4 thin-scrollbar">
        {grouped.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">
            No items match the current filter
          </div>
        )}
        {grouped.map(([category, catItems]) => (
          <div key={category}>
            {/* Category header — glassmorphism sticky */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 z-10 py-1.5 px-2 rounded-lg bg-white/80 backdrop-blur-md shadow-sm border border-white/30">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{category}</span>
              <span className="text-[10px] text-slate-400">({catItems.length})</span>
            </div>
            {/* Items grid — glassmorphism cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {catItems.map((item, i) => {
                const qty = orderQtyMap.get(item.id) || 0
                const isSelected = qty > 0
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: i * 0.01 }}
                  >
                    <Card
                      className={`relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-md border ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400 shadow-emerald-200/40'
                          : 'bg-white/80 border-white/40'
                      } ${
                        disabled || !item.available ? 'opacity-50 pointer-events-none' : ''
                      } ${!isSelected ? cardGlow(category) : ''}`}
                      onClick={() => !disabled && item.available && onAdd(item, 1)}
                    >
                      {/* Image area */}
                      <div className="h-14 bg-gradient-to-br from-white/60 to-slate-100/60 backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent && !parent.querySelector('.fallback-emoji')) {
                                const span = document.createElement('span')
                                span.className = 'fallback-emoji text-2xl'
                                span.textContent = getItemEmoji(item.name)
                                parent.appendChild(span)
                              }
                            }}
                          />
                        ) : (
                          <span className="text-2xl">{getItemEmoji(item.name)}</span>
                        )}

                        {/* Top-right: + icon OR quantity badge with +/- controls */}
                        {isSelected ? (
                          <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-emerald-500 text-white rounded-full shadow-md px-1 py-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Decrement by 1 — caller handles min-0 / removal
                                onAdd(item, -1)
                              }}
                              className="w-4 h-4 flex items-center justify-center hover:bg-emerald-600 rounded-full"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-2.5 h-2.5" strokeWidth={3} />
                            </button>
                            <span className="text-[10px] font-bold min-w-[14px] text-center">{qty}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onAdd(item, 1)
                              }}
                              className="w-4 h-4 flex items-center justify-center hover:bg-emerald-600 rounded-full"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-2.5 h-2.5" strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                            <Plus className="w-3 h-3 text-slate-600" />
                          </div>
                        )}

                        {/* Selected checkmark badge (bottom-left) */}
                        {isSelected && (
                          <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </div>
                        )}

                        {!item.available && (
                          <div className="absolute inset-0 bg-rose-900/40 flex items-center justify-center">
                            <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-200">NA</Badge>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className={`p-2 backdrop-blur-sm ${isSelected ? 'bg-emerald-50/60' : 'bg-white/60'}`}>
                        <h4 className="font-semibold text-[12px] text-slate-900 leading-tight truncate">{item.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-bold text-sm text-slate-900">{formatCurrency(item.price)}</span>
                          <span className="text-[9px] text-slate-500">{item.unit}</span>
                        </div>
                        {/* Inline selected state footer */}
                        {isSelected && (
                          <div className="mt-1 pt-1 border-t border-emerald-200">
                            <p className="text-[10px] font-semibold text-emerald-700 text-center">
                              In cart: {qty} × {formatCurrency(item.price)} = {formatCurrency(qty * item.price)}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function cardGlow(category: string): string {
  const map: Record<string, string> = {
    Sandwich: 'hover:shadow-amber-200/50',
    Pizza: 'hover:shadow-rose-200/50',
    Maggie: 'hover:shadow-orange-200/50',
    Momos: 'hover:shadow-sky-200/50',
    Burgers: 'hover:shadow-amber-200/50',
    'Chips & Fries': 'hover:shadow-yellow-200/50',
    Drinks: 'hover:shadow-blue-200/50',
    Juices: 'hover:shadow-emerald-200/50',
    Shakes: 'hover:shadow-violet-200/50',
  }
  return map[category] || 'hover:shadow-slate-200/50'
}
