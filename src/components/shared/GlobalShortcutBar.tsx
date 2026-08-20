'use client'

import { motion } from 'framer-motion'
import {
  Zap, Store, ChefHat, Receipt, Bike, LayoutDashboard,
} from 'lucide-react'

type ShortcutMode = 'home' | 'counter' | 'kitchen' | 'history' | 'management' | 'direct' | 'zomato'

interface GlobalShortcutBarProps {
  currentMode: ShortcutMode
  onNavigate: (mode: ShortcutMode) => void
  /** When true, renders as a compact inline bar (for use inside mode headers) */
  inline?: boolean
}

export function GlobalShortcutBar({ currentMode, onNavigate, inline = false }: GlobalShortcutBarProps) {
  const shortcuts: Array<{ mode: ShortcutMode; label: string; icon: any; color: string }> = [
    { mode: 'home', label: 'Home', icon: LayoutDashboard, color: 'from-slate-600 to-slate-800' },
    { mode: 'direct', label: 'Direct', icon: Zap, color: 'from-amber-400 to-orange-500' },
    { mode: 'counter', label: 'Counter', icon: Store, color: 'from-orange-500 to-rose-500' },
    { mode: 'zomato', label: 'Zomato', icon: Bike, color: 'from-rose-500 to-red-600' },
    { mode: 'kitchen', label: 'Kitchen', icon: ChefHat, color: 'from-emerald-500 to-teal-600' },
    { mode: 'history', label: 'Bills', icon: Receipt, color: 'from-violet-500 to-fuchsia-600' },
  ]

  if (inline) {
    // Compact inline version — fits inside mode headers between back button and sign out
    return (
      <div className="flex items-center gap-1 overflow-x-auto">
        {shortcuts.map((s) => {
          const isActive = currentMode === s.mode
          return (
            <motion.button
              key={s.mode}
              onClick={() => onNavigate(s.mode)}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                isActive
                  ? `bg-gradient-to-r ${s.color} text-white shadow-md`
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <s.icon className="w-3 h-3" />
              <span className="hidden sm:inline">{s.label}</span>
            </motion.button>
          )
        })}
      </div>
    )
  }

  // Full-width bar version — sits directly under a page's header, same style everywhere
  return (
    <div className="relative z-20 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto">
        {shortcuts.map((s) => {
          const isActive = currentMode === s.mode
          return (
            <motion.button
              key={s.mode}
              onClick={() => onNavigate(s.mode)}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-w-[80px] sm:min-w-[100px] ${
                isActive
                  ? `bg-gradient-to-r ${s.color} text-white shadow-lg ring-2 ring-white/30`
                  : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'
              }`}
            >
              <s.icon className="w-4 h-4" />
              <span>{s.label}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
