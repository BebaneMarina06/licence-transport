import type { ApplicationStatus } from '../types'

const LABELS: Record<ApplicationStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  under_review: 'En instruction',
  complement_requested: 'Complément demandé',
  approved: 'Approuvé',
  awaiting_payment: 'En attente paiement',
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

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  )
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(date),
  )
}
