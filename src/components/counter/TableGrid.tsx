'use client'

import { motion } from 'framer-motion'
import { Users, Clock, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, timeAgo, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/format'
import type { RestaurantTable, Order } from '@/lib/types'

interface TableGridProps {
  tables: RestaurantTable[]
  onSelectTable: (table: RestaurantTable) => void
}

export function TableGrid({ tables, onSelectTable }: TableGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {tables.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.02 }}
        >
          <Card
            onClick={() => onSelectTable(t)}
            className={`cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg border-2 backdrop-blur-md ${
              t.status === 'occupied'
                ? 'bg-orange-50/70 border-orange-200/60 hover:border-orange-300'
                : 'bg-white/70 border-emerald-200/60 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
                  t.status === 'occupied'
                    ? 'bg-orange-500 text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {t.number}
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  t.status === 'occupied'
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
              >
                {t.status === 'occupied' ? 'OCCUPIED' : 'FREE'}
              </Badge>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm mb-1">{t.name}</h3>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-2">
              <Users className="w-3 h-3" /> {t.capacity} seats
            </div>

            {t.status === 'occupied' && t.currentOrder && (
              <div className="space-y-1.5 pt-2 border-t border-orange-200/70">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" /> {timeAgo(t.currentOrder.createdAt)}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {t.currentOrder.items?.length || 0} items
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(orderTotal(t.currentOrder))}
                  </span>
                </div>
                {t.currentOrder.status !== 'open' && t.currentOrder.status !== 'paid' && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 ${ORDER_STATUS_COLORS[t.currentOrder.status]}`}
                  >
                    {ORDER_STATUS_LABELS[t.currentOrder.status]}
                  </Badge>
                )}
              </div>
            )}

            {t.status === 'available' && (
              <div className="pt-2 border-t border-emerald-200/70">
                <p className="text-[11px] text-emerald-700 font-medium">Tap to start order</p>
              </div>
            )}

            <div className="flex items-center justify-end mt-2 text-[10px] text-slate-400">
              Open <ArrowRight className="w-3 h-3 ml-0.5" />
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function orderTotal(o: Order): number {
  if (!o.items) return 0
  return o.items
    .filter((i) => i.status !== 'cancelled')
    .reduce((s, i) => s + i.price * i.quantity, 0)
}
