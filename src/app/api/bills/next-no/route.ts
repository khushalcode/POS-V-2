import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/bills/next-no — get the next bill number for the current shop
export async function GET(req: Request) {
  const shopId = getShopId(req as any)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const last = await db.bill.findFirst({ where: { shopId }, orderBy: { billNo: 'desc' } })
  const nextNo = last ? last.billNo + 1 : 1001
  return NextResponse.json({ nextNo })
}
