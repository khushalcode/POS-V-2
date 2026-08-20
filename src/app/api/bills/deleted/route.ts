import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getShopId } from '@/lib/shop-context'

// GET /api/bills/deleted?from=&to=
// Returns all voided (deleted) bills for the current shop, plus an
// aggregate totals block. Used by the Money Out page's "Deleted Bills"
// section and by the dashboard's "Deleted Bill Amount" stat.
export async function GET(req: NextRequest) {
  const shopId = getShopId(req)
  if (!shopId) return NextResponse.json({ error: 'Shop ID required' }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const from = sp.get('from') || undefined
  const to = sp.get('to') || undefined

  // Attribute deletions to the day the bill was originally paid (not the
  // day it was deleted) so a bill paid on Monday but voided on Tuesday
  // still appears in Monday's report.
  const where: any = { shopId }
  if (from || to) {
    where.originalPaidAt = {}
    if (from) where.originalPaidAt.gte = new Date(from)
    if (to) where.originalPaidAt.lte = new Date(to)
  }

  const [items, agg] = await Promise.all([
    db.deletedBill.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
    }),
    db.deletedBill.aggregate({
      where,
      _sum: { total: true },
      _count: true,
    }),
  ])

  return NextResponse.json({
    items,
    totals: {
      count: agg._count,
      total: agg._sum.total || 0,
    },
  })
}
