'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Menu as MenuIcon, X, LayoutDashboard, UtensilsCrossed,
  Users, Truck, ShoppingCart, Wallet, TrendingUp, TrendingDown,
  BarChart3, Settings, UserCog, Database, Bell, Bike, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { useMgmtNav, type ManagementPage } from './store'
import { useSession } from '@/lib/session'
import { GlobalShortcutBar as GlobalShortcutBarInline } from '@/components/shared/GlobalShortcutBar'
import { formatCurrency, formatTime } from '@/lib/format'

// Code-split each page so initial JS stays small
function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-6 w-40 bg-slate-200 rounded-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-100 rounded-2xl" />
    </div>
  )
}

const DashboardPage = dynamic(() => import('./pages/DashboardPage'), { loading: PageSkeleton })
const ZomatoPage = dynamic(() => import('./pages/ZomatoPage'), { loading: PageSkeleton })
const MenuPage = dynamic(() => import('./pages/MenuPage'), { loading: PageSkeleton })
const AuditPage = dynamic(() => import('./pages/AuditPage'), { loading: PageSkeleton })
const CustomersPage = dynamic(() => import('./pages/CustomersPage'), { loading: PageSkeleton })
const SuppliersPage = dynamic(() => import('./pages/SuppliersPage'), { loading: PageSkeleton })
const PurchasesPage = dynamic(() => import('./pages/PurchasesPage'), { loading: PageSkeleton })
const ExpensesPage = dynamic(() => import('./pages/ExpensesPage'), { loading: PageSkeleton })
const MoneyInPage = dynamic(() => import('./pages/MoneyInPage'), { loading: PageSkeleton })
const MoneyOutPage = dynamic(() => import('./pages/MoneyOutPage'), { loading: PageSkeleton })
const ReportsPage = dynamic(() => import('./pages/ReportsPage'), { loading: PageSkeleton })
const SettingsPage = dynamic(() => import('./pages/SettingsPage'), { loading: PageSkeleton })
const UsersPage = dynamic(() => import('./pages/UsersPage'), { loading: PageSkeleton })
const BackupPage = dynamic(() => import('./pages/BackupPage'), { loading: PageSkeleton })

interface NavItem {
  id: ManagementPage
  label: string
  icon: any
  color: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600 bg-blue-50' },
      { id: 'zomato', label: 'Zomato Orders', icon: Bike, color: 'text-rose-600 bg-rose-50' },
      { id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-violet-600 bg-violet-50' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { id: 'menu', label: 'Menu Items', icon: UtensilsCrossed, color: 'text-orange-600 bg-orange-50' },
      { id: 'customers', label: 'Customers', icon: Users, color: 'text-amber-600 bg-amber-50' },
      { id: 'suppliers', label: 'Suppliers', icon: Truck, color: 'text-emerald-600 bg-emerald-50' },
      { id: 'purchases', label: 'Purchases', icon: ShoppingCart, color: 'text-rose-600 bg-rose-50' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'expenses', label: 'Expenses', icon: Wallet, color: 'text-red-600 bg-red-50' },
      { id: 'moneyin', label: 'Money In', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
      { id: 'moneyout', label: 'Money Out', icon: TrendingDown, color: 'text-amber-600 bg-amber-50' },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'users', label: 'Users', icon: UserCog, color: 'text-sky-600 bg-sky-50' },
      { id: 'audit', label: 'Audit Log', icon: Activity, color: 'text-rose-600 bg-rose-50' },
      { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-600 bg-slate-100' },
      { id: 'backup', label: 'Backup', icon: Database, color: 'text-fuchsia-600 bg-fuchsia-50' },
    ],
  },
]

const PAGE_LABELS: Record<ManagementPage, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items.map((i) => [i.id, i.label]))
) as Record<ManagementPage, string>

interface ManagementModeProps {
  onExit: () => void
  currentMode?: string
  onNavigate?: (mode: any) => void
}

