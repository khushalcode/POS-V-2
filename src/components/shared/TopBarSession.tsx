'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, ChevronDown, CheckCircle2, LogOut, Palette, User as UserIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session'

interface TopBarSessionProps {
  /** Optional label like "Counter Mode" / "Kitchen Mode" */
  modeLabel?: string
  /** Children rendered on the right side (e.g. live status, notifications) */
  right?: React.ReactNode
  /** Children rendered on the left side (e.g. back button) */
  left?: React.ReactNode
}

const THEME_COLORS = [
  { id: 'orange', label: 'Sunset', classes: 'from-orange-500 to-rose-500' },
  { id: 'emerald', label: 'Forest', classes: 'from-emerald-500 to-teal-500' },
  { id: 'violet', label: 'Berry', classes: 'from-violet-500 to-fuchsia-500' },
] as const

/**
 * TopBarSession
 * Reusable top bar for all modes (Counter / Kitchen / Management / History).
 * Shows current shop (with switcher if multi-shop), user name, theme picker,
 * and logout. Adapts to the active theme color via CSS variables.
 */
export function TopBarSession({ modeLabel, right, left }: TopBarSessionProps) {
  const { user, shops, currentShop, selectShop, theme, setTheme, logout } = useSession()
  const [shopMenuOpen, setShopMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const shopRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shopRef.current && !shopRef.current.contains(e.target as Node)) setShopMenuOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-12 sm:h-14 glass border-b border-slate-200/50 bg-white/85 backdrop-blur-xl flex items-center justify-between px-3 sm:px-4 shrink-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {left}
        {modeLabel && (
          <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-medium bg-white">
            {modeLabel}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {right}

        {/* Shop switcher (only if multiple shops) */}
        {shops.length > 1 && (
          <div className="relative" ref={shopRef}>
            <button
              onClick={() => setShopMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-brand-soft text-brand-text border border-brand/20 hover:bg-brand-soft text-xs font-semibold"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline truncate max-w-[140px]">{currentShop?.name || 'Select shop'}</span>
              <span className="sm:hidden">{currentShop?.code || 'Shop'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {shopMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50"
                >
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Switch shop</p>
                  {shops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { selectShop(s); setShopMenuOpen(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                        currentShop?.id === s.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="text-[10px] text-slate-500">{s.code}</span>
                      </div>
                      {currentShop?.id === s.id && (
                        <CheckCircle2 className="w-4 h-4 text-brand" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Theme picker */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setThemeOpen((o) => !o)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500"
            title="Change theme"
          >
            <Palette className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {themeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50"
              >
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Theme</p>
                {THEME_COLORS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setThemeOpen(false) }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 ${
                      theme === t.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded bg-gradient-to-br ${t.classes}`} />
                      <span className="font-medium text-slate-900">{t.label}</span>
                    </div>
                    {theme === t.id && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-[10px] font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[11px] font-semibold text-slate-800 leading-tight">{user?.name}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">{user?.role}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
