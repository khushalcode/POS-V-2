'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { license as licenseApi } from '@/lib/client-data'
import { initDB } from '@/lib/client-db'

interface LicenseActivationScreenProps {
  onActivated: () => void
}

export function LicenseActivationScreen({ onActivated }: LicenseActivationScreenProps) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ valid: boolean; duration?: number; reason?: string; alreadyActivated?: boolean; daysLeft?: number } | null>(null)

  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState('')

  // Initialize DB on mount — but validation works even without DB (uses hardcoded list)
  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.warn('[LicenseScreen] DB init failed — license validation will use hardcoded list only:', e)
        setDbError('Local database unavailable — activation may not persist after restart.')
      })
  }, [])

  useEffect(() => {
    if (key.length < 10) { setPreview(null); return }
    const t = setTimeout(() => {
      setValidating(true)
      try {
        // Client-side license validation — uses hardcoded list FIRST,
        // so this works even if DB/WASM isn't ready (e.g. on APK first launch).
        const result = licenseApi.validate(key)
        setPreview(result)
      } catch (e) {
        console.error('[LicenseScreen] validate error:', e)
        setPreview(null)
      } finally { setValidating(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [key])

  const handleActivate = async () => {
    setError('')
    setLoading(true)
    try {
      // Client-side license activation — now async, initializes DB internally
      const result = await licenseApi.activate(key)
      if (result.error) {
        setError(result.error)
        return
      }
      // Also store in localStorage as backup (so user can still log in even if DB gets wiped)
      localStorage.setItem('thuso-license', JSON.stringify({
        key: key.trim().toUpperCase(),
        activatedAt: result.activatedAt,
        expiresAt: result.expiresAt,
      }))
      toast.success(`License activated! Valid for ${result.daysLeft} days.`)
      onActivated()
    } catch (e: any) {
      console.error('[LicenseScreen] activate error:', e)
      setError(e.message || 'Activation failed. Please check your key and try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose-500/20 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-2xl mx-auto mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Thuso</h1>
          <p className="text-sm text-slate-400 mt-1">License Activation Required</p>
        </div>
        <Card className="p-6 shadow-2xl border-slate-700 bg-slate-800/90 backdrop-blur">
          <div className="text-center mb-4">
            <Key className="w-10 h-10 text-orange-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Enter your license key</h2>
            <p className="text-xs text-slate-400 mt-1">Activate your copy to unlock all features. License is valid for 1 year from activation.</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">License Key</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="SSYNC-XXXX-XXXX-XXX" className="h-11 font-mono text-sm tracking-wider bg-slate-900 border-slate-600 text-white placeholder-slate-500" autoFocus />
              <AnimatePresence>
                {preview && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {preview.valid ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {preview.alreadyActivated ? `Already active — ${preview.daysLeft} days left` : `Valid key — ${preview.duration} days of access`}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {preview.reason === 'already_used' ? 'This key has already been used on another device' : preview.reason === 'expired' ? 'This license key has expired' : 'Invalid key'}
                      </div>
                    )}
                  </motion.div>
                )}
                {validating && !preview && <div className="flex items-center gap-1.5 text-xs text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</div>}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-rose-400 bg-rose-950/50 border border-rose-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </motion.div>
              )}
              {dbError && !error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/50 border border-amber-800 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{dbError}
                </motion.div>
              )}
            </AnimatePresence>
            <Button onClick={handleActivate} disabled={loading || !key || (preview !== null && !preview?.valid)} className="w-full h-11 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-semibold">
              {loading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Activating…</> : <><Key className="w-4 h-4 mr-1.5" /> Activate License</>}
            </Button>
          </div>
        </Card>
        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 1-year validity</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> One-time activation</span>
        </div>
      </motion.div>
    </div>
  )
}

// Expired license screen
export function LicenseExpiredScreen({ expiresAt, onReactivate }: { expiresAt: string; onReactivate: () => void }) {
  return (
    <div className="min-h-screen img-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">License Expired</h1>
        <p className="text-sm text-slate-400 mb-1">Your license expired on</p>
        <p className="text-sm font-semibold text-rose-400 mb-6">{new Date(expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <Card className="p-6 bg-slate-800/90 border-slate-700">
          <p className="text-sm text-slate-300 mb-4">To continue using Thuso, please enter a new license key.</p>
          <Button onClick={onReactivate} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white"><Key className="w-4 h-4 mr-1.5" /> Enter New License Key</Button>
        </Card>
      </motion.div>
    </div>
  )
}

// License check hook — uses client-side SQLite
export function useLicenseCheck() {
  const [status, setStatus] = useState<'loading' | 'active' | 'not_activated' | 'expired'>('loading')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        // Initialize the database first
        await initDB()

        // Check localStorage first (backup)
        const localActivation = localStorage.getItem('thuso-license')
        if (localActivation) {
          const parsed = JSON.parse(localActivation)
          const expiry = new Date(parsed.expiresAt)
          if (expiry > new Date()) {
            const remaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            setStatus('active'); setExpiresAt(parsed.expiresAt); setDaysLeft(remaining); return
          } else {
            setStatus('expired'); setExpiresAt(parsed.expiresAt)
            localStorage.removeItem('thuso-license'); return
          }
        }

        // Check local SQLite database
        const result = licenseApi.status()
        if (result.active) {
          setStatus('active'); setExpiresAt(result.expiresAt || null); setDaysLeft(result.daysLeft || null)
          localStorage.setItem('thuso-license', JSON.stringify({ key: 'db', activatedAt: result.activatedAt, expiresAt: result.expiresAt }))
        } else if (result.reason === 'expired') {
          setStatus('expired'); setExpiresAt(result.expiresAt || null)
        } else {
          setStatus('not_activated')
        }
      } catch {
        setStatus('not_activated')
      }
    }
    check()
  }, [])

  const recheck = () => {
    setStatus('loading')
    setTimeout(() => {
      try {
        const result = licenseApi.status()
        if (result.active) { setStatus('active'); setExpiresAt(result.expiresAt || null); setDaysLeft(result.daysLeft || null) }
        else { setStatus('not_activated') }
      } catch { setStatus('not_activated') }
    }, 100)
  }

  return { status, expiresAt, daysLeft, recheck }
}
