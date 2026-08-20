'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, CheckCircle2, Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { PrintPreview } from '@/components/shared/PrintPreview'
import { BillReceipt } from '@/components/shared/Receipts'
import type { Order } from '@/lib/types'
import type { PaymentMode } from '@/lib/types'

interface BillingDialogProps {
  open: boolean
  order: Order | null
  billNo: number
  onClose: () => void
  onConfirm: (payload: {
    taxRate: number
    discount: number
    serviceCharge: number
    paymentMode: PaymentMode
  }) => Promise<any>
  onAfterBill?: (bill: any) => void
}

const PAYMENTS: { mode: PaymentMode; label: string; icon: any; color: string }[] = [
  { mode: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
  { mode: 'upi', label: 'UPI', icon: Smartphone, color: 'bg-violet-500' },
  { mode: 'card', label: 'Card', icon: CreditCard, color: 'bg-sky-500' },
  { mode: 'other', label: 'Other', icon: Wallet, color: 'bg-slate-500' },
]

export function BillingDialog({
  open,
  order,
  billNo,
  settings,
  onClose,
  onConfirm,
  onAfterBill,
}: BillingDialogProps & { settings?: any }) {
  const [taxRate, setTaxRate] = useState(5)
  const [discount, setDiscount] = useState(0)
  const [serviceCharge, setServiceCharge] = useState(0)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [generatedBill, setGeneratedBill] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => {
    if (open) {
      setTaxRate(settings?.taxRate ?? 5)
      setServiceCharge(settings?.serviceRate ?? 0)
      setDiscount(0)
      setPaymentMode('cash')
      setGeneratedBill(null)
      setShowPrint(false)
    }
  }, [open])

  if (!order) return null

  const activeItems = (order.items || []).filter((i) => i.status !== 'cancelled')
  const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = Math.max(0, subtotal + taxAmount + serviceCharge - discount)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const bill = await onConfirm({ taxRate, discount, serviceCharge, paymentMode })
      setGeneratedBill(bill)
      setShowPrint(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="billing-dialog"
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-orange-500 to-rose-500 text-white">
                <div>
                  <h3 className="font-bold text-lg">Generate Bill</h3>
                  <p className="text-xs text-white/80">
                    Table {order.table?.number} · Bill #{billNo}
                  </p>
                </div>
                <button onClick={onClose} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Items summary */}
                <div className="space-y-1 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3">
                  {activeItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(it.price * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Calculations */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-slate-500">Tax %</Label>
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                        min={0}
                        step="0.5"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Discount</Label>
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        min={0}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Service</Label>
                      <Input
                        type="number"
                        value={serviceCharge}
                        onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                        min={0}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Totals */}
                  <Card className="p-3 bg-slate-50 border-slate-200 space-y-1">
                    <Row label="Subtotal" value={formatCurrency(subtotal)} />
                    {taxRate > 0 && <Row label={`Tax (${taxRate}%)`} value={`+ ${formatCurrency(taxAmount)}`} />}
                    {serviceCharge > 0 && <Row label="Service Charge" value={`+ ${formatCurrency(serviceCharge)}`} />}
                    {discount > 0 && <Row label="Discount" value={`- ${formatCurrency(discount)}`} />}
                    <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex items-center justify-between">
                      <span className="font-bold text-slate-900">Total Payable</span>
                      <span className="font-bold text-lg text-orange-600">{formatCurrency(total)}</span>
                    </div>
                  </Card>

                  {/* Payment mode */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Payment Mode</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PAYMENTS.map((p) => (
                        <button
                          key={p.mode}
                          onClick={() => setPaymentMode(p.mode)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all ${
                            paymentMode === p.mode
                              ? `${p.color} text-white border-transparent`
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p.icon className="w-4 h-4" />
                          <span className="text-[10px] font-medium">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={submitting || activeItems.length === 0}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white"
                >
                  {submitting ? 'Generating…' : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm & Print
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print preview after bill — single copy (Customer Copy only) */}
      {/* Table/order only gets closed out once the cashier is actually done
          with the print preview (closes it or finishes printing) — not on a
          timer, so the receipt never gets yanked away mid-print. */}
      <PrintPreview
        open={showPrint}
        onClose={() => {
          const bill = generatedBill
          setShowPrint(false)
          onClose()
          onAfterBill?.(bill)
        }}
        title={`Bill #${generatedBill?.billNo || billNo}`}
        subtitle="Customer copy"
        copies={[
          { label: 'Customer Copy', banner: '*** CUSTOMER COPY ***' },
        ]}
      >
        {generatedBill && <BillReceipt bill={generatedBill} style={settings} />}
      </PrintPreview>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}
