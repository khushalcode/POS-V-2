import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

/** Default categories seeded for a shop on first access. */
const DEFAULT_CATEGORIES: { name: string; color: string; sortOrder: number }[] = [
  { name: 'Starters',     color: 'amber',   sortOrder: 0 },
  { name: 'Main Course',  color: 'rose',    sortOrder: 1 },
  { name: 'Breads',       color: 'orange',  sortOrder: 2 },
  { name: 'Beverages',    color: 'sky',     sortOrder: 3 },
  { name: 'Desserts',     color: 'violet',  sortOrder: 4 },
  { name: 'General',      color: 'slate',   sortOrder: 5 },
]

// GET /api/menu-categories — list all categories for the current shop.
// If the shop has no categories yet, seeds the defaults on first call.
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  let cats = await db.menuCategory.findMany({
    where: { shopId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  // First-run seeding: if a shop has no categories, insert the defaults
  // so the management UI has something to show/edit.
  if (cats.length === 0) {
    await db.menuCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ ...c, shopId })),
    })
    cats = await db.menuCategory.findMany({
      where: { shopId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  return NextResponse.json({ categories: cats })
}

// POST /api/menu-categories — create a new category for the current shop.
// Body: { name: string, color?: string, sortOrder?: number }
export async function POST(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const body = await req.json()
  const name = (body?.name || '').toString().trim()
  if (!name) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
  }

  // Reject duplicates (case-insensitive) to keep the dropdown clean.
  const existing = await db.menuCategory.findFirst({
    where: { shopId, name: { equals: name } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
  }

  // If sortOrder not provided, place at the end.
  const sortOrder =
    typeof body.sortOrder === 'number' ? body.sortOrder : await db.menuCategory.count({ where: { shopId } })

  const cat = await db.menuCategory.create({
    data: {
      shopId,
      name,
      color: (body?.color || 'slate').toString(),
      sortOrder,
    },
  })

  return NextResponse.json({ category: cat }, { status: 201 })
}
