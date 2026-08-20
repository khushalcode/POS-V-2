import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const where: any = { shopId }
  if (from || to) {
    where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
  }
  const items = await db.moneyIn.findMany({ where, orderBy: { date: 'desc' } })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.amount || !b.source) return NextResponse.json({ error: 'amount and source required' }, { status: 400 })
  const item = await db.moneyIn.create({
    data: {
      shopId, amount: Number(b.amount), source: b.source,
      description: b.description || null, partyName: b.partyName || null,
      paymentMode: b.paymentMode || 'cash', date: b.date ? new Date(b.date) : new Date(),
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.moneyIn.deleteMany({ where: { id, shopId } })
  return NextResponse.json({ ok: true })
}
