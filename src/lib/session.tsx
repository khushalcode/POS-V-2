'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export type UserRole = 'admin' | 'staff' | 'kitchen'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  shopId: string | null
}

export interface Shop {
  id: string
  name: string
  code: string
  color: string
  address?: string | null
  phone?: string | null
  gstin?: string | null
  taxRate: number
  serviceRate?: number
  currency: string
}

interface SessionState {
  user: SessionUser | null
  shops: Shop[]
  currentShop: Shop | null
  theme: 'orange' | 'emerald' | 'violet'
  login: (user: SessionUser, shops: Shop[]) => void
  selectShop: (shop: Shop) => void
  logout: () => void
  setTheme: (t: 'orange' | 'emerald' | 'violet') => void
  loading: boolean
}

const SessionContext = createContext<SessionState | undefined>(undefined)

const STORAGE_KEY = 'thuso-session'
const THEME_KEY = 'thuso-theme'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [currentShop, setCurrentShop] = useState<Shop | null>(null)
  const [theme, setThemeState] = useState<'orange' | 'emerald' | 'violet'>('orange')
  const [loading, setLoading] = useState(true)

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setUser(data.user)
        setShops(data.shops || [])
        setCurrentShop(data.currentShop || data.shops?.[0] || null)
      }
      const t = (localStorage.getItem(THEME_KEY) as any) || 'orange'
      setThemeState(t)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // Apply theme to document
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const login = useCallback((u: SessionUser, s: Shop[]) => {
    setUser(u)
    setShops(s)
    // Auto-select first shop if user has only one, else null (will show picker)
    const initialShop = s.length === 1 ? s[0] : (u.shopId ? s.find((x) => x.id === u.shopId) || s[0] : null)
    setCurrentShop(initialShop)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, shops: s, currentShop: initialShop }))
  }, [])

  const selectShop = useCallback((shop: Shop) => {
    setCurrentShop(shop)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const data = JSON.parse(raw)
        data.currentShop = shop
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // ignore
      }
    }
    // Sync theme with shop's preferred color
    if (shop.color && ['orange', 'emerald', 'violet'].includes(shop.color)) {
      setThemeState(shop.color as any)
      localStorage.setItem(THEME_KEY, shop.color)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setShops([])
    setCurrentShop(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const setTheme = useCallback((t: 'orange' | 'emerald' | 'violet') => {
    setThemeState(t)
    localStorage.setItem(THEME_KEY, t)
  }, [])

  return (
    <SessionContext.Provider
      value={{ user, shops, currentShop, theme, login, selectShop, logout, setTheme, loading }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

// Apply CSS variables for the active theme
function applyTheme(theme: 'orange' | 'emerald' | 'violet') {
  const root = document.documentElement
  const themes = {
    orange: {
      '--brand-from': '#f97316',
      '--brand-to': '#f43f5e',
      '--brand-solid': '#f97316',
      '--brand-soft': '#fff7ed',
      '--brand-text': '#c2410c',
      '--brand-ring': 'rgba(249, 115, 22, 0.35)',
    },
    emerald: {
      '--brand-from': '#10b981',
      '--brand-to': '#14b8a6',
      '--brand-solid': '#10b981',
      '--brand-soft': '#ecfdf5',
      '--brand-text': '#047857',
      '--brand-ring': 'rgba(16, 185, 129, 0.35)',
    },
    violet: {
      '--brand-from': '#8b5cf6',
      '--brand-to': '#d946ef',
      '--brand-solid': '#8b5cf6',
      '--brand-soft': '#f5f3ff',
      '--brand-text': '#6d28d9',
      '--brand-ring': 'rgba(139, 92, 246, 0.35)',
    },
  }
  const vars = themes[theme]
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  root.setAttribute('data-theme', theme)
}

// Helper hook to get the X-Shop-Id header value for fetch calls
export function useShopHeader() {
  const { currentShop } = useSession()
  return currentShop?.id || ''
}
