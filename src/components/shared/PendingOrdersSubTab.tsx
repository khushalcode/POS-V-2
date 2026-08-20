'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ChefHat, CheckCircle2, Flame, Utensils, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, timeAgo, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/format'
import type { Order } from '@/lib/types'

interface PendingOrdersSubTabProps {
  shopFetch: (url: string, options?: RequestInit) => Promise<any>
  onPickOrder: (orderId: string) => void
  /** Title shown above the pending list (defaults to "Pending in Kitchen") */
  title?: string
}

/**
 * PendingOrdersSubTab
 * Shows a horizontal list of orders currently in the kitchen
 * (status: sent / preparing / ready). User can click any to jump to it.
 */
export function PendingOrdersSubTab({ shopFetch, onPickOrder, title = 'Pending in Kitchen' }: PendingOrdersSubTabProps) {
  const [pending, setPending] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch orders with sent, preparing, ready statuses
        const [sentRes, prepRes, readyRes] = await Promise.all([
          shopFetch('/api/orders?status=sent'),
          shopFetch('/api/orders?status=preparing'),
          shopFetch('/api/orders?status=ready'),
        ])
        const [sent, prep, ready] = await Promise.all([sentRes.json(), prepRes.json(), readyRes.json()])
        const all = [...(sent.orders || []), ...(prep.orders || []), ...(ready.orders || [])] as Order[]
        // Sort oldest first
        all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        setPending(all)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 15_000) // refresh every 15s
    return () => clearInterval(t)
  }, [shopFetch])

  if (loading || pending.length === 0) return null

  const visible = expanded ? pending : pending.slice(0, 4)

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          {title}
          <Badge variant="outline" className="ml-1 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
            {pending.length}
          </Badge>
        </h3>
        {pending.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-slate-500 hover:text-slate-800 font-medium"
          >
            {expanded ? 'Show less' : `Show all ${pending.length}`}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <AnimatePresence>
          {visible.map((o) => {
            const items = o.items || []
            const total = items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.price * i.quantity, 0)
            const isReady = o.status === 'ready'
            const isPreparing = o.status === 'preparing'
            return (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card
                  onClick={() => onPickOrder(o.id)}
                  className={`cursor-pointer border-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    isReady ? 'border-emerald-300 bg-emerald-50'
                    : isPreparing ? 'border-blue-300 bg-blue-50'
                    : 'border-amber-300 bg-amber-50'
                  }`}
                >
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {o.table?.number === 0 ? 'Direct' : o.table?.name || `Table`}
                      </span>
                      <Badge variant="outline" className={`text-[9px] ${ORDER_STATUS_COLORS[o.status]}`}>
                        {isReady ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> : isPreparing ? <Flame className="w-2.5 h-2.5 mr-0.5" /> : <Clock className="w-2.5 h-2.5 mr-0.5" />}
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1">{items.length} items · {formatCurrency(total)}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{timeAgo(o.createdAt)}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
