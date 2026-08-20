import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/menu — list all menu items for the current shop
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const category = req.nextUrl.searchParams.get('category')
  const items = await db.menuItem.findMany({
    where: {
      shopId,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ items })
}

// POST /api/menu — create a menu item for the current shop
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const body = await req.json()
  const { name, category, price, cost = 0, stock = 0, unit = 'Pcs', image = null, available = true } = body
  if (!name || price == null) {
    return NextResponse.json({ error: 'name and price are required' }, { status: 400 })
  }
  const item = await db.menuItem.create({
    data: {
      shopId,
      name,
      category: category || 'General',
      price: Number(price),
      cost: Number(cost),
      stock: Number(stock),
      unit,
      image,
      available,
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}
