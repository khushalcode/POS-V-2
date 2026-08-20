'use client'

/**
 * Live bill preview used in Settings page.
 * Renders a sample bill using the user's style preferences.
 */
export function BillReceiptPreview({ settings }: { settings: any }) {
  const accent = settings.billAccentColor || '#f97316'
  const fontSize = settings.billFontSize || 11
  const align = settings.billHeaderAlign || 'center'

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono" style={{ fontSize: `${fontSize}px` }}>
      {settings.billShowLogo && (
        <div style={{ textAlign: align as any }} className="mb-1">
          <div className="font-bold text-base" style={{ color: accent }}>
            {settings.shopName || 'Restaurant Name'}
          </div>
          <div className="text-[10px] text-slate-500">Tax Invoice</div>
        </div>
      )}
      {settings.billShowAddress && settings.address && (
        <div style={{ textAlign: align as any }} className="text-[10px] text-slate-600">
          {settings.address}
        </div>
      )}
      {settings.billShowPhone && settings.phone && (
        <div style={{ textAlign: align as any }} className="text-[10px] text-slate-600">
          Phone: {settings.phone}
        </div>
      )}
      {settings.billShowEmail && settings.email && (
        <div style={{ textAlign: align as any }} className="text-[10px] text-slate-600">
          {settings.email}
        </div>
      )}
      {settings.billShowGstin && settings.gstin && (
        <div style={{ textAlign: align as any }} className="text-[10px] text-slate-600">
          GSTIN: {settings.gstin}
        </div>
      )}
      <div className="border-t-2 my-1.5" style={{ borderTopColor: accent }} />
      <div className="space-y-0.5 text-slate-1000 font-bold">
        <Row label="Bill No:" value={`#${settings.invoicePrefix || 'INV'}-1001`} />
        {settings.billShowDateTime && <Row label="Date:" value="05 Jul 2026, 12:30 PM" />}
        {settings.billShowCustomer && <Row label="Customer:" value="Walk-in" />}
        {settings.billShowWaiter && <Row label="Waiter:" value="Riya" />}
        {settings.billShowKotNo && <Row label="KOT No:" value="#1" />}
      </div>
      <div className="border-t border-dashed text-slate-900 border-slate-300 my-1.5" />
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: `1px solid ${accent}` }}>
            <th className="text-left py-0.5">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Butter Chicken</td><td className="text-right">1</td><td className="text-right">320</td><td className="text-right text-slate-900 font-bold">320</td></tr>
          <tr><td>Butter Naan</td><td className="text-right">3</td><td className="text-right">50</td><td className="text-right text-slate-900 font-bold">150</td></tr>
          <tr><td>Masala Chai</td><td className="text-right">2</td><td className="text-right">40</td><td className="text-right text-slate-900 font-bold">80</td></tr>
        </tbody>
      </table>
      <div className="border-t border-dashed border-slate-300 my-1.5" />
      <Row label="Subtotal" value="₹550.00" />
      <Row label={`Tax (${settings.taxRate || 5}%)`} value="₹27.50" />
      <div className="border-t-2 my-1" style={{ borderTopColor: accent }} />
      <div className="flex justify-between text-slate-900 font-bold text-sm">
        <span>TOTAL</span>
        <span style={{ color: accent }}>₹577.50</span>
      </div>
      {settings.billExtraNote && (
        <div className="border-t border-dashed border-slate-300 my-1.5 pt-1 text-[10px] italic">
          {settings.billExtraNote}
        </div>
      )}
      <div className="text-center text-[10px] font-bold text-slate-900 mt-2">
        {settings.footerNote || 'Thank you for dining with us!'}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
