'use client'

import { formatDateTime, formatTime, formatCurrency } from '@/lib/format'
import type { Order } from '@/lib/types'

export interface ReceiptStyle {
  shopName?: string
  address?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  taxRate?: number
  currency?: string
  invoicePrefix?: string
  kotPrefix?: string
  footerNote?: string
  // Bill style
  billShowLogo?: boolean
  billShowGstin?: boolean
  billShowPhone?: boolean
  billShowAddress?: boolean
  billShowEmail?: boolean
  billShowDateTime?: boolean
  billShowWaiter?: boolean
  billShowCustomer?: boolean
  billShowKotNo?: boolean
  billFontSize?: number
  billHeaderAlign?: string
  billExtraNote?: string | null
  billAccentColor?: string
  billBoldFont?: boolean
  // KOT style
  kotShowLogo?: boolean
  kotShowWaiter?: boolean
  kotShowDateTime?: boolean
  kotShowTable?: boolean
  kotShowGuests?: boolean
  kotFontSize?: number
  kotHeaderAlign?: string
  kotAccentColor?: string
  kotExtraNote?: string | null
  kotBoldFont?: boolean
}

export function KOTReceipt({ order, kotNo, style }: { order: Order; kotNo: number; style?: ReceiptStyle }) {
  const items = (order.items || []).filter((i) => i.status !== 'cancelled')
  const accent = style?.kotAccentColor || '#000'
  const fontSize = style?.kotFontSize || 12
  const align = style?.kotHeaderAlign || 'center'
  const boldClass = style?.kotBoldFont ? 'bold-all' : ''

  return (
    <div className={`p-3 font-mono text-black ${boldClass}`} style={{ fontSize: `${fontSize}px` }}>
      {style?.kotShowLogo !== false && (
        <div style={{ textAlign: align as any }}>
          <div className="bold lg" style={{ color: accent }}>** {style?.kotPrefix || 'KOT'} **</div>
          <div className="bold md">{style?.shopName || 'Thuso'}</div>
          <div className="xs">Kitchen Order Ticket</div>
        </div>
      )}
      <div className="double" style={{ borderTopColor: accent }} />
      <div className="row sm">
        <span>{style?.kotPrefix || 'KOT'} No:</span>
        <span className="bold">#{kotNo}</span>
      </div>
      {style?.kotShowTable !== false && (
        <div className="row sm">
          <span>Table:</span>
          <span className="bold">{order.table?.name || '-'}</span>
        </div>
      )}
      {style?.kotShowGuests !== false && (
        <div className="row sm">
          <span>Guests:</span>
          <span>{order.guests}</span>
        </div>
      )}
      <div className="row sm">
        <span>Type:</span>
        <span className="bold uppercase">{order.type}</span>
      </div>
      {style?.kotShowWaiter !== false && order.waiterName && (
        <div className="row sm">
          <span>Waiter:</span>
          <span>{order.waiterName}</span>
        </div>
      )}
      {style?.kotShowDateTime !== false && (
        <div className="row sm">
          <span>Time:</span>
          <span>{formatTime(order.createdAt)}</span>
        </div>
      )}
      <div className="divider" />
      <table>
        <thead>
          <tr style={{ borderBottom: `1px solid ${accent}` }}>
            <th>Item</th>
            <th className="right">Qty</th>
            <th className="right">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                {it.name}
                {it.notes && <div className="xs italic">  ↳ {it.notes}</div>}
              </td>
              <td className="right bold">{it.quantity}</td>
              <td className="right uppercase">{it.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />
      {order.notes && (
        <div className="sm">
          <span className="bold">Special Notes:</span>
          <br />
          {order.notes}
        </div>
      )}
      {style?.kotExtraNote && (
        <div className="sm italic" style={{ color: accent }}>
          {style.kotExtraNote}
        </div>
      )}
      <div className="divider" />
      <div className="center xs">
        Generated {formatDateTime(new Date())}
        <br />
        *** Hand to kitchen ***
      </div>
    </div>
  )
}

export function BillReceipt({
  bill,
  restaurantName,
  restaurantAddr,
  restaurantPhone,
  footerNote,
  style,
}: {
  bill: any
  restaurantName?: string
  restaurantAddr?: string
  restaurantPhone?: string
  footerNote?: string
  style?: ReceiptStyle
}) {
  const items = bill.order?.items || []
  const accent = style?.billAccentColor || '#000'
  const fontSize = style?.billFontSize || 11
  const align = style?.billHeaderAlign || 'center'
  const boldClass = style?.billBoldFont ? 'bold-all' : ''

  const name = style?.shopName || restaurantName || 'Thuso'
  const addr = style?.address || restaurantAddr
  const phone = style?.phone || restaurantPhone
  const email = style?.email
  const gstin = style?.gstin
  const footer = style?.footerNote || footerNote || 'Thank you for dining with us!'

  return (
    <div className={`p-3 font-mono text-black ${boldClass}`} style={{ fontSize: `${fontSize}px` }}>
      {style?.billShowLogo !== false && (
        <div style={{ textAlign: align as any }}>
          <div className="bold lg" style={{ color: accent }}>{name}</div>
          <div className="xs">{addr}</div>
          <div className="xs">Phone: {phone}</div>
          {style?.billShowEmail && email && <div className="xs">{email}</div>}
          {style?.billShowGstin && gstin && <div className="xs">GSTIN: {gstin}</div>}
        </div>
      )}
      {style?.billShowAddress && addr && !style?.billShowLogo && (
        <div className="center xs">{addr}</div>
      )}
      <div className="double" style={{ borderTopColor: accent }} />
      <div className="center bold md">TAX INVOICE</div>
      <div className="divider" />
      <div className="row sm">
        <span>Bill No:</span>
        <span className="bold">#{style?.invoicePrefix || 'INV'}-{bill.billNo}</span>
      </div>
      <div className="row sm">
        <span>Table:</span>
        <span>{bill.tableNumber}</span>
      </div>
      {style?.billShowDateTime !== false && (
        <div className="row sm">
          <span>Date:</span>
          <span>{formatDateTime(bill.paidAt)}</span>
        </div>
      )}
      <div className="row sm">
        <span>Payment:</span>
        <span className="bold uppercase">{bill.paymentMode}</span>
      </div>
      {style?.billShowWaiter && bill.order?.waiterName && (
        <div className="row sm">
          <span>Waiter:</span>
          <span>{bill.order.waiterName}</span>
        </div>
      )}
      {style?.billShowCustomer && (
        <div className="row sm">
          <span>Customer:</span>
          <span>{bill.order?.customerName || 'Walk-in'}</span>
        </div>
      )}
      {style?.billShowKotNo && (
        <div className="row sm">
          <span>KOT No:</span>
          <span>#{bill.order?.kotPrinted ? '1' : '-'}</span>
        </div>
      )}
      <div className="divider" />
      <table>
        <thead>
          <tr style={{ borderBottom: `1px solid ${accent}` }}>
            <th>Item</th>
            <th className="right">Qty</th>
            <th className="right">Rate</th>
            <th className="right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items
            .filter((i: any) => i.status !== 'cancelled')
            .map((it: any) => (
              <tr key={it.id}>
                <td>
                  {it.name}
                  {it.notes && <div className="xs italic">  ↳ {it.notes}</div>}
                </td>
                <td className="right">{it.quantity}</td>
                <td className="right">{it.price.toFixed(2)}</td>
                <td className="right bold">{(it.price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="divider" />
      <div className="row sm">
        <span>Subtotal</span>
        <span className="bold">{formatCurrency(bill.subtotal)}</span>
      </div>
      {bill.taxRate > 0 && (
        <div className="row sm">
          <span>Tax ({bill.taxRate}%)</span>
          <span>{formatCurrency(bill.taxAmount)}</span>
        </div>
      )}
      {bill.serviceCharge > 0 && (
        <div className="row sm">
          <span>Service Charge</span>
          <span>{formatCurrency(bill.serviceCharge)}</span>
        </div>
      )}
      {bill.discount > 0 && (
        <div className="row sm">
          <span>Discount</span>
          <span>- {formatCurrency(bill.discount)}</span>
        </div>
      )}
      <div className="double" style={{ borderTopColor: accent }} />
      <div className="row lg bold">
        <span>TOTAL</span>
        <span style={{ color: accent }}>{formatCurrency(bill.total)}</span>
      </div>
      {style?.billExtraNote && (
        <div className="divider" />
      )}
      {style?.billExtraNote && (
        <div className="sm italic">{style.billExtraNote}</div>
      )}
      <div className="center xs">
        <div>{footer}</div>
        <div className="mt-1">Powered by Thuso</div>
      </div>
    </div>
  )
}
