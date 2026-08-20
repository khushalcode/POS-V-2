'use client'

import { useState, useEffect } from 'react'

/**
 * useInstallCheck — trial + device lock.
 *
 * BEHAVIOR:
 * 1. First launch: compute device fingerprint, store it + install date in
 *    localStorage AND IndexedDB (redundant, harder to accidentally clear).
 *    App is now "locked" to this device.
 * 2. Subsequent launches: recompute fingerprint.
 *    - Match → app works (within 365-day trial).
 *    - No match → BLOCK ("This app is locked to another device").
 * 3. After 365 days → expired screen.
 *
 * The fingerprint is deterministic — based on immutable device
 * characteristics (UA, screen, CPU, memory, timezone, language).
 * So even if someone copies localStorage to a different device, the
 * recomputed fingerprint won't match → blocked.
 */
const INSTALL_KEY = 'thuso-install-date'
const FINGERPRINT_KEY = 'thuso-device-fingerprint'
const TRIAL_DAYS = 365

// ─── Device fingerprint computation ───────────────────────────
function collectDeviceComponents(): string[] {
  if (typeof window === 'undefined') return ['server']
  const nav = navigator as any
  return [
    nav.userAgent || '',
    nav.language || '',
    (nav.languages || []).join(','),
    nav.platform || '',
    String(nav.hardwareConcurrency || ''),
    String(nav.deviceMemory || ''),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(new Date().getTimezoneOffset()),
    nav.maxTouchPoints != null ? String(nav.maxTouchPoints) : '',
  ]
}

async function sha256(text: string): Promise<string> {
  if (typeof crypto?.subtle?.digest !== 'function') {
    // Fallback: simple djb2 hash (non-crypto, but consistent)
    let h = 5381
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
    return Math.abs(h).toString(36)
  }
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

async function computeFingerprint(): Promise<string> {
  const components = collectDeviceComponents()
  return sha256(components.join('|'))
}

// ─── IndexedDB persistence (redundant backup of fingerprint) ──
function openLockDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('thuso-lock', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('lock')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openLockDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('lock', 'readwrite')
      tx.objectStore('lock').put(value, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* ignore */ }
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openLockDB()
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction('lock', 'readonly')
      const req = tx.objectStore('lock').get(key)
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch { return null }
}

// ─── Main hook ────────────────────────────────────────────────
export function useInstallCheck() {
  const [status, setStatus] = useState<'loading' | 'active' | 'expired' | 'device_locked'>('loading')
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [installDate, setInstallDate] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    ;(async () => {
      // 1. Compute current device fingerprint
      const currentFp = await computeFingerprint()

      // 2. Read stored fingerprint from localStorage, fall back to IndexedDB
      let storedFp = localStorage.getItem(FINGERPRINT_KEY)
      if (!storedFp) {
        storedFp = await idbGet(FINGERPRINT_KEY)
        if (storedFp) localStorage.setItem(FINGERPRINT_KEY, storedFp)
      }

      // 3. First launch — lock this device
      if (!storedFp) {
        localStorage.setItem(FINGERPRINT_KEY, currentFp)
        await idbSet(FINGERPRINT_KEY, currentFp)

        const nowIso = new Date().toISOString()
        localStorage.setItem(INSTALL_KEY, nowIso)
        await idbSet(INSTALL_KEY, nowIso)

        if (cancelled) return
        setInstallDate(nowIso)
        setStatus('active')
        setDaysLeft(TRIAL_DAYS)
        return
      }

      // 4. Subsequent launch — verify device fingerprint matches
      if (storedFp !== currentFp) {
        if (cancelled) return
        setStatus('device_locked')
        setDaysLeft(null)
        return
      }

      // 5. Fingerprint matches — check trial expiry
      let storedDate = localStorage.getItem(INSTALL_KEY) || (await idbGet(INSTALL_KEY))
      if (!storedDate) {
        storedDate = new Date().toISOString()
        localStorage.setItem(INSTALL_KEY, storedDate)
        await idbSet(INSTALL_KEY, storedDate)
      }

      const installed = new Date(storedDate)
      const expiresAt = new Date(installed)
      expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS)
      const now = new Date()

      if (cancelled) return
      setInstallDate(storedDate)

      if (now < expiresAt) {
        const left = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        setStatus('active')
        setDaysLeft(left)
      } else {
        setStatus('expired')
        setDaysLeft(0)
      }
    })()

    return () => { cancelled = true }
  }, [])

  return { status, daysLeft, installDate }
}
