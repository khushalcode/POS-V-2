'use client'

import { create } from 'zustand'

export type ManagementPage =
  | 'dashboard'
  | 'zomato'
  | 'menu'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'expenses'
  | 'moneyin'
  | 'moneyout'
  | 'reports'
  | 'settings'
  | 'users'
  | 'audit'
  | 'backup'

interface NavState {
  currentPage: ManagementPage
  setPage: (p: ManagementPage) => void
  sidebarOpen: boolean
  setSidebarOpen: (o: boolean) => void
}

export const useMgmtNav = create<NavState>((set) => ({
  currentPage: 'dashboard',
  setPage: (p) => set({ currentPage: p, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
}))
