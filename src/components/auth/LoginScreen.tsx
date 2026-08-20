'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UtensilsCrossed, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useSession, type SessionUser, type Shop } from '@/lib/session'
import { auth } from '@/lib/client-data'

interface LoginScreenProps {
  onLoggedOut: () => void
}

export function LoginScreen({ onLoggedOut }: LoginScreenProps) {
  const { login } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Client-side auth — checks local SQLite database
      const result = auth.login(email, password)
      if (!result) {
        setError('Invalid credentials')
        return
      }
      toast.success(`Welcome back, ${result.user.name}!`)
      login(result.user as SessionUser, result.shops as Shop[])
      onLoggedOut()
    } catch (e: any) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose-200/40 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-2xl mx-auto mb-3">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-lg">Thuso</h1>
          <p className="text-sm text-slate-300 mt-1">Multi-shop restaurant management</p>
        </div>
        <Card className="p-6 shadow-2xl border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" className="pl-9 h-11 bg-slate-800/60 border-slate-700 text-white placeholder-slate-500" required autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 pr-10 h-11 bg-slate-800/60 border-slate-700 text-white placeholder-slate-500" required />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/50 border border-rose-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </motion.div>
              )}
            </AnimatePresence>
            <Button type="submit" disabled={loading || !email || !password} className="w-full h-11 bg-brand-gradient text-white hover:opacity-90 font-semibold">
              {loading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Signing in…</> : <>Sign In <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </form>
        </Card>
        <p className="text-center text-[10px] text-slate-500 mt-4">Super Admin login · Multi-shop restaurant management</p>
      </motion.div>
    </div>
  )
}
