'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Trash2, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, ITEM_STATUS_LABELS, ITEM_STATUS_COLORS } from '@/lib/format'
import type { Order, OrderItem, MenuItem } from '@/lib/types'
import { useState } from 'react'

interface OrderCartProps {
  order: Order
  onInc: (item: OrderItem) => void
  onDec: (item: OrderItem) => void
  onRemove: (item: OrderItem) => void
  onAddNotes: (item: OrderItem, notes: string) => void
  onAddCustomItem: (item: MenuItem, qty: number) => void
  canEdit: boolean
}

export function OrderCart({
  order,
  onInc,
  onDec,
  onRemove,
  onAddNotes,
  onAddCustomItem,
  canEdit,
}: OrderCartProps) {
  const [notesFor, setNotesFor] = useState<OrderItem | null>(null)
  const [notesText, setNotesText] = useState('')

  const items = order.items || []
  const activeItems = items.filter((i) => i.status !== 'cancelled')
  const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)

  const openNotes = (it: OrderItem) => {
    setNotesFor(it)
    setNotesText(it.notes || '')
  }
  const saveNotes = () => {
    if (notesFor) onAddNotes(notesFor, notesText)
    setNotesFor(null)
    setNotesText('')
  }

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Current Order</h3>
            <p className="text-[11px] text-slate-500">
              Table {order.table?.number} · {order.guests} guest{order.guests > 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="outline" className="bg-white">
            {items.length} items
          </Badge>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 thin-scrollbar">
        {activeItems.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-400">
            No items yet.<br />Tap menu items on the left to add them.
          </div>
        )}
        <AnimatePresence initial={false}>
          {activeItems.map((it) => (
            <motion.div
              key={it.id}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0"
            >
              {/* Quantity controls */}
              <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden shrink-0">
                <button
                  onClick={() => (canEdit && it.status === 'pending' ? onDec(it) : null)}
                  disabled={!canEdit || it.status !== 'pending'}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-slate-900">{it.quantity}</span>
                <button
                  onClick={() => (canEdit && it.status === 'pending' ? onInc(it) : null)}
                  disabled={!canEdit || it.status !== 'pending'}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-slate-900 leading-tight">{it.name}</h4>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">
                    {formatCurrency(it.price * it.quantity)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500">{formatCurrency(it.price)} each</span>
                  {it.status !== 'pending' && (
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${ITEM_STATUS_COLORS[it.status]}`}>
                      {ITEM_STATUS_LABELS[it.status]}
                    </Badge>
                  )}
                  {it.notes && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      📝 {it.notes}
                    </span>
                  )}
                </div>
                {canEdit && it.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => openNotes(it)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <StickyNote className="w-3 h-3" /> {it.notes ? 'Edit note' : 'Add note'}
                    </button>
                    <button
                      onClick={() => onRemove(it)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 flex items-center gap-1 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer / total */}
      <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-600">Subtotal</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Taxes, service charge & discounts are applied at billing.
        </p>
      </div>

      {/* Notes modal */}
      <AnimatePresence>
        {notesFor && (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotesFor(null)}
          >
            <motion.div
              className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Notes for {notesFor.name}</h3>
                <button onClick={() => setNotesFor(null)} className="text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="e.g. less spicy, no onion, extra crispy…"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setNotesFor(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveNotes}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
