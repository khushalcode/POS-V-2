import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

// PATCH /api/orders/[id]/items/[itemId]
// Body: { status?: 'pending'|'preparing'|'ready'|'served'|'cancelled', quantity?: number, notes?: string }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params
  const body = await req.json()
  const item = await db.orderItem.findFirst({ where: { id: itemId, orderId: id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const updated = await db.orderItem.update({
    where: { id: itemId },
    data: {
      ...(body.status != null && { status: body.status }),
      ...(body.quantity != null && { quantity: Number(body.quantity) }),
      ...(body.notes != null && { notes: body.notes }),
    },
  })

  // If status changed, also re-evaluate the parent order status
  if (body.status != null) {
    const allItems = await db.orderItem.findMany({ where: { orderId: id } })
    const active = allItems.filter((i) => i.status !== 'cancelled')
    const allReady = active.length > 0 && active.every((i) => i.status === 'ready' || i.status === 'served')
    const allServed = active.length > 0 && active.every((i) => i.status === 'served')
    const anyPreparing = active.some((i) => i.status === 'preparing')

    const order = await db.order.findUnique({ where: { id } })
    if (order && order.status !== 'paid' && order.status !== 'billed') {
      let nextStatus = order.status
      if (allServed) nextStatus = 'served'
      else if (allReady) nextStatus = 'ready'
      else if (anyPreparing) nextStatus = 'preparing'
      else if (order.status === 'ready' || order.status === 'served') {
        // someone regressed an item, fall back
        nextStatus = 'sent'
      }
      if (nextStatus !== order.status) {
        await db.order.update({ where: { id }, data: { status: nextStatus } })
      }
    }
  }

  const refreshedOrder = await db.order.findUnique({
    where: { id },
    include: { items: true, table: true },
  })
  return NextResponse.json({ item: updated, order: refreshedOrder })
}

// DELETE /api/orders/[id]/items/[itemId]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params
  const item = await db.orderItem.findFirst({ where: { id: itemId, orderId: id } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Only allow delete if pending
  if (item.status !== 'pending') {
    return NextResponse.json({ error: 'Cannot delete an item already in preparation' }, { status: 400 })
  }
  await db.orderItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
