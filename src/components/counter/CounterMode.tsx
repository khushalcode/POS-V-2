'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Store,
  ArrowLeft,
  Printer,
  Send,
  Receipt,
  Users,
  StickyNote,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { TableGrid } from './TableGrid'
import { MenuPicker } from './MenuPicker'
import { OrderCart } from './OrderCart'
import { BillingDialog } from './BillingDialog'
import { PrintPreview } from '@/components/shared/PrintPreview'
import { KOTReceipt } from '@/components/shared/Receipts'
import { PendingOrdersSubTab } from '@/components/shared/PendingOrdersSubTab'
import { GlobalShortcutBar } from '@/components/shared/GlobalShortcutBar'
import { useRestaurantSync } from '@/hooks/use-restaurant-sync'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import {
  formatCurrency,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '@/lib/format'
import type { RestaurantTable, Order, OrderItem, MenuItem, KOTPayload, ItemStatusPayload } from '@/lib/types'

interface CounterModeProps {
  onExit: () => void
  directMode?: boolean
  currentMode?: string
  onNavigate?: (mode: any) => void
}

export default function CounterMode({ onExit, directMode, currentMode, onNavigate }: CounterModeProps) {
  const { currentShop, user } = useSession()
  const shopFetch = useShopFetch()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [guests, setGuests] = useState(1)
  const [waiterName, setWaiterName] = useState(user?.name || '')
  const [orderNotes, setOrderNotes] = useState('')
  const [showKOT, setShowKOT] = useState(false)
  const [kotNo, setKotNo] = useState(0)
  const [printedItemIds, setPrintedItemIds] = useState<Set<string>>(new Set())
  const [kotItemsToPrint, setKotItemsToPrint] = useState<OrderItem[]>([])
  const [showBilling, setShowBilling] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [billNo, setBillNo] = useState(1001)

  // When switching from Direct → Counter via shortcut bar, reset to table grid
  useEffect(() => {
    if (currentMode === 'counter' && !directMode && selectedTable) {
      setSelectedTable(null)
      setOrder(null)
      setPrintedItemIds(new Set())
      setKotItemsToPrint([])
      setKotNo(0)
      loadTables()
    }
  }, [currentMode, directMode]) // eslint-disable-line react-hooks/exhaustive-deps
  const [settings, setSettings] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  // ----- Initial loads -----
  const loadTables = useCallback(async () => {
    const res = await shopFetch('/api/tables')
    const data = await res.json()
    setTables(data.tables)
  }, [shopFetch])

  const loadMenu = useCallback(async () => {
    const res = await shopFetch('/api/menu')
    const data = await res.json()
    setMenu(data.items)
  }, [shopFetch])

  const loadBillNo = useCallback(async () => {
    const res = await shopFetch('/api/bills/next-no')
    const data = await res.json()
    setBillNo(data.nextNo)
  }, [shopFetch])

  const loadSettings = useCallback(async () => {
    try {
      const res = await shopFetch('/api/settings')
      const data = await res.json()
      setSettings(data.settings)
    } catch {
      // settings are optional; fall back to defaults
    }
  }, [shopFetch])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await shopFetch('/api/tables/seed', { method: 'POST' })
      await Promise.all([loadTables(), loadMenu(), loadBillNo(), loadSettings()])
      setLoading(false)
    })()
  }, [loadTables, loadMenu, loadBillNo, loadSettings, shopFetch, currentShop?.id])

  // ----- Auto-start direct order if directMode prop is set -----
  const [directStarted, setDirectStarted] = useState(false)
  useEffect(() => {
    if (!directMode || loading || tables.length === 0 || directStarted) return
    const directTable = tables.find((t) => t.number === 0)
    if (directTable) {
      setDirectStarted(true)
      openTable({ ...directTable, type: 'direct' } as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directMode, loading, tables.length, directStarted])

  // ----- Real-time sync -----
  const sync = useRestaurantSync('counter', {
    onItemStatus: (p: ItemStatusPayload) => {
      // Update local order if it matches
      setOrder((cur) => {
        if (!cur || cur.id !== p.orderId) return cur
        const updatedItems = (cur.items || []).map((i) =>
          i.id === p.itemId ? { ...i, status: p.status } : i
        )
        return { ...cur, items: updatedItems }
      })
      // Also update tables snapshot
      setTables((cur) =>
        cur.map((t) => {
          if (!t.currentOrder || t.currentOrder.id !== p.orderId) return t
          const updatedItems = (t.currentOrder.items || []).map((i) =>
            i.id === p.itemId ? { ...i, status: p.status } : i
          )
          return { ...t, currentOrder: { ...t.currentOrder, items: updatedItems } }
        })
      )
    },
    onOrderStatus: (p) => {
      setOrder((cur) => (cur && cur.id === p.orderId ? { ...cur, status: p.status } : cur))
    },
    onTableReleased: () => {
      // Refresh tables
      loadTables()
    },
    onDataRefresh: () => {
      loadTables()
      loadMenu()
    },
  })

  // ----- Table actions -----
  const openTable = async (t: RestaurantTable & { type?: string }) => {
    setSelectedTable(t)
    setGuests(1)
    setWaiterName('')
    setOrderNotes('')
    const isDirect = (t as any).type === 'direct' || t.number === 0
    const orderType = isDirect ? 'direct' : 'dine_in'
    if (t.currentOrder) {
      // Existing order — load it fully
      const res = await shopFetch(`/api/orders/${t.currentOrder.id}`)
      const data = await res.json()
      const existingOrder = data.order
      // ─── If the existing order is in a terminal state (paid/billed), DON'T reuse it ───
      // Create a brand-new empty order instead, so the menu + cart reset cleanly.
      // This fixes the bug where after "Confirm & Save" the old items reappear because
      // the useEffect runs before loadTables() updates the tables state.
      if (existingOrder && (existingOrder.status === 'paid' || existingOrder.status === 'billed')) {
        try {
          // Free the table first (defensive — should already be free)
          await shopFetch(`/api/orders/${existingOrder.id}/free-table`, { method: 'POST' })
        } catch (e) {
          console.warn('[openTable] free-table failed (non-fatal):', e)
        }
        // Create a fresh empty order
        try {
          const newRes = await shopFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: t.id, guests: 1, type: orderType }),
          })
          if (newRes.ok) {
            const newData = await newRes.json()
            setOrder(newData.order)
            await loadTables()
            sync.sendTableOccupied({ tableId: t.id, tableNumber: t.number, orderId: newData.order.id })
            return
          }
        } catch (e) {
          console.warn('[openTable] new order creation failed:', e)
        }
      }
      setOrder(existingOrder)
      setGuests(existingOrder?.guests || 1)
      setWaiterName(existingOrder?.waiterName || '')
      setOrderNotes(existingOrder?.notes || '')
    } else {
      // Create new open order
      try {
        const res = await shopFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: t.id, guests: 1, type: orderType }),
        })
        if (!res.ok) {
          const e = await res.json()
          toast.error(e.error || 'Could not start order')
          return
        }
        const data = await res.json()
        setOrder(data.order)
        await loadTables()
        // Notify kitchen
        sync.sendTableOccupied({ tableId: t.id, tableNumber: t.number, orderId: data.order.id })
      } catch (e) {
        toast.error('Failed to start order')
      }
    }
  }

  const closeTable = () => {
    setSelectedTable(null)
    setOrder(null)
    setPrintedItemIds(new Set())
    setKotItemsToPrint([])
    setKotNo(0)
    setShowSaveConfirm(false)
    setShowBilling(false)
    loadTables()
  }

  // ─── In direct mode, immediately start a NEW direct order after closing ───
  // The user must NEVER see the table grid in direct mode — always show menu.
  useEffect(() => {
    if (!directMode || loading || tables.length === 0) return
    if (selectedTable) return
    const directTable = tables.find((t) => t.number === 0)
    if (directTable) {
      openTable({ ...directTable, type: 'direct' } as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directMode, loading, tables.length, selectedTable])

  // ----- Item actions -----
  const addItem = async (item: MenuItem, qty: number) => {
    if (!order) return
    // If qty is negative, we're decrementing — find the matching order item
    // and either decrement its quantity or remove it entirely when qty falls to 0.
    if (qty < 0) {
      const existing = (order.items || []).find(
        (i) => i.menuItemId === item.id && i.status !== 'cancelled'
      )
      if (!existing) return // nothing to decrement
      if (existing.quantity <= 1) {
        // Remove the item entirely
        await removeItem(existing)
        return
      }
      // Decrement by 1
      await shopFetch(`/api/orders/${order.id}/items/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: existing.quantity - 1 }),
      })
      setOrder((cur) => cur ? ({
        ...cur,
        items: (cur.items || []).map((i) => i.id === existing.id ? { ...i, quantity: i.quantity - 1 } : i),
      }) : cur)
      return
    }
    const res = await shopFetch(`/api/orders/${order.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ menuItemId: item.id, quantity: qty }] }),
    })
    if (!res.ok) {
      toast.error('Could not add item')
      return
    }
    const data = await res.json()
    setOrder(data.order)
    const wasAlreadySent = order.status !== 'open'
    if (wasAlreadySent) {
      const newItems = (data.order.items || []).filter(
        (i: OrderItem) => !order.items!.some((oi) => oi.id === i.id)
      )
      const payload: KOTPayload = {
        orderId: data.order.id,
        tableNumber: order.table?.number || 0,
        tableName: order.table?.name || '',
        type: data.order.type,
        guests: data.order.guests,
        waiterName: data.order.waiterName,
        notes: data.order.notes,
        items: newItems,
        createdAt: data.order.createdAt,
        isUpdate: true,
      }
      sync.sendItemAdded(payload)
    }
    toast.success(`Added ${qty}× ${item.name}`)
  }

  const incItem = async (it: OrderItem) => {
    if (!order) return
    await shopFetch(`/api/orders/${order.id}/items/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: it.quantity + 1 }),
    })
    refreshOrder()
  }

  const decItem = async (it: OrderItem) => {
    if (!order) return
    if (it.quantity <= 1) {
      await removeItem(it)
      return
    }
    await shopFetch(`/api/orders/${order.id}/items/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: it.quantity - 1 }),
    })
    refreshOrder()
  }

  const removeItem = async (it: OrderItem) => {
    if (!order) return
    const res = await shopFetch(`/api/orders/${order.id}/items/${it.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const e = await res.json()
      toast.error(e.error || 'Cannot remove')
      return
    }
    refreshOrder()
  }

  const addNotes = async (it: OrderItem, notes: string) => {
    if (!order) return
    await shopFetch(`/api/orders/${order.id}/items/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    refreshOrder()
  }

  const refreshOrder = async () => {
    if (!order) return
    const res = await shopFetch(`/api/orders/${order.id}`)
    const data = await res.json()
    setOrder(data.order)
    await loadTables()
  }

  // ----- Order meta update -----
  const saveMeta = async () => {
    if (!order) return
    // We PATCH the order via the items endpoint pattern — but there's no direct meta route,
    // so we update via the items endpoint's response by re-fetching after a small patch.
    // Simpler: use a fetch to /api/orders/[id]/status with same status to keep meta in sync.
    // To keep it lean, we just store meta on send.
  }

  // ----- Send to kitchen (KOT) -----
  const sendToKitchen = async () => {
    if (!order) return
    setBusy(true)
    try {
      const res = await shopFetch(`/api/orders/${order.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotPrinted: true }),
      })
      if (!res.ok) {
        const e = await res.json()
        toast.error(e.error || 'Could not send')
        return
      }
      const data = await res.json()
      setOrder(data.order)

      // Determine which items to print:
      // - First print: ALL items
      // - Reprint (kotNo > 0): only NEW items (not in printedItemIds)
      const allItems = (data.order.items || []).filter((i: OrderItem) => i.status !== 'cancelled')
      const isNewPrint = kotNo === 0
      const itemsToPrint = isNewPrint
        ? allItems
        : allItems.filter((i: OrderItem) => !printedItemIds.has(i.id))

      if (itemsToPrint.length === 0 && !isNewPrint) {
        toast.info('No new items to print since last KOT')
        setBusy(false)
        return
      }

      // Track which items have been printed
      const newPrintedSet = new Set(printedItemIds)
      itemsToPrint.forEach((i: OrderItem) => newPrintedSet.add(i.id))
      setPrintedItemIds(newPrintedSet)
      setKotItemsToPrint(itemsToPrint)

      const nextKotNo = (kotNo || 0) + 1
      setKotNo(nextKotNo)
      setShowKOT(true)

      // Broadcast to kitchen — only new items on reprint
      const payload: KOTPayload = {
        orderId: data.order.id,
        tableNumber: data.order.table?.number || 0,
        tableName: data.order.table?.name || '',
        type: data.order.type,
        guests: data.order.guests,
        waiterName: data.order.waiterName,
        notes: data.order.notes,
        items: itemsToPrint,
        createdAt: data.order.createdAt,
        isUpdate: !isNewPrint,
      }
      sync.sendKOT(payload)
      await loadTables()

      if (isNewPrint) {
        toast.success('KOT sent to kitchen')
      } else {
        toast.success(`Re-printed KOT with ${itemsToPrint.length} new item(s)`)
      }
    } finally {
      setBusy(false)
    }
  }

  // ----- Save order: close it + create a bill + free the table -----
  const saveOrder = async () => {
    if (!order) return
    setBusy(true)
    try {
      const activeItems = (order.items || []).filter((i) => i.status !== 'cancelled')
      const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)
      const taxRate = (currentShop as any)?.taxRate || 5
      const taxAmount = Math.round(subtotal * taxRate) / 100
      const total = subtotal + taxAmount

      try {
        await shopFetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            subtotal,
            taxRate,
            taxAmount,
            discount: 0,
            serviceCharge: 0,
            total,
            paymentMode: 'cash',
          }),
        })
      } catch (e) {
        console.warn('[saveOrder] bill creation failed (non-fatal):', e)
      }

      await shopFetch(`/api/orders/${order.id}/free-table`, { method: 'POST' })

      sync.sendTableReleased({
        tableId: order.tableId,
        tableNumber: order.table?.number || 0,
      })
      sync.sendOrderStatus({
        orderId: order.id,
        status: 'billed',
        tableNumber: order.table?.number || 0,
      })

      toast.success('Order saved & bill created')
      closeTable()
    } catch {
      toast.error('Failed to save order')
    } finally {
      setBusy(false)
    }
  }

  // ----- Delete order with reason -----
  const deleteOrderWithReason = async () => {
    if (!order || !deleteReason.trim()) {
      toast.error('Please enter a reason for deleting this order')
      return
    }
    try {
      // Log the deletion with reason via audit endpoint
      await shopFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({
          action: 'order_deleted',
          details: {
            orderId: order.id,
            tableNumber: order.table?.number || 0,
            reason: deleteReason,
            items: (order.items || []).map((i) => `${i.quantity}× ${i.name}`),
            total: (order.items || []).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.price * i.quantity, 0),
          },
        }),
      })
    } catch {
      // audit logging is best-effort
    }

    // Delete the order
    await shopFetch(`/api/orders/${order.id}`, { method: 'DELETE' })
    toast.success(`Order deleted — Reason: ${deleteReason}`)
    setShowDeleteConfirm(false)
    setDeleteReason('')
    closeTable()
  }

  // ----- Mark an item served (after kitchen said ready) -----
  const markServed = async (it: OrderItem) => {
    if (!order) return
    await shopFetch(`/api/orders/${order.id}/items/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'served' }),
    })
    await refreshOrder()
    sync.sendItemStatus({
      orderId: order.id,
      itemId: it.id,
      status: 'served',
      tableNumber: order.table?.number || 0,
    })
  }

  // ----- Billing -----
  const openBilling = async () => {
    await loadBillNo()
    setShowBilling(true)
  }

  const confirmBill = async (payload: {
    taxRate: number
    discount: number
    serviceCharge: number
    paymentMode: any
  }) => {
    if (!order) throw new Error('No order')
    const res = await shopFetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, ...payload }),
    })
    if (!res.ok) {
      const e = await res.json()
      toast.error(e.error || 'Billing failed')
      throw e
    }
    const data = await res.json()
    sync.sendTableReleased({
      tableId: order.tableId,
      tableNumber: order.table?.number || 0,
    })
    sync.sendOrderStatus({
      orderId: order.id,
      status: 'paid',
      tableNumber: order.table?.number || 0,
    })
    await loadTables()
    toast.success(`Bill #${data.bill.billNo} generated · Table released`)
    return data.bill
  }

  // ----- Render -----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  // ----- Table list view -----
  if (!selectedTable) {
    // Filter out the virtual "Direct Counter" table (number 0) from the grid
    const visibleTables = tables.filter((t) => t.number !== 0)
    const occupiedCount = visibleTables.filter((t) => t.status === 'occupied').length
    const freeCount = visibleTables.filter((t) => t.status === 'available').length

    const startDirectOrder = async () => {
      let directTable = tables.find((t) => t.number === 0)
      if (!directTable) {
        const res = await shopFetch('/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: 0, name: 'Direct Counter', capacity: 0 }),
        })
        if (res.ok) {
          const data = await res.json()
          directTable = data.table
        }
      }
      if (directTable) {
        openTable({ ...directTable, type: 'direct' } as any)
      }
    }

    return (
      <div className="min-h-screen img-bg">
        <Header onExit={onExit} role="counter" connected={sync.connected} currentMode={currentMode} onNavigate={onNavigate} isDirect={directMode} />
        {onNavigate && currentMode && <GlobalShortcutBar currentMode={currentMode as any} onNavigate={onNavigate} />}
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tables</h1>
              <p className="text-sm text-slate-500">
                {occupiedCount} occupied · {freeCount} free
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={startDirectOrder}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white"
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                Direct Order / Takeaway
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadTables()}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Sub-tabs: Tables / Pending in Kitchen */}
          <PendingOrdersSubTab shopFetch={shopFetch} onPickOrder={(orderId) => {
            // Open the table that owns this order
            const table = tables.find((t) => t.currentOrderId === orderId)
            if (table) openTable(table as any)
          }} />

          <TableGrid tables={visibleTables} onSelectTable={openTable} />
        </main>
      </div>
    )
  }

  // ----- Order detail view -----
  const canEdit = order?.status === 'open'
  const canSend = order && (order.status === 'open' || order.status === 'sent') && (order.items || []).length > 0
  // Allow billing as soon as there's at least one non-cancelled item — even before KOT is sent
  const canBill = order && ['open', 'sent', 'preparing', 'ready', 'served', 'billed'].includes(order.status) &&
    (order.items || []).some((i) => i.status !== 'cancelled')

  // ─── Shared "Current Order" panel content ───
  // Rendered twice: as a fixed bottom sheet on mobile/tablet, and as a
  // sticky sidebar to the right of the menu on large screens (lg+).
  const renderOrderPanel = (desktop: boolean) => (
    <div className={desktop ? 'flex flex-col h-full min-h-0 p-3 sm:p-4' : 'flex flex-col flex-1 min-h-0'}>
      {/* Header row — title + order meta */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Receipt className="w-4 h-4 text-slate-700 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 truncate">Current Order</h3>
          {order && (
            <>
              <Badge variant="outline" className={`text-[9px] shrink-0 ${ORDER_STATUS_COLORS[order.status]}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
              <span className="text-[11px] text-slate-500 shrink-0">
                {order.table?.number === 0 ? 'Direct' : `Table ${order.table?.number}`} · {(order.items || []).filter((i) => i.status !== 'cancelled').length} items
              </span>
            </>
          )}
        </div>
      </div>

      {/* Quick meta inputs */}
      <div className={`flex items-center gap-1.5 shrink-0 mb-2 ${desktop ? 'flex-wrap' : ''}`}>
        <Input
          type="number"
          min={1}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value) || 1)}
          disabled={!canEdit}
          className={desktop ? 'h-8 w-16 text-xs px-2' : 'h-7 w-12 text-[11px] px-1'}
          title="Guests"
        />
        <Input
          value={waiterName}
          onChange={(e) => setWaiterName(e.target.value)}
          disabled={!canEdit}
          placeholder="Waiter"
          className={desktop ? 'h-8 flex-1 min-w-0 text-xs px-2' : 'h-7 w-20 text-[11px] px-2'}
        />
      </div>

      {/* Cart — always scrolls internally within whatever space is left; header/footer/buttons never move */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 thin-scrollbar">
        {order ? (
          <OrderCart
            order={order}
            onInc={incItem}
            onDec={decItem}
            onRemove={removeItem}
            onAddNotes={addNotes}
            onAddCustomItem={addItem}
            canEdit={canEdit}
          />
        ) : (
          <div className="py-4 text-center text-xs text-slate-400">No active order — start one by adding items from the menu.</div>
        )}
      </div>

      {/* Order notes (compact) */}
      {order && (
        <div className="mt-2 shrink-0">
          <Input
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            disabled={!canEdit}
            placeholder="Order notes (optional)…"
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* Action buttons — always visible */}
      <div className="grid grid-cols-3 gap-2 mt-2 shrink-0">
        <Button
          onClick={() => setShowSaveConfirm(true)}
          disabled={!order || (order.items || []).length === 0 || busy}
          className="bg-blue-600 hover:bg-blue-700 text-white h-11 shadow-lg"
        >
          <Save className="w-4 h-4 mr-1.5" /> Save
        </Button>
        <Button
          onClick={sendToKitchen}
          disabled={!canSend || busy}
          className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white h-11 shadow-lg"
        >
          <Send className="w-4 h-4 mr-1.5" />
          {order?.status === 'open' ? 'Send KOT' : 'Re-print'}
        </Button>
        <Button
          onClick={openBilling}
          disabled={!canBill}
          className="bg-slate-900 hover:bg-slate-800 text-white h-11 shadow-lg"
        >
          <Receipt className="w-4 h-4 mr-1.5" /> Bill
        </Button>
      </div>

      {/* Delete + served actions row */}
      {order && (order.items || []).length > 0 && (
        <div className="flex gap-2 mt-1.5 shrink-0">
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            className="flex-1 text-rose-600 border-rose-300 hover:bg-rose-50 h-8"
            size="sm"
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete Order
          </Button>
          {(order.items || []).some((i) => i.status === 'ready') && (
            <Button
              onClick={() => {
                const ready = (order.items || []).find((i) => i.status === 'ready')
                if (ready) markServed(ready)
              }}
              variant="outline"
              className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
              size="sm"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Served
            </Button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-dvh img-bg flex flex-col overflow-hidden">
      <div className="shrink-0">
        <Header
          onExit={directMode ? onExit : closeTable}
          role="counter"
          connected={sync.connected}
          backLabel={directMode ? 'Exit' : 'Back to tables'}
          currentMode={currentMode}
          onNavigate={onNavigate}
          isDirect={directMode}
        />
        {onNavigate && currentMode && <GlobalShortcutBar currentMode={currentMode as any} onNavigate={onNavigate} />}
      </div>

      {/* Main content fills the remaining viewport height — this level never scrolls; */}
      {/* only the menu list and the order item list scroll inside their own boxes. */}
      <main className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 overflow-hidden">
        {/* On lg+ screens: Menu on the left, Current Order sidebar on the right. */}
        {/* On smaller screens: Menu fills the space above the always-visible order bar (below). */}
        <div className="flex flex-col h-full min-h-0 lg:grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] lg:grid-rows-[minmax(0,1fr)] lg:gap-4">
          {/* Menu picker */}
          <div className="flex flex-col flex-1 min-h-0 lg:h-full bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 p-4 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="font-bold text-slate-900">Menu</h2>
              <Badge variant="outline" className="text-[10px]">
                {menu.filter((m) => m.available).length} items
              </Badge>
            </div>
            <div className="flex-1 min-h-0">
              <MenuPicker
                items={menu}
                onAdd={addItem}
                orderItems={order?.items}
                disabled={!canEdit && order?.status !== 'open' && !['sent', 'preparing', 'ready'].includes(order?.status || '')}
              />
            </div>
          </div>

          {/* Current Order — right of the menu (desktop / large tablets only), stretches to full height with its own internal scroll */}
          <div className="hidden lg:flex lg:flex-col lg:h-full bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {renderOrderPanel(true)}
          </div>
        </div>
      </main>

      {/* ─── Bottom order bar (mobile & tablet only) ─── */}
      {/* Always docked at the bottom of the screen — never covered, never needs page scroll to reach. */}
      {/* Its own item list scrolls internally; header, subtotal & the 3 action buttons never move. */}
      {/* Hidden on lg+ where the sidebar above takes over. */}
      <div className="shrink-0 lg:hidden max-h-[65vh] flex flex-col bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 w-full flex flex-col flex-1 min-h-0">
          {renderOrderPanel(false)}
        </div>
      </div>

      {/* KOT print preview — single copy (Kitchen Copy only) */}
      <PrintPreview
        open={showKOT}
        onClose={() => setShowKOT(false)}
        title={`KOT ${kotNo > 1 ? `(Reprint #${kotNo})` : ''} — ${order?.table?.number === 0 ? 'Direct Order' : 'Table ' + order?.table?.number}`}
        subtitle={kotNo > 1 ? 'Only NEW items since last print' : 'Kitchen copy'}
        copies={[
          { label: 'Kitchen Copy', banner: '*** KITCHEN COPY ***' },
        ]}
      >
        {order && (
          <KOTReceipt
            order={{ ...order, items: kotItemsToPrint }}
            kotNo={kotNo}
            style={settings}
          />
        )}
      </PrintPreview>

      {/* Billing dialog */}
      <BillingDialog
        open={showBilling}
        order={order}
        billNo={billNo}
        settings={settings}
        onClose={() => setShowBilling(false)}
        onConfirm={confirmBill}
        onAfterBill={() => {
          // Fires only once the cashier closes the print preview — exit the table now
          closeTable()
        }}
      />



      {/* ─── Save Confirmation dialog — shows order details before saving ─── */}
      {showSaveConfirm && order && (() => {
        const activeItems = (order.items || []).filter((i) => i.status !== 'cancelled')
        const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)
        const taxRate = (currentShop as any)?.taxRate || 5
        const taxAmount = Math.round(subtotal * taxRate) / 100
        const total = subtotal + taxAmount
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSaveConfirm(false)}>
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Save className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Confirm & Save Order</h3>
                  <p className="text-xs text-slate-500">
                    {order.table?.number === 0 ? 'Direct Order' : `Table ${order.table?.number}`} · {activeItems.length} items
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 mb-3 max-h-[40vh] overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Order Items</p>
                {activeItems.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">No items in order</p>
                ) : (
                  <div className="space-y-1.5">
                    {activeItems.map((it) => (
                      <div key={it.id} className="flex items-start justify-between text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{it.quantity}× {it.name}</p>
                          {it.notes && <p className="text-[10px] text-slate-400 italic truncate">↳ {it.notes}</p>}
                        </div>
                        <p className="font-semibold text-slate-700 ml-2 shrink-0">{formatCurrency(it.price * it.quantity)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({taxRate}%)</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="font-bold text-blue-600 text-base">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSaveConfirm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setShowSaveConfirm(false)
                    await saveOrder()
                  }}
                  disabled={busy}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {busy ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm & Save</>}
                </Button>
              </div>
            </motion.div>
          </div>
        )
      })()}

      {/* Delete order confirmation with reason */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Order?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-3 text-xs space-y-0.5">
              <p className="font-semibold text-slate-700">
                {order?.table?.number === 0 ? 'Direct Order' : `Table ${order?.table?.number}`}
              </p>
              <p className="text-slate-500">{(order?.items || []).length} items · ₹{(order?.items || []).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}</p>
            </div>
            <div className="space-y-1.5 mb-4">
              <Label className="text-xs font-semibold text-slate-700">Reason for deletion *</Label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Customer cancelled, wrong order, duplicate…"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteReason('') }} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={deleteOrderWithReason}
                disabled={!deleteReason.trim()}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function Header({
  onExit,
  role,
  connected,
  backLabel = 'Exit',
  currentMode,
  onNavigate,
  isDirect = false,
}: {
  onExit: () => void
  role: 'counter' | 'kitchen' | 'history'
  connected: boolean
  backLabel?: string
  currentMode?: string
  onNavigate?: (mode: any) => void
  isDirect?: boolean
}) {
  const { currentShop, user, shops, selectShop, logout } = useSession()
  const labels = {
    counter: { title: 'Counter Mode', color: 'bg-brand-gradient', icon: Store },
    kitchen: { title: 'Kitchen Mode', color: 'bg-brand-gradient', icon: Store },
    history: { title: 'Bills & History', color: 'bg-brand-gradient', icon: Store },
  }
  const l = labels[role]
  const displayTitle = isDirect ? 'Direct Order' : l.title
  const DisplayIcon = isDirect ? Zap : l.icon
  return (
    <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onExit} className="shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">{backLabel}</span>
          </Button>
          <div className="hidden md:block w-px h-6 bg-slate-200" />
          <div className={`hidden md:flex w-9 h-9 rounded-xl ${l.color} items-center justify-center`}>
            <DisplayIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 hidden md:block">
            <h2 className="text-sm font-bold text-slate-900 truncate">{displayTitle}</h2>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              {connected ? '● Live' : '○ Reconnecting'}
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
              className="text-[11px] font-semibold bg-brand-soft text-brand-text border border-brand/20 rounded-lg px-2 py-1 cursor-pointer hover:opacity-90 max-w-[120px] sm:max-w-[180px] truncate"
              title="Switch shop"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
            {user?.name}
          </Badge>
          <Button variant="ghost" size="sm" onClick={logout} className="text-xs h-8 px-2">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
