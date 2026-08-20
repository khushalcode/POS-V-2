'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChefHat,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Flame,
  Utensils,
  Bell,
  Volume2,
  VolumeX,
  Loader2,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRestaurantSync } from '@/hooks/use-restaurant-sync'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import { formatTime, timeAgo, ITEM_STATUS_LABELS, ITEM_STATUS_COLORS } from '@/lib/format'
import type { Order, OrderItem, KOTPayload, ItemStatusPayload } from '@/lib/types'
import { GlobalShortcutBar } from '@/components/shared/GlobalShortcutBar'

interface KitchenModeProps {
  onExit: () => void
  currentMode?: string
  onNavigate?: (mode: any) => void
}

interface KitchenTicket {
  orderId: string
  tableNumber: number
  tableName: string
  type: 'dine_in' | 'takeaway' | 'direct'
  guests: number
  waiterName?: string | null
  notes?: string | null
  items: OrderItem[]
  createdAt: string
  // Track which items are NEW since last view (for visual pulse)
  newItemIds: Set<string>
}

export default function KitchenMode({ onExit, currentMode, onNavigate }: KitchenModeProps) {
  const { currentShop, user, shops, selectShop, logout } = useSession()
  const shopFetch = useShopFetch()
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [now, setNow] = useState(Date.now())

  // Tick every 30s to refresh "time ago" labels
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // ----- Initial load: fetch all in-progress orders -----
  const loadActiveOrders = useCallback(async () => {
    try {
      const res = await shopFetch('/api/orders?status=sent')
      const sent = await res.json()
      const res2 = await shopFetch('/api/orders?status=preparing')
      const prep = await res2.json()
      const res3 = await shopFetch('/api/orders?status=ready')
      const ready = await res3.json()
      const all = [...sent.orders, ...prep.orders, ...ready.orders] as Order[]
      setTickets(
        all.map((o) => ({
          orderId: o.id,
          tableNumber: o.table?.number || 0,
          tableName: o.table?.name || '',
          type: o.type,
          guests: o.guests,
          waiterName: o.waiterName,
          notes: o.notes,
          items: (o.items || []).filter((i) => i.status !== 'cancelled' && i.status !== 'served'),
          createdAt: o.createdAt,
          newItemIds: new Set<string>(),
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActiveOrders()
  }, [loadActiveOrders])

  // ----- Real-time sync -----
  const sync = useRestaurantSync('kitchen', {
    onKOTNew: (p: KOTPayload) => {
      setTickets((cur) => {
        // Avoid duplicates
        if (cur.some((t) => t.orderId === p.orderId)) return cur
        const newTicket: KitchenTicket = {
          orderId: p.orderId,
          tableNumber: p.tableNumber,
          tableName: p.tableName,
          type: p.type,
          guests: p.guests,
          waiterName: p.waiterName,
          notes: p.notes,
          items: p.items.filter((i) => i.status !== 'cancelled' && i.status !== 'served'),
          createdAt: p.createdAt,
          newItemIds: new Set(p.items.map((i) => i.id)),
        }
        if (soundOn) playBeep()
        toast.success(`New KOT — Table ${p.tableNumber}`)
        return [newTicket, ...cur]
      })
    },
    onKOTItemAdded: (p: KOTPayload) => {
      setTickets((cur) =>
        cur.map((t) => {
          if (t.orderId !== p.orderId) return t
          const existingIds = new Set(t.items.map((i) => i.id))
          const additions = p.items.filter((i) => !existingIds.has(i.id) && i.status !== 'cancelled')
          if (additions.length === 0) return t
          const newSet = new Set(t.newItemIds)
          additions.forEach((a) => newSet.add(a.id))
          return { ...t, items: [...t.items, ...additions], newItemIds: newSet }
        })
      )
      if (soundOn) playBeep()
      toast.info(`Items added to Table ${p.tableNumber}`)
    },
    onItemStatus: (p: ItemStatusPayload) => {
      setTickets((cur) =>
        cur.map((t) => {
          if (t.orderId !== p.orderId) return t
          const items = t.items.map((i) => (i.id === p.itemId ? { ...i, status: p.status } : i))
          // If item was served or cancelled, remove it from kitchen view
          const visible = items.filter((i) => i.status !== 'served' && i.status !== 'cancelled')
          return { ...t, items: visible }
        })
      )
    },
    onOrderStatus: (p) => {
      if (p.status === 'paid' || p.status === 'billed') {
        setTickets((cur) => cur.filter((t) => t.orderId !== p.orderId))
        toast.info(`Table ${p.tableNumber} cleared`)
      }
    },
    onTableReleased: (p) => {
      setTickets((cur) => cur.filter((t) => t.orderId !== p.orderId))
    },
  })

  // ----- Item status actions -----
  const setItemStatus = async (ticket: KitchenTicket, item: OrderItem, status: 'preparing' | 'ready') => {
    // Optimistic
    setTickets((cur) =>
      cur.map((t) =>
        t.orderId === ticket.orderId
          ? { ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, status } : i)) }
          : t
      )
    )
    await shopFetch(`/api/orders/${ticket.orderId}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    sync.sendItemStatus({
      orderId: ticket.orderId,
      itemId: item.id,
      status,
      tableNumber: ticket.tableNumber,
    })
    if (status === 'ready') {
      toast.success(`${item.name} ready for Table ${ticket.tableNumber}`)
    }
  }

  const markAllReady = async (ticket: KitchenTicket) => {
    await Promise.all(
      ticket.items
        .filter((i) => i.status === 'pending' || i.status === 'preparing')
        .map((i) => setItemStatus(ticket, i, 'ready'))
    )
  }

  // ----- Layout -----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  const pendingCount = tickets.reduce(
    (s, t) => s + t.items.filter((i) => i.status === 'pending').length,
    0
  )
  const preparingCount = tickets.reduce(
    (s, t) => s + t.items.filter((i) => i.status === 'preparing').length,
    0
  )
  const readyCount = tickets.reduce(
    (s, t) => s + t.items.filter((i) => i.status === 'ready').length,
    0
  )

  return (
    <div className="min-h-screen img-bg text-white">
      <header className="sticky top-0 z-30 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={onExit} className="text-slate-300 hover:text-white shrink-0">
              <ArrowLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Exit</span>
            </Button>
            <div className="hidden sm:block w-px h-6 bg-slate-700" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lg shrink-0">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">Kitchen Display</h2>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                {sync.connected ? '● Live' : '○ Reconnecting'}
                {currentShop && <span className="hidden sm:inline">· {currentShop.name}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Shop switcher (compact) */}
            {shops.length > 1 && (
              <select
                value={currentShop?.id || ''}
                onChange={(e) => {
                  const next = shops.find((s) => s.id === e.target.value)
                  if (next) selectShop(next)
                }}
                className="text-[11px] font-semibold bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-700 max-w-[120px] sm:max-w-[180px] truncate"
                title="Switch shop"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <Stat label="Pending" value={pendingCount} color="bg-slate-700" />
            <Stat label="Cooking" value={preparingCount} color="bg-blue-500" />
            <Stat label="Ready" value={readyCount} color="bg-emerald-500" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSoundOn((s) => !s)}
              className="text-slate-300 hover:text-white"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-300 hover:text-white text-xs h-8 px-2">
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      {onNavigate && currentMode && <GlobalShortcutBar currentMode={currentMode as any} onNavigate={onNavigate} />}

      <main className="max-w-[1800px] mx-auto px-4 md:px-6 py-5">
        {tickets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {tickets
                .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
                .map((t) => (
                  <KitchenCard
                    key={t.orderId}
                    ticket={t}
                    onStatus={setItemStatus}
                    onAllReady={markAllReady}
                    now={now}
                  />
                ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-lg">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <Utensils className="w-10 h-10 text-slate-600" />
      </div>
      <h3 className="text-xl font-semibold mb-1">No active orders</h3>
      <p className="text-sm text-slate-500">New KOTs from the counter will appear here instantly.</p>
    </div>
  )
}

function KitchenCard({
  ticket,
  onStatus,
  onAllReady,
  now,
}: {
  ticket: KitchenTicket
  onStatus: (t: KitchenTicket, i: OrderItem, s: 'preparing' | 'ready') => void
  onAllReady: (t: KitchenTicket) => void
  now: number
}) {
  const ageMin = Math.floor((now - +new Date(ticket.createdAt)) / 60_000)
  const isOld = ageMin >= 10
  const allReady = ticket.items.length > 0 && ticket.items.every((i) => i.status === 'ready')

  const cardBorder = allReady
    ? 'border-emerald-500 shadow-emerald-500/20'
    : isOld
    ? 'border-rose-500 shadow-rose-500/20'
    : 'border-slate-700'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -12 }}
      transition={{ duration: 0.25 }}
    >
      <Card className={`bg-slate-800 border-2 ${cardBorder} shadow-xl overflow-hidden`}>
        {/* Card header */}
        <div
          className={`px-4 py-3 flex items-center justify-between ${
            allReady ? 'bg-emerald-600' : isOld ? 'bg-rose-600' : 'bg-slate-950/60'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">Table {ticket.tableNumber}</h3>
              <Badge variant="outline" className="text-[9px] bg-white/10 border-white/20 text-white uppercase">
                {ticket.type}
              </Badge>
            </div>
            <p className="text-[10px] text-white/70">
              {ticket.guests} guests · {ticket.waiterName ? `Waiter: ${ticket.waiterName}` : '—'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/70">{formatTime(ticket.createdAt)}</div>
            <div className={`text-sm font-bold ${isOld ? 'text-rose-200' : 'text-white'}`}>
              {ageMin}m {ageMin >= 10 && '⚠'}
            </div>
          </div>
        </div>

        {/* Notes banner */}
        {ticket.notes && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs">
            <span className="font-semibold">📝 Note:</span> {ticket.notes}
          </div>
        )}

        {/* Items */}
        <div className="divide-y divide-slate-700">
          {ticket.items.map((it, idx) => (
            <KitchenItem
              key={it.id || `item-${idx}`}
              item={it}
              isNew={ticket.newItemIds.has(it.id)}
              onStatus={(s) => onStatus(ticket, it, s)}
            />
          ))}
        </div>

        {/* Footer action */}
        <div className="p-3 bg-slate-950/40">
          {allReady ? (
            <div className="flex items-center justify-center gap-2 text-emerald-300 text-sm font-semibold py-1">
              <CheckCircle2 className="w-4 h-4" /> All items ready — waiting for counter pickup
            </div>
          ) : (
            <Button
              onClick={() => onAllReady(ticket)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark All Ready
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

function KitchenItem({
  item,
  isNew,
  onStatus,
}: {
  item: OrderItem
  isNew: boolean
  onStatus: (s: 'preparing' | 'ready') => void
}) {
  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, x: 20, backgroundColor: 'rgba(16,185,129,0.3)' } : false}
      animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.6 }}
      className="px-4 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">{item.quantity}×</span>
            <h4 className="font-semibold text-white">{item.name}</h4>
          </div>
          {item.notes && (
            <p className="text-[11px] text-amber-300 mt-0.5 italic">↳ {item.notes}</p>
          )}
          <div className="mt-1.5">
            <Badge variant="outline" className={`text-[10px] ${kitchenStatusColor(item.status)}`}>
              {ITEM_STATUS_LABELS[item.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <button
          onClick={() => onStatus('preparing')}
          disabled={item.status === 'preparing'}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            item.status === 'preparing'
              ? 'bg-blue-500 text-white cursor-default'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          } ${item.status === 'ready' ? 'opacity-50' : ''}`}
        >
          <Flame className="w-3.5 h-3.5" /> Cooking
        </button>
        <button
          onClick={() => onStatus('ready')}
          disabled={item.status === 'ready'}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            item.status === 'ready'
              ? 'bg-emerald-500 text-white cursor-default'
              : 'bg-slate-700 text-slate-200 hover:bg-emerald-600'
          }`}
        >
          <Bell className="w-3.5 h-3.5" /> Ready
        </button>
      </div>
    </motion.div>
  )
}

function kitchenStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-200 border-slate-600',
    preparing: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    served: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  }
  return map[status] || ''
}

// Web Audio beep for new KOT (no external file needed)
let audioCtx: AudioContext | null = null
function playBeep() {
  try {
    if (!audioCtx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      audioCtx = new Ctx()
    }
    const ctx = audioCtx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch (e) {
    // ignore
  }
}
