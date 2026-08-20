import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/bills/[id]
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const bill = await db.bill.findUnique({
    where: { id },
    include: { order: { include: { items: true, table: true } } },
  })
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ bill })
}

// DELETE /api/bills/[id] — void a bill.
//
// Before removing the Bill row we capture a full snapshot into the
// DeletedBill table. This preserves an audit trail and lets the
// dashboard / reports show "Deleted Bill Amount" as its own metric
// (and subtract it from the net cash flow) and the Money Out page
// list every voided bill.
//
// We also delete the auto-added MoneyIn row that bills.create()
// inserted (matched by description "Bill #<n> (Table <n>)") so the
// cash flow ties out — otherwise the voided sale would still be
// counted as income.
//
// Body: { reason?: string, deletedBy?: string, deletedById?: string }
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const bill = await db.bill.findUnique({
    where: { id },
    include: { order: { include: { items: true } } },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  const now = new Date()

  // 1) Archive a full snapshot into DeletedBill BEFORE deleting the bill.
  await db.deletedBill.create({
    data: {
      shopId: bill.shopId,
      originalBillId: bill.id,
      billNo: bill.billNo,
      orderId: bill.orderId,
      tableNumber: bill.tableNumber,
      subtotal: bill.subtotal,
      taxRate: bill.taxRate,
      taxAmount: bill.taxAmount,
      discount: bill.discount,
      serviceCharge: bill.serviceCharge,
      total: bill.total,
      paymentMode: bill.paymentMode,
      paymentStatus: bill.paymentStatus,
      originalPaidAt: bill.paidAt,
      originalCreatedAt: bill.createdAt,
      reason: body?.reason || null,
      deletedBy: body?.deletedBy || null,
      deletedById: body?.deletedById || null,
      deletedAt: now,
    },
  })

  // 2) Reverse the auto-added MoneyIn row from when the bill was created.
  //    bills POST handler inserts a MoneyIn with description `Bill #<n> (Table <n>)`
  //    and source = 'Sale'. We match on that so we only remove income tied
  //    to THIS bill.
  try {
    await db.moneyIn.deleteMany({
      where: {
        shopId: bill.shopId,
        source: 'Sale',
        description: `Bill #${bill.billNo} (Table ${bill.tableNumber})`,
        date: { gte: bill.paidAt },
      },
    })
  } catch (e) {
    console.warn('[DELETE /api/bills/[id]] MoneyIn reversal failed (non-fatal):', e)
  }

  // 3) Free the table if it still points at this order.
  try {
    await db.restaurantTable.updateMany({
      where: { currentOrderId: bill.orderId },
      data: { status: 'available', currentOrderId: null },
    })
  } catch (e) {
    console.warn('[DELETE /api/bills/[id]] table free failed (non-fatal):', e)
  }

  // 4) Audit log entry.
  try {
    await db.auditLog.create({
      data: {
        shopId: bill.shopId,
        userId: body?.deletedById || null,
        userName: body?.deletedBy || null,
        action: 'bill_delete',
        details: JSON.stringify({
          billId: bill.id,
          billNo: bill.billNo,
          total: bill.total,
          tableNumber: bill.tableNumber,
          paymentMode: bill.paymentMode,
          reason: body?.reason || null,
        }),
      },
    })
  } catch (e) {
    console.warn('[DELETE /api/bills/[id]] audit log failed (non-fatal):', e)
  }

  // 5) Delete the bill itself. The order + order items remain (they have
  //    their own lifecycle) but the bill record is gone.
  await db.bill.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
