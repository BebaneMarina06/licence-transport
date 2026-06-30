import type { ApplicationStatus } from '../types'

const LABELS: Record<ApplicationStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  under_review: 'En instruction',
  complement_requested: 'Complément demandé',
  approved: 'Approuvé',
  awaiting_payment: 'En attente de paiement',
  paid: 'Payé',
  delivered: 'Délivré',
  rejected: 'Rejeté',
  cancelled: 'Annulé',
}

const COLORS: Record<ApplicationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-amber-100 text-amber-800',
  complement_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  awaiting_payment: 'bg-purple-100 text-purple-800',
  paid: 'bg-teal-100 text-teal-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

const PENDING_CONFIRMATION_COLOR = 'bg-violet-100 text-violet-800'

export function isAwaitingConfirmation(
  status: ApplicationStatus,
  options?: { amountPaid?: number | null; comment?: string | null },
): boolean {
  if (status !== 'awaiting_payment') return false
  if (options?.amountPaid != null) return true
  const comment = options?.comment?.toLowerCase() ?? ''
  return comment.includes('en attente de validation backoffice')
}

export function resolveStatusLabel(
  status: ApplicationStatus,
  options?: { amountPaid?: number | null; comment?: string | null },
): string {
  if (isAwaitingConfirmation(status, options)) {
    return 'En attente de confirmation'
  }
  return LABELS[status]
}

export function StatusBadge({
  status,
  amountPaid,
  comment,
}: {
  status: ApplicationStatus
  amountPaid?: number | null
  comment?: string | null
}) {
  const pendingConfirmation = isAwaitingConfirmation(status, { amountPaid, comment })
  const label = pendingConfirmation ? 'En attente de confirmation' : LABELS[status]
  const colorClass = pendingConfirmation ? PENDING_CONFIRMATION_COLOR : COLORS[status]

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

export function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(amount)
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}
