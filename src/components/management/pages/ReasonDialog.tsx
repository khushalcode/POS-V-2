'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'

export interface PendingDelete {
  /** Unique id of the record being deleted */
  id: string
  /** Human label shown in the dialog, e.g. "the ₹500 'Investment' entry" */
  label: string
}

interface ReasonDialogProps {
  /** When non-null, the dialog is open and asks for a reason for this delete */
  pending: PendingDelete | null
  /** Called with the typed reason when the user confirms. Return a Promise that
   *  rejects to keep the dialog open (e.g. when the server delete fails). */
  onConfirm: (id: string, reason: string) => Promise<void>
  /** Called when the user cancels / closes the dialog */
  onCancel: () => void
  /** Title of the entity being deleted, e.g. "Money In Entry" */
  entityLabel?: string
}

/**
 * ReasonDialog — asks the user to enter a reason before deleting a record.
 *
 * Used by Money In / Money Out / Expenses pages so every delete is auditable.
 * The reason is logged to the audit trail via the /api/audit endpoint.
 *
 * The dialog blocks the delete until a non-empty reason is provided; the
 * "Confirm Delete" button stays disabled until at least 4 characters are
 * typed, which discourages lazy "ok" / "." reasons.
 */
export function ReasonDialog({ pending, onConfirm, onCancel, entityLabel = 'entry' }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the textarea every time a new pending record arrives
  useEffect(() => {
    if (pending) setReason('')
  }, [pending?.id])

  const canConfirm = reason.trim().length >= 4 && !busy

  const handleConfirm = async () => {
    if (!pending || !canConfirm) return
    setBusy(true)
    try {
      await onConfirm(pending.id, reason.trim())
      // Parent will clear `pending` if successful
    } catch {
      // Keep dialog open so the user can retry
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Delete {entityLabel}?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {pending && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs">
              <p className="text-slate-700">
                You are about to delete <strong>{pending.label}</strong>.
              </p>
              <p className="text-slate-500 mt-1">
                This action is permanent. Please enter a reason — it will be
                recorded in the audit log for traceability.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Reason for deletion <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Entered by mistake, duplicate entry, wrong amount…"
              rows={3}
              autoFocus
              disabled={busy}
            />
            <p className="text-[10px] text-slate-400">
              Minimum 4 characters required.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
