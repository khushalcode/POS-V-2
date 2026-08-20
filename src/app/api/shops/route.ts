import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/shops — list all active shops (for super admin / shop picker)
export async function GET() {
  const shops = await db.shop.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      address: true,
      phone: true,
      gstin: true,
      taxRate: true,
      serviceRate: true,
      currency: true,
    },
  })
  return NextResponse.json({ shops })
}
