'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, Wifi, WifiOff, ArrowRight,
  Store, LayoutDashboard, Zap, Store as StoreIcon, ChevronDown, CheckCircle2,
  Receipt, ChefHat, Bike, ShieldCheck, TrendingUp, Users, Table2, Package,
  Lock, AlertTriangle, Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/lib/session'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { useInstallCheck } from '@/lib/use-install-check'
import { GlobalShortcutBar } from '@/components/shared/GlobalShortcutBar'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { startSyncManager } from '@/lib/sync-manager'
import { initDB } from '@/lib/client-db'
import { bootstrapSync } from '@/lib/offline-sync'
import CounterMode from '@/components/counter/CounterMode'
import KitchenMode from '@/components/kitchen/KitchenMode'
import HistoryMode from '@/components/history/HistoryMode'
import ManagementMode from '@/components/management/ManagementMode'
import ZomatoMode from '@/components/zomato/ZomatoMode'
import { formatCurrency } from '@/lib/format'

type Mode = 'home' | 'counter' | 'kitchen' | 'history' | 'management' | 'direct' | 'zomato'

const ADMIN_MODES: Mode[] = ['counter', 'direct', 'kitchen', 'history', 'zomato', 'management']

export default function Home() {
  const { user, currentShop, loading } = useSession()
  const { status: trialStatus, daysLeft } = useInstallCheck()
  const [mode, setMode] = useState<Mode>('home')
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // ─── Initialize the SQLite WASM database BEFORE any data access ───
  useEffect(() => {
    let cancelled = false
    initDB()
      .then(() => {
        if (cancelled) return
        setDbReady(true)
        // ─── Bootstrap pull from Supabase ───
        // Pulls all remote changes since the last sync into local SQLite
        // and drains any locally-pending writes back to Supabase. Runs in
        // the background — the UI is already interactive at this point.
        bootstrapSync()
          .then(({ pulled, pushed }) => {
            if (pulled > 0 || pushed > 0) {
              console.log(`[bootstrap] pulled ${pulled} rows, pushed ${pushed} rows from/to Supabase`)
            }
            // Notify any open dashboards to refresh their data.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('supabase-sync-complete'))
            }
          })
          .catch((e) => console.warn('[bootstrap] sync failed (non-fatal):', e))
      })
      .catch((e) => {
        console.error('[page.tsx] DB init failed:', e)
        if (!cancelled) setDbError(e?.message || String(e))
      })
    return () => { cancelled = true }
  }, [])

  // ─── Start sync manager (drains outbox to Supabase when online) ───
  useEffect(() => {
    if (!dbReady) return
    startSyncManager()
  }, [dbReady])

  useEffect(() => {
    if (dbReady && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-sync-complete'))
    }
  }, [dbReady])

  useEffect(() => {
    if (loading || !user) return
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('posMode') as Mode | null
    if (saved && saved !== 'home') setMode(saved)
  }, [loading, user])

  useEffect(() => {
    if (!loading && !user) {
      setMode('home')
      localStorage.removeItem('posMode')
    }
  }, [loading, user])

  const enterMode = (m: Mode) => {
    setMode(m)
    if (typeof window !== 'undefined') localStorage.setItem('posMode', m)
  }

  const backHome = () => {
    setMode('home')
    if (typeof window !== 'undefined') localStorage.removeItem('posMode')
  }

  if (dbError) {
    return <DbErrorScreen message={dbError} />
  }
  if (!dbReady || trialStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center img-bg">
        <div className="w-12 h-12 rounded-xl bg-brand-gradient animate-pulse" />
      </div>
    )
  }
  if (trialStatus === 'device_locked') {
    return <DeviceLockedScreen />
  }
  if (trialStatus === 'expired') {
    return <TrialExpiredScreen daysLeft={0} />
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center img-bg">
        <div className="w-12 h-12 rounded-xl bg-brand-gradient animate-pulse" />
      </div>
    )
  }
  if (!user) return <LoginScreen onLoggedOut={() => setMode('home')} />

  const allowedModes = user.role === 'admin' ? ADMIN_MODES : ADMIN_MODES.filter((m) => m !== 'management')

  if (mode !== 'home' && allowedModes.includes(mode)) {
    if (mode === 'counter') return <CounterMode onExit={backHome} currentMode="counter" onNavigate={enterMode} />
    if (mode === 'kitchen') return <KitchenMode onExit={backHome} currentMode="kitchen" onNavigate={enterMode} />
    if (mode === 'history') return <HistoryMode onExit={backHome} currentMode="history" onNavigate={enterMode} />
    if (mode === 'management') return <ManagementMode onExit={backHome} currentMode="management" onNavigate={enterMode} />
    if (mode === 'direct') return <CounterMode onExit={backHome} directMode currentMode="direct" onNavigate={enterMode} />
    if (mode === 'zomato') return <ZomatoMode onExit={backHome} currentMode="zomato" onNavigate={enterMode} />
  }

  return <HomeScreen mode={mode} onSelect={enterMode} daysLeft={daysLeft} />
}

