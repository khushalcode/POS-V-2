'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, Copy } from 'lucide-react'

export interface PrintCopy {
  /** e.g. "Kitchen Copy" or "Customer Copy" */
  label: string
  /** A short note shown at the top of the receipt, e.g. "FOR KITCHEN" */
  banner?: string
}

interface PrintPreviewProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Receipt content (KOTReceipt or BillReceipt) — rendered once per copy */
  children: React.ReactNode
  /** Page width in px (default 320 = 80mm thermal) */
  width?: number
  /**
   * Copies to print. If provided, shows a copy switcher AND the Print button
   * prints ALL copies back-to-back (one print dialog, multiple receipts).
   * Defaults to a single copy.
   */
  copies?: PrintCopy[]
}

/**
 * PrintPreview
 * Renders a print-ready receipt (KOT or Bill) in a modal preview.
 *
 * If `copies` is provided (e.g. [{label:'Kitchen Copy'}, {label:'Customer Copy'}]),
 * the user can preview each copy via tabs, and clicking "Print All" sends every
 * copy to the printer back-to-back in a single print job — perfect for thermal
 * printers that need a kitchen copy AND a customer copy of every KOT/Bill.
 */
export function PrintPreview({ open, onClose, title, subtitle, children, width = 320, copies }: PrintPreviewProps) {
  const singleCopy: PrintCopy[] = [{ label: 'Receipt' }]
  const allCopies = copies && copies.length > 0 ? copies : singleCopy
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (open) setActiveIdx(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handlePrint = () => {
    const printArea = document.getElementById('print-area')
    if (!printArea) return
    // Build a print document with ALL copies concatenated, separated by a page break
    const copiesHtml = allCopies
      .map((c) => {
        const copyEl = document.getElementById(`copy-${c.label.replace(/\s+/g, '-')}`)
        return copyEl?.innerHTML || ''
      })
      .filter(Boolean)
      .join('<div style="page-break-after: always; height: 12px;"></div>')

    if (!copiesHtml) return

    // ─── Hidden-iframe printing ────────────────────────────────────────
    // We deliberately do NOT use `window.open('', '_blank', …)` here.
    // The Electron main process denies all `window.open` popups via
    // `setWindowOpenHandler` (see electron/main.js), which silently broke
    // the Print button in the packaged .exe build — `win` came back null
    // and the function returned early without ever showing a print dialog.
    //
    // A hidden iframe works in Electron, regular browsers, and PWAs:
    //   • no popup blocker
    //   • no setWindowOpenHandler interception
    //   • `iframe.contentWindow.print()` opens the same OS print dialog
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      return
    }

    doc.open()
    doc.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; margin: 0; padding: 8px; color: #000; }
            .receipt { width: ${width}px; margin: 0 auto; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .lg { font-size: 16px; }
            .md { font-size: 13px; }
            .sm { font-size: 11px; }
            .xs { font-size: 10px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double { border-top: 2px solid #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; gap: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { text-align: left; padding: 2px 0; }
            th { border-bottom: 1px solid #000; }
            /* When the receipt has class "bold-all", every text element
               inherits font-weight: bold. This is controlled by the
               billBoldFont / kotBoldFont setting in ShopSetting. */
            .bold-all, .bold-all * { font-weight: bold !important; }
            .bold-all .xs, .bold-all .sm { font-weight: bold !important; }
            @media print {
              @page { margin: 4mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body><div class="receipt">${copiesHtml}</div></body>
      </html>
    `)
    doc.close()

    // Trigger the print, then remove the iframe.
    // `afterprint` fires in most browsers once the print dialog is closed
    // (success or cancel); we also keep a safety timeout so the iframe is
    // always cleaned up even if `afterprint` doesn't fire (e.g. older Edge).
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    const doPrint = () => {
      try {
        const w = iframe.contentWindow
        if (!w) {
          cleanup()
          return
        }
        w.focus()
        // `afterprint` is the most reliable "print done" signal across
        // Chromium (Electron), Chrome, and Firefox.
        const afterOnce = () => {
          w.removeEventListener('afterprint', afterOnce)
          cleanup()
        }
        w.addEventListener('afterprint', afterOnce)
        w.print()
        // Safety net: if `afterprint` never fires (some mobile WebViews),
        // clean up after a short delay so we don't leak iframes.
        setTimeout(cleanup, 2000)
      } catch (err) {
        console.error('[PrintPreview] print failed:', err)
        cleanup()
      }
    }

    // Give the iframe a tick to lay out before calling print. For receipts
    // containing images we wait for them, otherwise a small fixed delay is
    // enough for fonts/layout to settle.
    const imgs = Array.from(doc.images || [])
    if (imgs.length === 0) {
      setTimeout(doPrint, 100)
    } else {
      let loaded = 0
      const onImgDone = () => {
        loaded++
        if (loaded >= imgs.length) doPrint()
      }
      imgs.forEach((img) => {
        if (img.complete) onImgDone()
        else {
          img.addEventListener('load', onImgDone, { once: true })
          img.addEventListener('error', onImgDone, { once: true })
        }
      })
      // Hard timeout in case an image hangs — we still want to print.
      setTimeout(() => {
        if (loaded < imgs.length) doPrint()
      }, 2500)
    }
  }

  if (typeof window === 'undefined') return null

  const active = allCopies[activeIdx] || allCopies[0]
  const hasMultiple = allCopies.length > 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Copy switcher tabs */}
            {hasMultiple && (
              <div className="flex border-b border-slate-200 bg-slate-50">
                {allCopies.map((c, i) => (
                  <button
                    key={c.label}
                    onClick={() => setActiveIdx(i)}
                    className={`flex-1 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      i === activeIdx
                        ? 'bg-white text-slate-900 border-b-2 border-orange-500'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto p-5 bg-slate-100 flex-1">
              {/* Visible preview — shows the active copy */}
              <div id="print-area" className="bg-white shadow-md mx-auto relative" style={{ width: `${width}px` }}>
                {active.banner && (
                  <div className="bg-slate-900 text-white text-center text-[10px] font-bold py-1 uppercase tracking-wider">
                    {active.banner}
                  </div>
                )}
                <div id={`copy-${active.label.replace(/\s+/g, '-')}`}>{children}</div>
              </div>
              {/* Hidden copies for printing */}
              {hasMultiple && allCopies.map((c, i) => (
                i === activeIdx ? null : (
                  <div key={`hidden-${c.label}`} className="hidden">
                    <div id={`copy-${c.label.replace(/\s+/g, '-')}`}>
                      {c.banner && (
                        <div className="bg-slate-900 text-white text-center text-[10px] font-bold py-1 uppercase tracking-wider">
                          {c.banner}
                        </div>
                      )}
                      {children}
                    </div>
                  </div>
                )
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 bg-white">
              <div className="text-xs text-slate-500">
                {hasMultiple ? `${allCopies.length} copies will print` : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  {hasMultiple ? `Print All ${allCopies.length} Copies` : 'Print'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
