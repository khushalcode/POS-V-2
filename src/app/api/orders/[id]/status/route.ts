import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/orders/[id]/status — bulk status update on the order
// Body: { status: 'open'|'sent'|'preparing'|'ready'|'served'|'billed'|'paid' }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const { status } = body
  const allowed = ['open', 'sent', 'preparing', 'ready', 'served', 'billed', 'paid']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.order.update({
    where: { id },
    data: { status },
    include: { items: true, table: true, bill: true },
  })

  return NextResponse.json({ order: updated })
}
