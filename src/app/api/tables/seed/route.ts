import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// POST /api/tables/seed — seed N default tables for the current shop if none exist
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const existing = await db.restaurantTable.count({ where: { shopId } })
  if (existing > 0) {
    const tables = await db.restaurantTable.findMany({ where: { shopId }, orderBy: { number: 'asc' } })
    return NextResponse.json({ seeded: false, count: existing, tables })
  }
  const created = []
  // Virtual Direct Counter table (number 0)
  created.push(
    db.restaurantTable.create({
      data: { shopId, number: 0, name: 'Direct Counter', capacity: 0 },
    })
  )
  for (let i = 1; i <= 10; i++) {
    created.push(
      db.restaurantTable.create({
        data: { shopId, number: i, name: `Table ${i}`, capacity: 4 },
      })
    )
  }
  const tables = await Promise.all(created)
  return NextResponse.json({ seeded: true, count: tables.length, tables })
}
