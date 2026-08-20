import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/orders/[id]/send
// Mark the order as "sent" so the kitchen sees it as a KOT.
// Also marks kotPrinted=true (counter just printed it).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const order = await db.order.findUnique({ where: { id }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.items.length === 0) {
    return NextResponse.json({ error: 'Cannot send an empty order' }, { status: 400 })
  }

  const updated = await db.order.update({
    where: { id },
    data: {
      status: order.status === 'open' ? 'sent' : order.status,
      kotPrinted: body.kotPrinted !== false,
    },
    include: { items: true, table: true },
  })

  return NextResponse.json({ order: updated })
}
