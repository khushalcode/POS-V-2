'use client'

import { useEffect, useState } from 'react'
import { initDB, isDbReady } from './client-db'

/**
 * useDbReady — Ensures the client-side SQLite (sql.js WASM) database is
 * initialized before any component reads or writes data.
 *
 * WHY THIS EXISTS:
 * All data access in this app goes through `client-data.ts` → `client-db.ts`,
 * which calls `getDB()`. If `initDB()` hasn't been awaited yet, `getDB()`
 * throws "Database not initialized. Call initDB() first."
 *
 * This was a long-standing bug: nothing in the page flow called `initDB()`
 * before the LoginScreen tried to log the user in. The bug was invisible in
 * dev (where the developer was usually already logged in via localStorage)
 * but broke the EXE on a fresh install.
 *
 * USAGE:
 *   const { ready, error } = useDbReady()
 *   if (!ready) return <LoadingSpinner />
 *   if (error) return <ErrorScreen message={error} />
 *   // safe to render children that call client-data functions
 */
export function useDbReady(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Fast path: DB already up (e.g. HMR re-render or route change)
    if (isDbReady()) {
      setReady(true)
      return
    }

    initDB()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        console.error('[useDbReady] initDB failed:', err)
        if (cancelled) return
        const msg =
          err?.message ||
          String(err) ||
          'Failed to initialize the local database. The sql.js WASM file may be missing or blocked.'
        setError(msg)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { ready, error }
}
