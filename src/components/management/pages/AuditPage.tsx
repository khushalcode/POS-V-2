'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Search, Trash2, Loader2, Filter, User, Store, LogIn, LogOut,
  Receipt, ShoppingCart, Settings as SettingsIcon, UserCog, ChefHat, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'
import { useShopFetch } from '@/hooks/use-shop-fetch'

interface AuditEntry {
  id: string
  shopId: string | null
  userId: string | null
  userName: string | null
  userRole: string | null
  action: string
  details: string | null
  ipAddress: string | null
  createdAt: string
}

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  login: { label: 'Login', icon: LogIn, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  logout: { label: 'Logout', icon: LogOut, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  order_create: { label: 'Order Created', icon: ShoppingCart, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  order_deleted: { label: 'Order Deleted', icon: Trash2, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  kot_send: { label: 'KOT Sent', icon: ChefHat, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  bill_generate: { label: 'Bill Generated', icon: Receipt, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  user_create: { label: 'User Created', icon: UserCog, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  user_edit: { label: 'User Edited', icon: UserCog, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  user_delete: { label: 'User Deleted', icon: UserCog, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  settings_update: { label: 'Settings Updated', icon: SettingsIcon, color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  zomato_push: { label: 'Zomato Pushed', icon: ShoppingCart, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  table_open: { label: 'Table Opened', icon: Store, color: 'bg-teal-100 text-teal-700 border-teal-200' },
  table_close: { label: 'Table Closed', icon: Store, color: 'bg-slate-100 text-slate-700 border-slate-200' },
}

export default function AuditPage() {
  const shopFetch = useShopFetch()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showClear, setShowClear] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (actionFilter !== 'all') params.set('action', actionFilter)
    params.set('limit', '500')
    const res = await shopFetch(`/api/audit?${params.toString()}`)
    const data = await res.json()
    setLogs(data.logs)
    setLoading(false)
  }, [shopFetch, actionFilter])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const filtered = logs.filter((l) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      l.userName?.toLowerCase().includes(term) ||
      l.action.toLowerCase().includes(term) ||
      l.details?.toLowerCase().includes(term)
    )
  })

  const handleClear = async () => {
    // Clear logs older than 30 days
    const before = new Date()
    before.setDate(before.getDate() - 30)
    const res = await shopFetch(`/api/audit?before=${before.toISOString()}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Cleared ${data.deleted} old log entries`)
      setShowClear(false)
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Audit Log</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">{logs.length} entries · Track who did what</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={actionFilter === 'order_deleted' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setActionFilter(actionFilter === 'order_deleted' ? 'all' : 'order_deleted')}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Deleted Orders ({logs.filter((l) => l.action === 'order_deleted').length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowClear(true)}>
            Clear Old
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md rounded-2xl p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Filter className="w-3 h-3" /> Action Type</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Search className="w-3 h-3" /> Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, action, details…"
              className="h-9"
            />
          </div>
        </div>
      </Card>

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No audit entries</h3>
          <p className="text-sm">User actions will appear here as they happen.</p>
        </Card>
      ) : (
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Time</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">User</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Action</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Details</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filtered.slice(0, 200).map((l) => {
                    const meta = ACTION_META[l.action] || { label: l.action, icon: Activity, color: 'bg-slate-100 text-slate-700 border-slate-200' }
                    const details = l.details ? (() => { try { return JSON.parse(l.details) } catch { return l.details } })() : null
                    return (
                      <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-brand-gradient flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                              {l.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-900 truncate">{l.userName || 'Unknown'}</p>
                              <p className="text-[9px] text-slate-400 uppercase">{l.userRole}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={`text-[10px] ${meta.color}`}>
                            <meta.icon className="w-3 h-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 hidden sm:table-cell max-w-xs truncate">
                          {typeof details === 'object' ? JSON.stringify(details) : details || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-400 hidden md:table-cell">{l.ipAddress || '—'}</td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <div className="p-3 text-center text-xs text-slate-400 bg-slate-50">
              Showing 200 of {filtered.length} entries. Use filters to narrow down.
            </div>
          )}
        </Card>
      )}

      {/* Clear confirm */}
      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500" />
              Clear Old Audit Logs
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            This will permanently delete all audit log entries older than <strong>30 days</strong>. Recent entries will be kept.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleClear}>Clear Old Logs</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
