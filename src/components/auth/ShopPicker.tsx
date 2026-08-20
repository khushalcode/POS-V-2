'use client'

import { motion } from 'framer-motion'
import { Store, ArrowRight, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSession, type Shop } from '@/lib/session'

const SHOP_COLORS: Record<string, { gradient: string; glow: string }> = {
  orange: { gradient: 'from-orange-500 to-rose-500', glow: 'shadow-orange-500/30' },
  emerald: { gradient: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/30' },
  violet: { gradient: 'from-violet-500 to-fuchsia-500', glow: 'shadow-violet-500/30' },
}

interface ShopPickerProps {
  onPick: () => void
}

export function ShopPicker({ onPick }: ShopPickerProps) {
  const { user, shops, selectShop, logout } = useSession()

  const pick = (shop: Shop) => {
    selectShop(shop)
    onPick()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-rose-50/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-3xl"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-sm border border-slate-200 mb-3">
            <span className="text-xs font-semibold text-slate-700">Hi, {user?.name}</span>
            <Badge variant="outline" className="text-[10px] uppercase">{user?.role}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Select your shop</h1>
          <p className="text-sm text-slate-500 mt-1">
            All orders, bills and KOTs will be filtered for the selected shop
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shops.map((shop, i) => {
            const c = SHOP_COLORS[shop.color] || SHOP_COLORS.orange
            return (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
              >
                <Card
                  onClick={() => pick(shop)}
                  className={`cursor-pointer relative overflow-hidden border-0 shadow-xl ${c.glow} hover:shadow-2xl transition-all hover:-translate-y-1`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-95`} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_55%)]" />
                  <div className="relative p-6 text-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                        <Store className="w-6 h-6" />
                      </div>
                      <Badge variant="outline" className="bg-white/20 border-white/30 text-white text-[10px] uppercase tracking-wider">
                        {shop.code}
                      </Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{shop.name}</h3>
                    {shop.address && (
                      <p className="text-xs text-white/80 mb-3 line-clamp-2">{shop.address}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-white/80 mb-4">
                      <span>Tax: {shop.taxRate}%</span>
                      <span>·</span>
                      <span>{shop.currency}</span>
                      {shop.gstin && (
                        <>
                          <span>·</span>
                          <span className="truncate">GSTIN: {shop.gstin}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      Open <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500">
            Sign out
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
