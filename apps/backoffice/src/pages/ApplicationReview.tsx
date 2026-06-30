import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Application, ApplicationStatus } from '../types'
import { DOCUMENT_LABELS } from '../types'
import { StatusBadge, formatDate } from '../components/StatusBadge'
import { Download, ShieldCheck } from 'lucide-react'

const ACTIONS: Record<ApplicationStatus, { next: ApplicationStatus; label: string; variant: string }[]> = {
  draft: [],
  submitted: [
    { next: 'under_review', label: 'Prendre en charge', variant: 'bg-blue-600' },
    { next: 'rejected', label: 'Rejeter', variant: 'bg-red-600' },
  ],
  under_review: [
    { next: 'complement_requested', label: 'Demander un complément', variant: 'bg-orange-600' },
    { next: 'approved', label: 'Approuver', variant: 'bg-green-600' },
    { next: 'rejected', label: 'Rejeter', variant: 'bg-red-600' },
  ],
  complement_requested: [
    { next: 'under_review', label: 'Reprendre instruction', variant: 'bg-blue-600' },
    { next: 'rejected', label: 'Rejeter', variant: 'bg-red-600' },
  ],
  approved: [{ next: 'awaiting_payment', label: 'Envoyer au paiement', variant: 'bg-purple-600' }],
  awaiting_payment: [{ next: 'paid', label: 'Confirmer paiement', variant: 'bg-teal-600' }],
  paid: [{ next: 'delivered', label: 'Délivrer la licence', variant: 'bg-green-600' }],
  delivered: [],
  rejected: [],
  cancelled: [],
}

export function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  const { data: application, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get<Application>(`/api/v1/admin/applications/${id}`),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { status: ApplicationStatus; comment?: string; rejection_reason?: string }) =>
      api.patch<Application>(`/api/v1/admin/applications/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setComment('')
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur')
    },
  })

  if (isLoading) return <p className="p-8 text-center">Chargement...</p>
  if (!application) return <p className="p-8 text-center text-red-600">Dossier introuvable</p>

  const actions = (ACTIONS[application.status] || []).filter(
    (action) =>
      !(
        application.status === 'awaiting_payment' &&
        action.next === 'paid' &&
        application.amount_paid == null
      ),
  )
  const awaitingPaymentWithoutReceipt =
    application.status === 'awaiting_payment' && application.amount_paid == null

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-mono text-slate-500">{application.reference}</p>
          <h1 className="text-2xl font-bold mt-1">{application.license_type.name}</h1>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card title="Demandeur" value={application.applicant?.full_name ?? '—'} sub={application.applicant?.email} />
        <Card title="Entreprise" value={application.company_name || '—'} />
        <Card title="Véhicule" value={application.vehicle_plate || '—'} />
        <Card title="Soumis le" value={application.submitted_at ? formatDate(application.submitted_at) : '—'} />
      </div>

      {application.notes && (
        <div className="bg-slate-50 border rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium">Notes du demandeur</p>
          <p className="text-slate-600 mt-1">{application.notes}</p>
        </div>
      )}

      {application.issued_license && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-green-600" size={22} />
              <div>
                <h2 className="font-semibold">Licence délivrée</h2>
                <p className="text-sm font-mono mt-1">{application.issued_license.license_number}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Expire le {formatDate(application.issued_license.expires_at)}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                api.download(
                  `/api/v1/admin/applications/${application.id}/license/download`,
                  `${application.issued_license!.license_number}.pdf`,
                )
              }
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      )}

      {application.documents && application.documents.length > 0 && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Pièces justificatives</h2>
          <div className="space-y-2">
            {application.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between text-sm border rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-medium">{DOCUMENT_LABELS[doc.document_type]}</p>
                  <p className="text-xs text-slate-500">{doc.original_filename}</p>
                </div>
                <button
                  onClick={() =>
                    api.download(
                      `/api/v1/admin/applications/${application.id}/documents/${doc.id}/download`,
                      doc.original_filename,
                    )
                  }
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                >
                  <Download size={14} /> Télécharger
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(actions.length > 0 || awaitingPaymentWithoutReceipt) && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Actions</h2>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Commentaire (optionnel)"
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
          />
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          {awaitingPaymentWithoutReceipt && (
            <p className="text-sm text-amber-700 mb-3 bg-amber-50 rounded-lg px-3 py-2">
              La confirmation du paiement sera possible une fois le règlement Mobile Money du
              citoyen enregistré.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.next}
                disabled={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    status: action.next,
                    comment: comment || undefined,
                    rejection_reason: action.next === 'rejected' ? comment || 'Dossier rejeté' : undefined,
                  })
                }
                className={`${action.variant} text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {application.status_history && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Historique</h2>
          <div className="space-y-3">
            {application.status_history.map((h) => (
              <div key={h.id} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-4">
                <div>
                  <StatusBadge status={h.to_status} />
                  {h.comment && <p className="text-slate-600 mt-1">{h.comment}</p>}
                  <p className="text-xs text-slate-400 mt-1">{formatDate(h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-slate-500 uppercase">{title}</p>
      <p className="font-medium mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