const CARD_COLORS: Record<string, { gradient: string; glow: string }> = {
  direct: { gradient: 'from-amber-400 via-orange-500 to-rose-500', glow: 'shadow-orange-500/40' },
  counter: { gradient: 'from-orange-500 to-rose-500', glow: 'shadow-orange-500/30' },
  zomato: { gradient: 'from-rose-500 to-red-600', glow: 'shadow-rose-500/30' },
  kitchen: { gradient: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/30' },
  history: { gradient: 'from-violet-500 to-fuchsia-600', glow: 'shadow-violet-500/30' },
  management: { gradient: 'from-slate-700 to-slate-900', glow: 'shadow-slate-700/40' },
}

function HomeScreen({ mode, onSelect, daysLeft }: { mode: Mode; onSelect: (m: Mode) => void; daysLeft: number | null }) {
  const { user, currentShop, shops, selectShop, logout } = useSession()
  const shopFetch = useShopFetch()
  const [online, setOnline] = useState(true)
  const [shopPickerOpen, setShopPickerOpen] = useState(false)
  const [dashData, setDashData] = useState<any>(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  // Load dashboard data
  useEffect(() => {
    if (!currentShop) return
    shopFetch('/api/dashboard').then((r) => r.json()).then((d) => setDashData(d)).catch(() => {})
  }, [shopFetch, currentShop?.id])

  const isAdmin = user?.role === 'admin'

  if (!currentShop) {
    return <ShopSelectorInline shops={shops} onPick={(s) => selectShop(s)} onLogout={logout} />
  }

  const allModes = [
    // Management FIRST for admin users
    { key: 'management' as Mode, title: 'Management', subtitle: 'Dashboard, inventory, finance, reports, audit', icon: LayoutDashboard, tags: ['Dashboard', 'Reports', 'Audit', 'Users'], span: 'md:col-span-3', roles: ['admin'] as const },
    { key: 'direct' as Mode, title: 'Direct Order', subtitle: 'Quick takeaway', icon: Zap, tags: ['Fast', 'Takeaway'], featured: true, roles: ['admin', 'staff'] as const },
    { key: 'counter' as Mode, title: 'Counter Mode', subtitle: 'Tables, KOT & bills', icon: Store, tags: ['Tables', '2-copy print'], roles: ['admin', 'staff'] as const },
    { key: 'zomato' as Mode, title: 'Zomato Orders', subtitle: 'Push to kitchen', icon: Bike, tags: ['Sync', 'Status flow'], roles: ['admin', 'staff'] as const },
    { key: 'kitchen' as Mode, title: 'Kitchen Mode', subtitle: 'Live KOT display', icon: ChefHat, tags: ['Real-time', 'Ready alerts'], roles: ['admin', 'staff'] as const },
    { key: 'history' as Mode, title: 'Bills & History', subtitle: 'Past bills, revenue', icon: Receipt, tags: ['Search', 'Revenue'], roles: ['admin', 'staff'] as const },
  ]

  const visibleModes = allModes.filter((m) => m.roles.includes(user?.role as any))

  const greeting = getGreeting()
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen img-bg">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-md">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Thuso</h1>
              <p className="text-[10px] text-slate-400">{user?.name} · {currentShop?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {daysLeft !== null && (
              <Badge className={`text-[10px] ${daysLeft < 30 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                <ShieldCheck className="w-3 h-3 mr-1" />{daysLeft}d
              </Badge>
            )}
            {shops.length > 1 && (
              <div className="relative">
                <button onClick={() => setShopPickerOpen(!shopPickerOpen)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white border border-white/20 text-xs font-semibold hover:bg-white/20">
                  <StoreIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentShop?.name}</span>
                  <span className="sm:hidden">{currentShop?.code}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {shopPickerOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-slate-800 rounded-xl shadow-2xl border border-white/10 py-1 z-50">
                    {shops.map((s) => (
                      <button key={s.id} onClick={() => { selectShop(s); setShopPickerOpen(false) }} className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-700 ${currentShop?.id === s.id ? 'bg-slate-700' : ''}`}>
                        <div><span className="font-semibold text-white">{s.name}</span><br /><span className="text-[10px] text-slate-400">{s.code}</span></div>
                        {currentShop?.id === s.id && <CheckCircle2 className="w-4 h-4 text-brand" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-full ${online ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-slate-300 hover:text-white hover:bg-white/10">Sign out</Button>
          </div>
        </div>
      </header>

      {/* Global shortcut bar — unchanged: Home · Direct · Counter · Zomato · Kitchen · Bills, present on every page */}
      <GlobalShortcutBar currentMode={mode} onNavigate={onSelect} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero / greeting row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 pb-5 border-b border-white/10"
        >
          <div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">{greeting}, {user?.name?.split(' ')[0] || 'there'} 👋</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow mt-0.5">{currentShop?.name}</h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${online ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-300 ring-rose-500/30'}`}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {online ? 'Online' : 'Offline'}
            </div>
            {daysLeft !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${daysLeft < 30 ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30' : 'bg-slate-500/15 text-slate-300 ring-slate-500/30'}`}>
                <ShieldCheck className="w-3.5 h-3.5" /> {daysLeft}d left
              </div>
            )}
          </div>
        </motion.div>

        {/* Dashboard stats — shown to ALL users */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Today at a glance</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DashStat label="Today's Revenue" value={formatCurrency(dashData?.today?.revenue || 0)} sub={`${dashData?.today?.count || 0} bills`} icon={TrendingUp} gradient="from-emerald-500 to-teal-600" />
            <DashStat label="Monthly Revenue" value={formatCurrency(dashData?.month?.revenue || 0)} sub={`${dashData?.month?.count || 0} bills`} icon={Receipt} gradient="from-blue-500 to-indigo-600" />
            <DashStat label="Tables Occupied" value={`${dashData?.tables?.occupied || 0} / ${dashData?.tables?.total || 0}`} sub="Live tables" icon={Table2} gradient="from-orange-500 to-rose-600" />
            <DashStat label="Menu Items" value={String(dashData?.catalog?.menuItems || 0)} sub={`${dashData?.catalog?.customers || 0} customers`} icon={Package} gradient="from-violet-500 to-fuchsia-600" />
          </div>
        </motion.div>

        {/* Quick launch */}
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Quick launch</h3>
        </div>
        <section className="grid gap-3 sm:gap-4 md:grid-cols-3 mb-6">
          {visibleModes.map((m, i) => {
            const colors = CARD_COLORS[m.key] || CARD_COLORS.counter
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3, delay: 0.04 + i * 0.04 }}
                className={m.span}
              >
                <Card
                  onClick={() => onSelect(m.key)}
                  className={`group cursor-pointer relative overflow-hidden border transition-all h-full ${
                    m.span ? 'border-white/10 bg-slate-800/60' : 'border-white/10 bg-white/[0.06]'
                  } backdrop-blur-xl hover:bg-white/[0.09] hover:border-white/25 hover:shadow-xl hover:shadow-black/20 ${
                    m.featured ? 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-slate-900' : ''
                  }`}
                >
                  {/* subtle corner glow, no more full-bleed gradient background */}
                  <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${colors.gradient} opacity-25 blur-3xl pointer-events-none group-hover:opacity-40 transition-opacity`} />

                  {m.featured && <div className="absolute top-3 right-3 z-10"><Badge className="bg-amber-400 text-amber-950 border-0 text-[9px] font-bold uppercase">⚡ Fast</Badge></div>}
                  {m.key === 'zomato' && <div className="absolute top-3 right-3 z-10"><Badge className="bg-rose-500 text-white border-0 text-[9px] font-bold uppercase">Zomato</Badge></div>}

                  <div className={`relative p-4 sm:p-5 min-h-[136px] flex flex-col ${m.span ? 'md:flex-row md:items-center md:gap-5' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} shadow-lg ${colors.glow} flex items-center justify-center ring-1 ring-white/20 mb-3 ${m.span ? 'md:shrink-0 md:mb-0' : ''}`}>
                      <m.icon className="w-5.5 h-5.5 text-white" strokeWidth={2.2} />
                    </div>
                    <div className={m.span ? 'flex-1' : 'flex-1 flex flex-col'}>
                      <h3 className={`font-bold text-white mb-0.5 ${m.span ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>{m.title}</h3>
                      <p className="text-[11px] sm:text-xs text-slate-400 mb-2.5 line-clamp-1">{m.subtitle}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {m.tags.map((t) => (
                          <span key={t} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 ring-1 ring-white/10">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="mt-auto flex items-center gap-1 text-xs font-bold text-slate-200 group-hover:text-white">
                        Launch <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </section>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 pt-2">
        </div>
      </main>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

function DashStat({ label, value, sub, icon: Icon, gradient }: { label: string; value: string; sub: string; icon: any; gradient: string }) {
  return (
    <Card className="border-0 shadow-lg overflow-hidden relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-95`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
      <CardContent className="relative p-3 sm:p-4 text-white">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-white/80 uppercase tracking-wide">{label}</span>
          <Icon className="w-4 h-4 text-white/80" />
        </div>
        <div className="text-lg sm:text-2xl font-bold">{value}</div>
        <div className="text-[10px] text-white/70">{sub}</div>
      </CardContent>
    </Card>
  )
}

function ShopSelectorInline({ shops, onPick, onLogout }: { shops: any[]; onPick: (s: any) => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow">Select your shop</h1>
          <p className="text-sm text-slate-300 mt-1">All data is filtered for the selected shop</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shops.map((shop, i) => {
            const colors: Record<string, string> = { orange: 'from-orange-500 to-rose-500', emerald: 'from-emerald-500 to-teal-500', violet: 'from-violet-500 to-fuchsia-500' }
            return (
              <motion.div key={shop.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                <Card onClick={() => onPick(shop)} className="cursor-pointer relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors[shop.color] || colors.orange} opacity-95`} />
                  <div className="relative p-6 text-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/30"><Store className="w-6 h-6" /></div>
                      <Badge variant="outline" className="bg-white/20 border-white/30 text-white text-[10px] uppercase">{shop.code}</Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{shop.name}</h3>
                    {shop.address && <p className="text-xs text-white/80 mb-3 line-clamp-2">{shop.address}</p>}
                    <div className="flex items-center gap-1.5 text-sm font-semibold">Open <ArrowRight className="w-4 h-4" /></div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
        <div className="text-center mt-6"><Button variant="ghost" size="sm" onClick={onLogout} className="text-slate-300">Sign out</Button></div>
      </motion.div>
    </div>
  )
}

// ─── Trial Expired screen (shown after 365 days, no license key entry) ───
function TrialExpiredScreen({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-rose-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Trial Period Over</h1>
        <p className="text-sm text-slate-400 mb-6">Your 365-day trial has ended. Please reinstall the app to start a new trial.</p>
        <Card className="p-6 bg-slate-800/90 border-slate-700">
          <p className="text-sm text-slate-300 mb-4">To continue using Thuso, uninstall and reinstall the application. This will reset the 365-day trial.</p>
          <Button onClick={() => window.location.reload()} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white">Reload App</Button>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Device Locked screen (shown when app is moved to a different device) ───
function DeviceLockedScreen() {
  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-rose-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Device Locked</h1>
        <p className="text-sm text-slate-400 mb-6">This copy of Thuso is locked to another device and cannot be used here.</p>
        <Card className="p-6 bg-slate-800/90 border-slate-700">
          <div className="flex items-start gap-3 mb-4 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              For security, each installation is locked to the first device it was launched on.
              Please contact your vendor to obtain a new copy for this device.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">Reload</Button>
        </Card>
      </motion.div>
    </div>
  )
}


// ─── DB Error screen (shown when SQLite WASM fails to load) ───
function DbErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <Database className="w-8 h-8 text-rose-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">Database Error</h1>
        <p className="text-sm text-slate-400 mb-6">Could not initialize the local database. Please reload the page or restart the app.</p>
        <Card className="p-6 bg-slate-800/90 border-slate-700 text-left">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words flex-1">{message}</pre>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white">Reload App</Button>
        </Card>
      </motion.div>
    </div>
  )
}
