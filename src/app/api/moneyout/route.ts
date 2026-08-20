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
  const items = await db.moneyOut.findMany({ where, orderBy: { date: 'desc' } })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.amount || !b.purpose) return NextResponse.json({ error: 'amount and purpose required' }, { status: 400 })
  const item = await db.moneyOut.create({
    data: {
      shopId, amount: Number(b.amount), purpose: b.purpose,
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
  await db.moneyOut.deleteMany({ where: { id, shopId } })
  return NextResponse.json({ ok: true })
}
