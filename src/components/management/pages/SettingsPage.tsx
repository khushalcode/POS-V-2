'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store, Receipt, Save, Loader2, RotateCcw, Palette, Type, Eye, EyeOff,
  AlignLeft, AlignCenter, AlignRight, FileText, ChefHat, Bike, Link as LinkIcon,
  ShieldCheck, AlertCircle, Copy, Printer, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import type { ShopSettings } from '@/lib/types'
import { BillReceiptPreview } from '@/components/shared/StylePreviews'

// ─── Thermal printer presets ───────────────────────────────────────────
// A "preset" is a one-tap configuration for a specific thermal printer
// model. The Retsol 8TUEP is a popular 80mm USB thermal printer in India;
// its sweet spot for crisp, legible receipts is 80mm paper / 11px font /
// 4mm margin / 1 copy. The "Apply" button just fills those values into
// the form — the user can still tweak individual fields afterward.
interface PrinterPreset {
  id: string
  name: string
  description: string
  values: {
    paperWidth: number
    printFontSize: number
    printMargin: number
    billCopies: number
    autoPrint: boolean
    silentPrint: boolean
  }
}

const PRINTER_PRESETS: PrinterPreset[] = [
  {
    id: 'retsol-8tuep',
    name: 'Retsol 8TUEP (80mm USB Thermal)',
    description: '80mm paper · 11px font · 4mm margin · 1 copy · auto-print on',
    values: {
      paperWidth: 80,
      printFontSize: 11,
      printMargin: 4,
      billCopies: 1,
      autoPrint: true,
      silentPrint: false,
    },
  },
  {
    id: 'retsol-rtp-82',
    name: 'Retsol RTP-82 (80mm Bluetooth Thermal)',
    description: '80mm paper · 11px font · 4mm margin · 1 copy · auto-print on',
    values: {
      paperWidth: 80,
      printFontSize: 11,
      printMargin: 4,
      billCopies: 1,
      autoPrint: true,
      silentPrint: false,
    },
  },
  {
    id: 'epson-tm-t82',
    name: 'Epson TM-T82 (80mm USB Thermal)',
    description: '80mm paper · 12px font · 4mm margin · 1 copy · auto-print on',
    values: {
      paperWidth: 80,
      printFontSize: 12,
      printMargin: 4,
      billCopies: 1,
      autoPrint: true,
      silentPrint: false,
    },
  },
  {
    id: 'xprinter-58',
    name: 'Xprinter 58mm (Compact Thermal)',
    description: '58mm paper · 10px font · 3mm margin · 1 copy · auto-print on',
    values: {
      paperWidth: 58,
      printFontSize: 10,
      printMargin: 3,
      billCopies: 1,
      autoPrint: true,
      silentPrint: false,
    },
  },
  {
    id: 'a4-laser',
    name: 'A4 Laser / Inkjet Printer',
    description: '210mm paper · 14px font · 15mm margin · 1 copy · auto-print off',
    values: {
      paperWidth: 210,
      printFontSize: 14,
      printMargin: 15,
      billCopies: 1,
      autoPrint: false,
      silentPrint: false,
    },
  },
]

