import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/orders/[id]/items — add one or more items to an order
// Body: { items: [{ menuItemId, quantity, notes? }] }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const { items } = body as { items: Array<{ menuItemId: string; quantity: number; notes?: string }> }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items[] required' }, { status: 400 })
  }

  const order = await db.order.findUnique({ where: { id }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status === 'paid' || order.status === 'billed') {
    return NextResponse.json({ error: 'Cannot add items to a billed/paid order' }, { status: 400 })
  }

  const createdItems = []
  for (const it of items) {
    const menu = await db.menuItem.findUnique({ where: { id: it.menuItemId } })
    if (!menu) continue
    const qty = Number(it.quantity) || 1

    // If there's already a pending item with the same menu id on this order, just bump quantity
    const existing = order.items.find(
      (oi) => oi.menuItemId === menu.id && oi.status === 'pending' && (oi.notes || '') === (it.notes || '')
    )
    if (existing) {
      const updated = await db.orderItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      })
      createdItems.push(updated)
    } else {
      const created = await db.orderItem.create({
        data: {
          orderId: id,
          menuItemId: menu.id,
          name: menu.name,
          price: menu.price,
          quantity: qty,
          notes: it.notes,
          status: 'pending',
        },
      })
      createdItems.push(created)
    }
  }

  const updated = await db.order.findUnique({
    where: { id },
    include: { items: true, table: true },
  })

  return NextResponse.json({ order: updated, added: createdItems }, { status: 201 })
}
