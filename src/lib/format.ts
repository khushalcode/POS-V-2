// Format helpers for currency, dates and labels

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  sent: 'Sent to Kitchen',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  billed: 'Billed',
  paid: 'Paid',
}

export const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  open: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-amber-100 text-amber-800 border-amber-200',
  preparing: 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  served: 'bg-violet-100 text-violet-800 border-violet-200',
  billed: 'bg-orange-100 text-orange-800 border-orange-200',
  paid: 'bg-slate-100 text-slate-600 border-slate-200',
}

export const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  preparing: 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  served: 'bg-violet-100 text-violet-800 border-violet-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
}