export default function ManagementMode({ onExit, currentMode, onNavigate }: ManagementModeProps) {
  const nav = useMgmtNav()
  const { user, currentShop, shops, selectShop, logout, theme, setTheme } = useSession()
  const [isMobile, setIsMobile] = useState(false)
  const [clock, setClock] = useState<string>('')

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 1024)
      setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    }
    update()
    const t = setInterval(update, 30_000)
    window.addEventListener('resize', update)
    return () => {
      clearInterval(t)
      window.removeEventListener('resize', update)
    }
  }, [])

  const renderPage = () => {
    switch (nav.currentPage) {
      case 'dashboard': return <DashboardPage currentMode={currentMode} onNavigate={onNavigate} />
      case 'zomato': return <ZomatoPage />
      case 'menu': return <MenuPage />
      case 'customers': return <CustomersPage />
      case 'suppliers': return <SuppliersPage />
      case 'purchases': return <PurchasesPage />
      case 'expenses': return <ExpensesPage />
      case 'moneyin': return <MoneyInPage />
      case 'moneyout': return <MoneyOutPage />
      case 'reports': return <ReportsPage />
      case 'settings': return <SettingsPage />
      case 'users': return <UsersPage />
      case 'audit': return <AuditPage />
      case 'backup': return <BackupPage />
      default: return <DashboardPage />
    }
  }

  const Sidebar = (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <div className="p-3 sm:p-4 flex items-center gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lg">
          <UtensilsCrossed className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-tight truncate">Thuso</h1>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider truncate">Management</p>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-7 w-7 shrink-0" onClick={() => nav.setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="h-px bg-white/10 mx-2 shrink-0" />
      <ScrollArea className="flex-1 scrollable-sidebar">
        <nav className="p-2 space-y-0.5">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.title}>
              {si > 0 && <Separator className="bg-white/10 my-2" />}
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest px-2.5 py-1.5">
                {section.title}
              </p>
              {section.items.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => nav.setPage(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 ${
                    nav.currentPage === item.id
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon className="w-[17px] h-[17px] shrink-0" />
                  <span>{item.label}</span>
                  {nav.currentPage === item.id && (
                    <motion.div layoutId="mgmtNav" className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </motion.button>
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-3 border-t border-white/10 space-y-2">
        {/* Inline shortcut bar */}
        {onNavigate && currentMode && (
          <GlobalShortcutBarInline currentMode={currentMode as any} onNavigate={onNavigate} inline />
        )}
        <Button variant="ghost" size="sm" onClick={onExit} className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5">
          <ArrowLeft className="w-4 h-4 mr-2" /> Exit to Home
        </Button>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <motion.aside
          initial={{ x: -260 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-[230px] xl:w-[250px] shrink-0 shadow-2xl"
        >
          {Sidebar}
        </motion.aside>
      )}

      {/* Mobile sidebar drawer */}
      <Dialog open={nav.sidebarOpen} onOpenChange={nav.setSidebarOpen}>
        <DialogContent className="p-0 max-w-[280px] h-full max-h-[100vh] rounded-none left-0 top-0 translate-x-0 translate-y-0 sm:max-w-[280px]">
          {Sidebar}
        </DialogContent>
      </Dialog>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 sm:h-14 glass border-b border-slate-200/50 flex items-center justify-between px-3 sm:px-4 shrink-0 z-20 bg-white/85 backdrop-blur-xl gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => nav.setSidebarOpen(true)}>
                <MenuIcon className="w-4 h-4" />
              </Button>
            )}
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-medium bg-white shrink-0">
              {PAGE_LABELS[nav.currentPage]}
            </Badge>
            {!isMobile && (
              <span className="text-xs text-slate-400 ml-1 hidden lg:inline">{clock}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Shop switcher */}
            {shops.length > 1 && (
              <select
                value={currentShop?.id || ''}
                onChange={(e) => {
                  const next = shops.find((s) => s.id === e.target.value)
                  if (next) selectShop(next)
                }}
                className="text-[11px] font-semibold bg-brand-soft text-brand-text border border-brand/20 rounded-lg px-2 py-1 cursor-pointer hover:opacity-90 max-w-[120px] sm:max-w-[180px] truncate"
                title="Switch shop"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {/* Theme picker */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {(['orange', 'emerald', 'violet'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`w-5 h-5 rounded ${
                    t === 'orange' ? 'bg-gradient-to-br from-orange-500 to-rose-500'
                    : t === 'emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                  } ${theme === t ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 hover:opacity-100'}`}
                  title={t}
                />
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="w-3.5 h-3.5 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100">
              <div className="w-6 h-6 rounded-full bg-brand-gradient flex items-center justify-center text-[10px] font-bold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">{user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs h-8 px-2">
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 scroll-smooth thin-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={nav.currentPage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// Re-export for convenience
export { formatCurrency, formatTime }
