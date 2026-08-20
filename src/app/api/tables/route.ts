import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/tables — list all tables for the current shop
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const tables = await db.restaurantTable.findMany({
    where: { shopId },
    orderBy: { number: 'asc' },
    include: {
      currentOrder: {
        include: { items: true },
      },
    },
  })
  return NextResponse.json({ tables })
}

// POST /api/tables — create a new table for the current shop
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const body = await req.json()
  const { number, name, capacity } = body
  if (number == null) {
    return NextResponse.json({ error: 'number is required' }, { status: 400 })
  }
  const table = await db.restaurantTable.create({
    data: {
      shopId,
      number: Number(number),
      name: name || `Table ${number}`,
      capacity: capacity ? Number(capacity) : 4,
    },
  })
  return NextResponse.json({ table }, { status: 201 })
}