export default function SettingsPage() {
  const { currentShop } = useSession()
  const shopFetch = useShopFetch()
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({
    shopName: '',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    taxRate: '5',
    serviceRate: '0',
    currency: 'Rs.',
    invoicePrefix: 'INV',
    kotPrefix: 'KOT',
    footerNote: 'Thank you for dining with us!',
    // Bill style
    billShowLogo: true,
    billShowGstin: true,
    billShowPhone: true,
    billShowAddress: true,
    billShowEmail: false,
    billShowDateTime: true,
    billShowWaiter: true,
    billShowCustomer: true,
    billShowKotNo: true,
    billFontSize: 11,
    billHeaderAlign: 'center',
    billExtraNote: '',
    billAccentColor: '#f97316',
    billBoldFont: false,
    // KOT style
    kotShowLogo: true,
    kotShowWaiter: true,
    kotShowDateTime: true,
    kotShowTable: true,
    kotShowGuests: true,
    kotFontSize: 12,
    kotHeaderAlign: 'center',
    kotAccentColor: '#f97316',
    kotExtraNote: '',
    kotBoldFont: false,
    // Zomato API
    zomatoEnabled: false,
    zomatoApiKey: '',
    zomatoRestaurantId: '',
    zomatoApiBaseUrl: 'https://www.zomato.com/partners/v1',
    zomatoWebhookSecret: '',
    // Printer setup
    paperWidth: 80,
    printFontSize: 11,
    printMargin: 4,
    autoPrint: true,
    billCopies: 1,
    silentPrint: false,
    printHeaderText: '',
    printFooterText: '',
  })

  useEffect(() => {
    const load = async () => {
      const res = await shopFetch('/api/settings')
      const data = await res.json()
      setSettings(data.settings)
      setF({
        shopName: data.settings.shopName || '',
        address: data.settings.address || '',
        phone: data.settings.phone || '',
        email: data.settings.email || '',
        gstin: data.settings.gstin || '',
        taxRate: String(data.settings.taxRate ?? 5),
        serviceRate: String(data.settings.serviceRate ?? 0),
        currency: data.settings.currency || 'Rs.',
        invoicePrefix: data.settings.invoicePrefix || 'INV',
        kotPrefix: data.settings.kotPrefix || 'KOT',
        footerNote: data.settings.footerNote || 'Thank you for dining with us!',
        billShowLogo: data.settings.billShowLogo ?? true,
        billShowGstin: data.settings.billShowGstin ?? true,
        billShowPhone: data.settings.billShowPhone ?? true,
        billShowAddress: data.settings.billShowAddress ?? true,
        billShowEmail: data.settings.billShowEmail ?? false,
        billShowDateTime: data.settings.billShowDateTime ?? true,
        billShowWaiter: data.settings.billShowWaiter ?? true,
        billShowCustomer: data.settings.billShowCustomer ?? true,
        billShowKotNo: data.settings.billShowKotNo ?? true,
        billFontSize: data.settings.billFontSize ?? 11,
        billHeaderAlign: data.settings.billHeaderAlign || 'center',
        billExtraNote: data.settings.billExtraNote || '',
        billAccentColor: data.settings.billAccentColor || '#f97316',
        billBoldFont: data.settings.billBoldFont ?? false,
        kotShowLogo: data.settings.kotShowLogo ?? true,
        kotShowWaiter: data.settings.kotShowWaiter ?? true,
        kotShowDateTime: data.settings.kotShowDateTime ?? true,
        kotShowTable: data.settings.kotShowTable ?? true,
        kotShowGuests: data.settings.kotShowGuests ?? true,
        kotFontSize: data.settings.kotFontSize ?? 12,
        kotHeaderAlign: data.settings.kotHeaderAlign || 'center',
        kotAccentColor: data.settings.kotAccentColor || '#f97316',
        kotExtraNote: data.settings.kotExtraNote || '',
        kotBoldFont: data.settings.kotBoldFont ?? false,
        zomatoEnabled: data.settings.zomatoEnabled ?? false,
        zomatoApiKey: data.settings.zomatoApiKey || '',
        zomatoRestaurantId: data.settings.zomatoRestaurantId || '',
        zomatoApiBaseUrl: data.settings.zomatoApiBaseUrl || 'https://www.zomato.com/partners/v1',
        zomatoWebhookSecret: data.settings.zomatoWebhookSecret || '',
        paperWidth: data.settings.paperWidth ?? 80,
        printFontSize: data.settings.printFontSize ?? 11,
        printMargin: data.settings.printMargin ?? 4,
        autoPrint: data.settings.autoPrint ?? true,
        billCopies: data.settings.billCopies ?? 1,
        silentPrint: data.settings.silentPrint ?? false,
        printHeaderText: data.settings.printHeaderText || '',
        printFooterText: data.settings.printFooterText || '',
      })
      setLoading(false)
    }
    load()
  }, [shopFetch, currentShop?.id])

  const save = async () => {
    setSaving(true)
    try {
      const res = await shopFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(f),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSettings(data.settings)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">Configure restaurant profile, bill & KOT styles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-slate-700 to-slate-900 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {f.shopName ? f.shopName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-base">{f.shopName || 'Restaurant'}</p>
              <p className="text-xs text-slate-500">{f.phone || '+91 XXXXX XXXXX'} {f.gstin && `· GSTIN: ${f.gstin}`}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Default Tax Rate</p>
            <p className="text-lg font-bold text-orange-600">{f.taxRate}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Shop / Bill Style / KOT Style / Printer / Zomato */}
      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="shop" className="text-xs sm:text-sm">
            <Store className="w-3.5 h-3.5 mr-1.5" /> Shop
          </TabsTrigger>
          <TabsTrigger value="bill" className="text-xs sm:text-sm">
            <Receipt className="w-3.5 h-3.5 mr-1.5" /> Bill
          </TabsTrigger>
          <TabsTrigger value="kot" className="text-xs sm:text-sm">
            <ChefHat className="w-3.5 h-3.5 mr-1.5" /> KOT
          </TabsTrigger>
          <TabsTrigger value="printer" className="text-xs sm:text-sm">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Printer
          </TabsTrigger>
          <TabsTrigger value="zomato" className="text-xs sm:text-sm">
            <Bike className="w-3.5 h-3.5 mr-1.5" /> Zomato
          </TabsTrigger>
        </TabsList>

        {/* Shop details tab */}
        <TabsContent value="shop" className="mt-4">
          <Card className="border-0 shadow-md rounded-2xl">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50">
                  <Store className="w-4 h-4 text-blue-600" />
                </div>
                <CardTitle className="text-sm font-semibold text-slate-900">Restaurant Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Restaurant Name</Label>
                  <Input value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} placeholder="Spice Garden" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="hello@restaurant.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">GSTIN</Label>
                  <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} placeholder="29ABCDE1234F1Z5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Full restaurant address" rows={2} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Tax %</Label>
                  <Input type="number" step="0.5" value={f.taxRate} onChange={(e) => setF({ ...f, taxRate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Service Charge %</Label>
                  <Input type="number" step="0.5" value={f.serviceRate} onChange={(e) => setF({ ...f, serviceRate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} placeholder="Rs." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice Prefix</Label>
                  <Input value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} placeholder="INV" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">KOT Prefix</Label>
                  <Input value={f.kotPrefix} onChange={(e) => setF({ ...f, kotPrefix: e.target.value })} placeholder="KOT" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bill Footer Note</Label>
                  <Input value={f.footerNote} onChange={(e) => setF({ ...f, footerNote: e.target.value })} placeholder="Thank you!" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bill style tab */}
        <TabsContent value="bill" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bill style controls */}
            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Bill Style</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {/* Show/hide toggles */}
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Show / Hide Elements</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleRow label="Logo / Shop Name" checked={f.billShowLogo} onChange={(v) => setF({ ...f, billShowLogo: v })} />
                    <ToggleRow label="GSTIN" checked={f.billShowGstin} onChange={(v) => setF({ ...f, billShowGstin: v })} />
                    <ToggleRow label="Phone" checked={f.billShowPhone} onChange={(v) => setF({ ...f, billShowPhone: v })} />
                    <ToggleRow label="Address" checked={f.billShowAddress} onChange={(v) => setF({ ...f, billShowAddress: v })} />
                    <ToggleRow label="Email" checked={f.billShowEmail} onChange={(v) => setF({ ...f, billShowEmail: v })} />
                    <ToggleRow label="Date / Time" checked={f.billShowDateTime} onChange={(v) => setF({ ...f, billShowDateTime: v })} />
                    <ToggleRow label="Waiter Name" checked={f.billShowWaiter} onChange={(v) => setF({ ...f, billShowWaiter: v })} />
                    <ToggleRow label="Customer Name" checked={f.billShowCustomer} onChange={(v) => setF({ ...f, billShowCustomer: v })} />
                    <ToggleRow label="KOT Number" checked={f.billShowKotNo} onChange={(v) => setF({ ...f, billShowKotNo: v })} />
                  </div>
                </div>

                {/* Font size */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Type className="w-3 h-3" /> Font Size: {f.billFontSize}px</Label>
                  <input
                    type="range"
                    min={9}
                    max={14}
                    value={f.billFontSize}
                    onChange={(e) => setF({ ...f, billFontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Bold font toggle — makes ALL text on the receipt bold */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <Label className="text-xs font-semibold cursor-pointer">Bold Font</Label>
                    <p className="text-[10px] text-slate-500">Make all bill text bold for better readability on thermal printers</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setF({ ...f, billBoldFont: !f.billBoldFont })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${f.billBoldFont ? 'bg-orange-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${f.billBoldFont ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Header alignment */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Header Alignment</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setF({ ...f, billHeaderAlign: a })}
                        className={`flex items-center justify-center py-2 rounded-lg border-2 text-xs font-medium ${
                          f.billHeaderAlign === a ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {a === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : a === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                        <span className="ml-1 capitalize">{a}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent color */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={f.billAccentColor}
                      onChange={(e) => setF({ ...f, billAccentColor: e.target.value })}
                      className="w-12 h-9 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <Input value={f.billAccentColor} onChange={(e) => setF({ ...f, billAccentColor: e.target.value })} className="flex-1" />
                    <div className="flex gap-1">
                      {['#f97316', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#0f172a'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setF({ ...f, billAccentColor: c })}
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Extra note */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Extra Note (above footer)</Label>
                  <Textarea
                    value={f.billExtraNote}
                    onChange={(e) => setF({ ...f, billExtraNote: e.target.value })}
                    placeholder="e.g. Returns accepted within 7 days with bill"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bill live preview */}
            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <BillReceiptPreview settings={f} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* KOT style tab */}
        <TabsContent value="kot" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50">
                    <ChefHat className="w-4 h-4 text-amber-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-900">KOT Style</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Show / Hide Elements</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleRow label="Logo / Shop Name" checked={f.kotShowLogo} onChange={(v) => setF({ ...f, kotShowLogo: v })} />
                    <ToggleRow label="Waiter Name" checked={f.kotShowWaiter} onChange={(v) => setF({ ...f, kotShowWaiter: v })} />
                    <ToggleRow label="Date / Time" checked={f.kotShowDateTime} onChange={(v) => setF({ ...f, kotShowDateTime: v })} />
                    <ToggleRow label="Table Number" checked={f.kotShowTable} onChange={(v) => setF({ ...f, kotShowTable: v })} />
                    <ToggleRow label="Guests Count" checked={f.kotShowGuests} onChange={(v) => setF({ ...f, kotShowGuests: v })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Type className="w-3 h-3" /> Font Size: {f.kotFontSize}px</Label>
                  <input
                    type="range"
                    min={10}
                    max={16}
                    value={f.kotFontSize}
                    onChange={(e) => setF({ ...f, kotFontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Bold font toggle for KOT */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <Label className="text-xs font-semibold cursor-pointer">Bold Font</Label>
                    <p className="text-[10px] text-slate-500">Make all KOT text bold</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setF({ ...f, kotBoldFont: !f.kotBoldFont })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${f.kotBoldFont ? 'bg-orange-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${f.kotBoldFont ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Header Alignment</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setF({ ...f, kotHeaderAlign: a })}
                        className={`flex items-center justify-center py-2 rounded-lg border-2 text-xs font-medium ${
                          f.kotHeaderAlign === a ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {a === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : a === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                        <span className="ml-1 capitalize">{a}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Palette className="w-3 h-3" /> Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={f.kotAccentColor}
                      onChange={(e) => setF({ ...f, kotAccentColor: e.target.value })}
                      className="w-12 h-9 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <Input value={f.kotAccentColor} onChange={(e) => setF({ ...f, kotAccentColor: e.target.value })} className="flex-1" />
                    <div className="flex gap-1">
                      {['#f97316', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#0f172a'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setF({ ...f, kotAccentColor: c })}
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Extra Note (for kitchen)</Label>
                  <Textarea
                    value={f.kotExtraNote}
                    onChange={(e) => setF({ ...f, kotExtraNote: e.target.value })}
                    placeholder="e.g. Allergies? Note here"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <KotReceiptPreview settings={f} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Printer setup tab */}
        <TabsContent value="printer" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Printer presets */}
            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-violet-50">
                    <Zap className="w-4 h-4 text-violet-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Printer Presets</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                <p className="text-xs text-slate-500 mb-2">
                  Pick your thermal printer model. The right paper width, font
                  size, and margins will be filled in automatically — you can
                  still tweak them in the panel on the right.
                </p>
                {PRINTER_PRESETS.map((p) => {
                  const isActive =
                    f.paperWidth === p.values.paperWidth &&
                    f.printFontSize === p.values.printFontSize &&
                    f.printMargin === p.values.printMargin &&
                    f.billCopies === p.values.billCopies &&
                    f.autoPrint === p.values.autoPrint
                  return (
                    <button
                      key={p.id}
                      onClick={() => setF({ ...f, ...p.values })}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{p.description}</p>
                        </div>
                        {isActive && (
                          <Badge className="text-[9px] bg-violet-500 text-white shrink-0">Active</Badge>
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* Quick callout for the Retsol 8TUEP — most common in Indian restaurants */}
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1 mt-3">
                  <p className="font-bold flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5" /> Recommended for Retsol 8TUEP
                  </p>
                  <p>• Paper width: <strong>80mm</strong> (thermal roll, 80×80 or 80×80×12.7)</p>
                  <p>• Font size: <strong>11px</strong> (best legibility on 80mm)</p>
                  <p>• Margin: <strong>4mm</strong> (matches printer's hardware margin)</p>
                  <p>• Copies: <strong>1</strong> (single copy — Customer Copy)</p>
                  <p>• Auto-print: <strong>ON</strong> (print dialog opens automatically)</p>
                  <p>• Install the printer's USB driver on Windows; on Android APK the printer is auto-detected via USB-OTG.</p>
                </div>
              </CardContent>
            </Card>

            {/* Manual printer controls */}
            <Card className="border-0 shadow-md rounded-2xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100">
                    <Printer className="w-4 h-4 text-slate-700" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Printer Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {/* Paper width selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Paper Width (mm)</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {[58, 72, 80, 210].map((w) => (
                      <button
                        key={w}
                        onClick={() => setF({ ...f, paperWidth: w })}
                        className={`py-2 rounded-lg border-2 text-xs font-medium ${
                          f.paperWidth === w ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {w}mm
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    58mm / 72mm / 80mm = thermal roll; 210mm = A4.
                  </p>
                </div>

                {/* Font size slider */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Type className="w-3 h-3" /> Print Font Size: {f.printFontSize}px</Label>
                  <input
                    type="range"
                    min={9}
                    max={16}
                    value={f.printFontSize}
                    onChange={(e) => setF({ ...f, printFontSize: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Margin */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Print Margin (mm): {f.printMargin}</Label>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={f.printMargin}
                    onChange={(e) => setF({ ...f, printMargin: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Bill copies */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Number of Copies</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((c) => (
                      <button
                        key={c}
                        onClick={() => setF({ ...f, billCopies: c })}
                        className={`py-2 rounded-lg border-2 text-xs font-medium ${
                          f.billCopies === c ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {c} {c === 1 ? 'copy' : 'copies'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-print + silent print toggles */}
                <div className="space-y-2">
                  <ToggleRow
                    label="Auto-open print dialog"
                    checked={f.autoPrint}
                    onChange={(v) => setF({ ...f, autoPrint: v })}
                  />
                  <ToggleRow
                    label="Silent print (skip preview)"
                    checked={f.silentPrint}
                    onChange={(v) => setF({ ...f, silentPrint: v })}
                  />
                </div>

                {/* Optional header / footer text */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Print Header Text (optional)</Label>
                  <Input
                    value={f.printHeaderText}
                    onChange={(e) => setF({ ...f, printHeaderText: e.target.value })}
                    placeholder="e.g. Welcome to Spice Garden"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Print Footer Text (optional)</Label>
                  <Input
                    value={f.printFooterText}
                    onChange={(e) => setF({ ...f, printFooterText: e.target.value })}
                    placeholder="e.g. Visit again soon!"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Zomato API tab */}
        <TabsContent value="zomato" className="mt-4">
          <Card className="border-0 shadow-md rounded-2xl">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50">
                  <Bike className="w-4 h-4 text-rose-600" />
                </div>
                <CardTitle className="text-sm font-semibold text-slate-900">Zomato Partner API</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Enable Real Zomato Integration</p>
                  <p className="text-xs text-slate-500">When enabled, Sync button calls the real Zomato API instead of simulation</p>
                </div>
                <Switch checked={f.zomatoEnabled} onCheckedChange={(v) => setF({ ...f, zomatoEnabled: v })} />
              </div>

              {f.zomatoEnabled && (
                <>
                  {/* Status badge */}
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
                    f.zomatoApiKey && f.zomatoRestaurantId
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {f.zomatoApiKey && f.zomatoRestaurantId ? (
                      <><ShieldCheck className="w-4 h-4" /> Configured — real Zomato orders will be fetched on Sync</>
                    ) : (
                      <><AlertCircle className="w-4 h-4" /> API Key and Restaurant ID required to use real integration</>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Zomato API Key</Label>
                      <Input
                        value={f.zomatoApiKey}
                        onChange={(e) => setF({ ...f, zomatoApiKey: e.target.value })}
                        placeholder="Bearer token from Zomato Partner Dashboard"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Zomato Restaurant ID</Label>
                      <Input
                        value={f.zomatoRestaurantId}
                        onChange={(e) => setF({ ...f, zomatoRestaurantId: e.target.value })}
                        placeholder="Your restaurant ID on Zomato"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Base URL</Label>
                      <Input
                        value={f.zomatoApiBaseUrl}
                        onChange={(e) => setF({ ...f, zomatoApiBaseUrl: e.target.value })}
                        placeholder="https://www.zomato.com/partners/v1"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Webhook Secret (optional)</Label>
                      <Input
                        value={f.zomatoWebhookSecret}
                        onChange={(e) => setF({ ...f, zomatoWebhookSecret: e.target.value })}
                        placeholder="Secret to verify incoming webhooks"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Webhook URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" /> Webhook URL (set this in Zomato Dashboard → Webhooks)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/zomato/webhook?shopId=${currentShop?.id || 'SHOP_ID'}${f.zomatoWebhookSecret ? `&secret=${f.zomatoWebhookSecret}` : ''}`}
                        className="font-mono text-[10px] bg-slate-50"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/api/zomato/webhook?shopId=${currentShop?.id || 'SHOP_ID'}${f.zomatoWebhookSecret ? `&secret=${f.zomatoWebhookSecret}` : ''}`
                          navigator.clipboard.writeText(url)
                          toast.success('Webhook URL copied')
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-1">
                    <p className="font-bold">Setup Instructions:</p>
                    <p>1. Log in to <a href="https://partners.zomato.com" target="_blank" rel="noopener" className="underline">Zomato Partner Dashboard</a></p>
                    <p>2. Get your API Key from Settings → API</p>
                    <p>3. Find your Restaurant ID in Settings → Restaurant</p>
                    <p>4. Set the Webhook URL (above) in Settings → Webhooks</p>
                    <p>5. Save settings → click Sync in Zomato Orders to fetch real orders</p>
                  </div>
                </>
              )}

              {!f.zomatoEnabled && (
                <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-500">
                  Currently using <strong>simulation mode</strong> — sample orders are created on Sync.
                  Enable real integration to fetch actual Zomato orders.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// KOT preview (inline to avoid circular imports)
function KotReceiptPreview({ settings }: { settings: any }) {
  const accent = settings.kotAccentColor || '#f97316'
  const fontSize = settings.kotFontSize || 12
  const align = settings.kotHeaderAlign || 'center'

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 font-mono" style={{ fontSize: `${fontSize}px` }}>
      {settings.kotShowLogo && (
        <div style={{ textAlign: align as any }} className="mb-1">
          <div className="font-bold text-sm" style={{ color: accent }}>
            {settings.shopName || 'Restaurant Name'}
          </div>
          <div className="text-[10px] text-slate-500">Kitchen Order Ticket</div>
        </div>
      )}
      <div className="border-t-2 border-dashed border-slate-300 my-1.5" style={{ borderTopColor: accent }} />
      <div className="space-y-0.5">
        <Row label="KOT No:" value="#1" />
        {settings.kotShowTable && <Row label="Table:" value="Table 5" />}
        {settings.kotShowGuests && <Row label="Guests:" value="4" />}
        {settings.kotShowWaiter && <Row label="Waiter:" value="Riya" />}
        {settings.kotShowDateTime && <Row label="Time:" value="12:30 PM" />}
      </div>
      <div className="border-t border-dashed border-slate-300 my-1.5" />
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: `1px solid ${accent}` }}>
            <th className="text-left py-0.5">Item</th>
            <th className="text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Butter Chicken</td><td className="text-right font-bold">1</td></tr>
          <tr><td>Butter Naan</td><td className="text-right font-bold">3</td></tr>
          <tr><td>Masala Chai</td><td className="text-right font-bold">2</td></tr>
        </tbody>
      </table>
      {settings.kotExtraNote && (
        <>
          <div className="border-t border-dashed border-slate-300 my-1.5" />
          <div className="italic text-[10px]">{settings.kotExtraNote}</div>
        </>
      )}
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
