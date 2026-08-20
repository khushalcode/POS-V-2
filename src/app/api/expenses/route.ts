import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  const category = req.nextUrl.searchParams.get('category')
  const where: any = { shopId }
  if (from || to) {
    where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
  }
  if (category) where.category = category
  const expenses = await db.expense.findMany({ where, orderBy: { date: 'desc' } })
  return NextResponse.json({ expenses })
}

export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const b = await req.json()
  if (!b.category || !b.amount) return NextResponse.json({ error: 'category and amount required' }, { status: 400 })
  const e = await db.expense.create({
    data: {
      shopId,
      category: b.category,
      description: b.description || '',
      amount: Number(b.amount),
      paymentMode: b.paymentMode || 'cash',
      date: b.date ? new Date(b.date) : new Date(),
    },
  })
  return NextResponse.json({ expense: e }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.expense.deleteMany({ where: { id, shopId } })
  return NextResponse.json({ ok: true })
}
