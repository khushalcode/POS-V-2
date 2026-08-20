'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Edit, Trash2, UserCog, Loader2, Shield, Eye, EyeOff, Key, Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'
import { useShopFetch } from '@/hooks/use-shop-fetch'
import { useSession } from '@/lib/session'
import type { AppUser } from '@/lib/types'

interface UserWithShop extends AppUser {
  shopId: string | null
  shop?: { id: string; name: string; code: string; color: string } | null
}

export default function UsersPage() {
  const { user: currentUser } = useSession()
  const shopFetch = useShopFetch()
  const [users, setUsers] = useState<UserWithShop[]>([])
  const [shops, setShops] = useState<Array<{ id: string; name: string; code: string; color: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<UserWithShop | null>(null)
  const [resetUser, setResetUser] = useState<UserWithShop | null>(null)
  const [delUser, setDelUser] = useState<UserWithShop | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await shopFetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
      if (!currentUser?.shopId) {
        const sRes = await shopFetch('/api/shops')
        const sData = await sRes.json()
        setShops(sData.shops || [])
      }
    } catch (e) {
      console.error('[UsersPage] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [shopFetch, currentUser?.shopId])

  useEffect(() => { load() }, [load])

  const save = async (data: any) => {
    const isEdit = !!editUser
    const res = await shopFetch('/api/users', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(isEdit ? { ...data, id: editUser!.id } : data),
    })
    if (!res.ok) {
      const e = await res.json()
      toast.error(e.error || 'Failed to save')
      return
    }
    toast.success(isEdit ? 'User updated' : 'User created')
    setShowAdd(false)
    setEditUser(null)
    load()
  }

  const resetPassword = async (newPassword: string) => {
    if (!resetUser) return
    const res = await shopFetch('/api/users', {
      method: 'PUT',
      body: JSON.stringify({ id: resetUser.id, password: newPassword }),
    })
    if (!res.ok) {
      toast.error('Failed to reset password')
      return
    }
    toast.success(`Password reset for ${resetUser.name}`)
    setResetUser(null)
  }

  const del = async () => {
    if (!delUser) return
    const res = await shopFetch(`/api/users?id=${delUser.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete')
      return
    }
    toast.success('User deleted')
    setDelUser(null)
    load()
  }

  const isSuperAdmin = !currentUser?.shopId

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
          <p className="text-[10px] sm:text-sm text-slate-500">
            {users.length} users · {users.filter((u) => u.role === 'admin').length} admins ·{' '}
            {users.filter((u) => u.role === 'staff').length} staff ·{' '}
            {users.filter((u) => u.role === 'kitchen').length} kitchen
            {isSuperAdmin && ' · Super Admin view (all shops)'}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-sky-500 to-blue-500 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      {/* Info banner for super admin */}
      {isSuperAdmin && (
        <Card className="p-3 bg-sky-50 border-sky-200">
          <div className="flex items-center gap-2 text-xs text-sky-800">
            <Shield className="w-4 h-4 shrink-0" />
            <span>
              <strong>Super Admin mode:</strong> You can manage users across all shops. Use the shop selector when creating new users.
            </span>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 bg-white border-slate-200">
          <UserCog className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No users yet</h3>
          <p className="text-sm">Add admin & staff users for login access.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {users.map((u, i) => (
              <motion.div key={u.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: i * 0.03 }}>
                <Card className="border-0 shadow-md rounded-2xl hover:shadow-lg transition-all group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${
                          u.role === 'admin' ? 'bg-gradient-to-br from-sky-500 to-blue-600'
                          : u.role === 'kitchen' ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          : 'bg-gradient-to-br from-slate-400 to-slate-500'
                        }`}>
                          {u.role === 'admin' ? <Shield className="w-5 h-5" /> : u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm text-slate-900 truncate">{u.name}</h3>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditUser(u)} title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => setResetUser(u)} title="Reset password">
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => setDelUser(u)} title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={
                        u.role === 'admin' ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : u.role === 'kitchen' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                      }>
                        {u.role === 'admin' ? 'Administrator' : u.role === 'kitchen' ? 'Kitchen' : 'Staff'}
                      </Badge>
                      <Badge variant="outline" className={u.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {/* Shop badge */}
                    {u.shop ? (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Store className="w-3 h-3" />
                        <span>{u.shop.name}</span>
                        <Badge variant="outline" className="text-[8px] px-1 py-0">{u.shop.code}</Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700 border-violet-200">
                        Super Admin (all shops)
                      </Badge>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2">Added {formatDateTime(u.createdAt)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showAdd || !!editUser} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditUser(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <UserForm
            initial={editUser}
            shops={shops}
            isSuperAdmin={isSuperAdmin}
            onSubmit={save}
            onCancel={() => { setShowAdd(false); setEditUser(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <ResetPasswordDialog
        user={resetUser}
        onClose={() => setResetUser(null)}
        onConfirm={resetPassword}
      />

      {/* Delete confirm */}
      <Dialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete user</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Delete <strong>{delUser?.name}</strong> ({delUser?.email})?</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserForm({
  initial,
  shops,
  isSuperAdmin,
  onSubmit,
  onCancel,
}: {
  initial: UserWithShop | null
  shops: Array<{ id: string; name: string; code: string; color: string }>
  isSuperAdmin: boolean
  onSubmit: (d: any) => Promise<void>
  onCancel: () => void
}) {
  const [f, setF] = useState<{ name: string; email: string; password: string; role: 'admin' | 'staff' | 'kitchen'; active: boolean; shopId: string }>({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: (initial?.role as 'admin' | 'staff' | 'kitchen') || 'staff',
    active: initial?.active ?? true,
    shopId: initial?.shopId || (shops[0]?.id ?? ''),
  })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!f.name || !f.email) {
      toast.error('Name and email required')
      return
    }
    if (!initial && !f.password) {
      toast.error('Password required for new user')
      return
    }
    setSaving(true)
    try {
      const payload: any = { ...f }
      if (initial && !f.password) delete payload.password
      await onSubmit(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Email</Label>
        <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="user@restaurant.com" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{initial ? 'New Password (leave blank to keep current)' : 'Password'}</Label>
        <div className="relative">
          <Input
            type={showPass ? 'text' : 'password'}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Role</Label>
          <Select value={f.role} onValueChange={(v: string) => setF({ ...f, role: v as 'admin' | 'staff' | 'kitchen' })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="kitchen">Kitchen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex items-end">
          <div className="flex items-center gap-2 pb-1">
            <Switch checked={f.active} onCheckedChange={(c) => setF({ ...f, active: c })} id="active" />
            <Label htmlFor="active" className="text-xs cursor-pointer">Active</Label>
          </div>
        </div>
      </div>
      {/* Shop selector (super admin only) */}
      {isSuperAdmin && shops.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Assign to Shop</Label>
          <Select value={f.shopId} onValueChange={(v) => setF({ ...f, shopId: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {shops.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-400">Super admin can assign users to any shop. Leave as-is to keep current shop.</p>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1 bg-gradient-to-r from-sky-500 to-blue-500 text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          {initial ? 'Update' : 'Add'} User
        </Button>
      </div>
    </div>
  )
}

function ResetPasswordDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: UserWithShop | null
  onClose: () => void
  onConfirm: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (!password || password.length < 4) {
      toast.error('Password must be at least 4 characters')
      return
    }
    setSaving(true)
    try {
      await onConfirm(password)
      setPassword('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) { onClose(); setPassword('') } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-500" />
            Reset Password
          </DialogTitle>
        </DialogHeader>
        {user && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">User</p>
              <p className="font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" onClick={() => { onClose(); setPassword('') }}>Cancel</Button></DialogClose>
              <Button onClick={confirm} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Reset Password
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
