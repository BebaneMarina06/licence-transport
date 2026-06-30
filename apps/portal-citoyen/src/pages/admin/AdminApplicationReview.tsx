import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Car,
  CreditCard,
  Download,
  Eye,
  FileText,
  MessageSquare,
  ShieldCheck,
  User,
  UserCheck,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { Application, ApplicationDocument, ApplicationStatus } from '../../types'
import { DOCUMENT_LABELS } from '../../types'
import { StatusBadge, formatAmount, formatDate } from '../../components/StatusBadge'
import { canMutateApplications, getStoredUser } from '../../lib/auth'
import { DocumentPreviewModal } from '../../components/admin/DocumentPreviewModal'

const ACTIONS: Record<
  ApplicationStatus,
  { next: ApplicationStatus; label: string; className: string }[]
> = {
  draft: [],
  submitted: [
    { next: 'under_review', label: 'Prendre en charge', className: 'bg-[#0055a4] hover:bg-[#003d75]' },
    { next: 'rejected', label: 'Rejeter', className: 'bg-red-600 hover:bg-red-700' },
  ],
  under_review: [
    { next: 'complement_requested', label: 'Demander un complément', className: 'bg-orange-500 hover:bg-orange-600' },
    { next: 'approved', label: 'Approuver', className: 'bg-emerald-600 hover:bg-emerald-700' },
    { next: 'rejected', label: 'Rejeter', className: 'bg-red-600 hover:bg-red-700' },
  ],
  complement_requested: [
    { next: 'under_review', label: 'Reprendre instruction', className: 'bg-[#0055a4] hover:bg-[#003d75]' },
    { next: 'rejected', label: 'Rejeter', className: 'bg-red-600 hover:bg-red-700' },
  ],
  approved: [
    { next: 'paid', label: 'Confirmer le paiement et délivrer', className: 'bg-teal-600 hover:bg-teal-700' },
  ],
  awaiting_payment: [
    { next: 'paid', label: 'Confirmer paiement', className: 'bg-teal-600 hover:bg-teal-700' },
  ],
  paid: [{ next: 'delivered', label: 'Délivrer la licence', className: 'bg-emerald-600 hover:bg-emerald-700' }],
  delivered: [],
  rejected: [],
  cancelled: [],
}

export function AdminApplicationReviewPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [previewDocument, setPreviewDocument] = useState<ApplicationDocument | null>(null)

  const { data: application, isLoading } = useQuery({
    queryKey: ['admin-application', id],
    queryFn: () => api.get<Application>(`/api/v1/admin/applications/${id}`),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { status: ApplicationStatus; comment?: string; rejection_reason?: string }) =>
      api.patch<Application>(`/api/v1/admin/applications/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-application', id] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setComment('')
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur')
    },
  })

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl animate-pulse space-y-6">
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="h-36 bg-white rounded-2xl border border-slate-100" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-white rounded-2xl border border-slate-100" />
          <div className="h-64 bg-white rounded-2xl border border-slate-100" />
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-red-600 font-medium">Dossier introuvable</p>
        <Link to="/admin/dossiers" className="inline-flex items-center gap-2 mt-4 text-sm text-[#0055a4] hover:underline">
          <ArrowLeft size={14} /> Retour aux dossiers
        </Link>
      </div>
    )
  }

  const actions = (ACTIONS[application.status] || []).filter(
    (action) => !(action.next === 'paid' && application.amount_paid == null),
  )
  const awaitingPaymentWithoutReceipt =
    application.status === 'awaiting_payment' && application.amount_paid == null
  const canMutate = canMutateApplications(getStoredUser('admin'))
  const showPayment =
    application.amount_paid != null ||
    application.delivery_format ||
    application.status === 'awaiting_payment' ||
    application.status === 'paid' ||
    application.status === 'delivered'

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl">
      <Link
        to="/admin/dossiers"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#0055a4] transition-colors mb-5"
      >
        <ArrowLeft size={16} />
        Retour aux dossiers
      </Link>

      {/* En-tête dossier */}
      <section className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-[0_2px_16px_rgba(0,85,164,0.06)] mb-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0055a4] via-[#0077cc] to-[#0055a4]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono tracking-wide text-slate-400">{application.reference}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                {application.license_type.name}
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Code {application.license_type.code} · Validité {application.license_type.validity_months} mois
              </p>
            </div>
            <StatusBadge status={application.status} amountPaid={application.amount_paid} />
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <MetaChip icon={Wallet} label="Tarif numérique" value={formatAmount(application.license_type.fee_amount)} />
            <MetaChip
              icon={CreditCard}
              label="Surcharge physique"
              value={formatAmount(application.license_type.physical_surcharge)}
            />
            {application.submitted_at && (
              <MetaChip icon={Calendar} label="Soumis le" value={formatDate(application.submitted_at)} />
            )}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          <Panel title="Informations du dossier">
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoTile
                icon={User}
                iconBg="bg-blue-50"
                iconColor="text-[#0055a4]"
                label="Demandeur"
                value={application.applicant?.full_name ?? 'Non renseigné'}
                sub={application.applicant?.email}
              />
              <InfoTile
                icon={Building2}
                iconBg="bg-slate-50"
                iconColor="text-slate-600"
                label="Entreprise"
                value={application.company_name || '—'}
              />
              <InfoTile
                icon={Car}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Véhicule"
                value={application.vehicle_plate || '—'}
              />
              <InfoTile
                icon={UserCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                label="Agent assigné"
                value={application.assigned_agent?.full_name ?? 'Non assigné'}
              />
            </div>
          </Panel>

          {application.notes && (
            <Panel title="Notes du demandeur" icon={MessageSquare}>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{application.notes}</p>
            </Panel>
          )}

          {application.rejection_reason && (
            <div className="rounded-2xl border border-red-100 bg-red-50/80 p-5">
              <p className="text-sm font-semibold text-red-800">Motif de rejet</p>
              <p className="text-sm text-red-700 mt-2 leading-relaxed">{application.rejection_reason}</p>
            </div>
          )}

          {showPayment && (
            <Panel title="Paiement" icon={CreditCard}>
              <div className="grid sm:grid-cols-3 gap-4">
                <PaymentStat
                  label="Montant réglé"
                  value={
                    application.amount_paid != null
                      ? formatAmount(application.amount_paid)
                      : application.status === 'awaiting_payment'
                        ? 'En attente'
                        : '—'
                  }
                  highlight={application.status === 'awaiting_payment'}
                />
                <PaymentStat
                  label="Format de délivrance"
                  value={
                    application.delivery_format === 'physical'
                      ? 'Physique'
                      : application.delivery_format === 'digital'
                        ? 'Numérique'
                        : '—'
                  }
                />
                <PaymentStat
                  label="Date de paiement"
                  value={application.paid_at ? formatDate(application.paid_at) : '—'}
                />
              </div>
              {application.status === 'awaiting_payment' && application.amount_paid == null && (
                <p className="mt-4 text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
                  Le citoyen doit régler les frais (
                  <strong>{formatAmount(application.license_type.fee_amount)}</strong> minimum) pour
                  finaliser et soumettre sa demande.
                </p>
              )}
              {application.status === 'submitted' && application.amount_paid != null && (
                <p className="mt-4 text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                  Paiement reçu à la soumission ({formatAmount(application.amount_paid)}). Après
                  approbation du dossier, confirmez le paiement pour délivrer la licence.
                </p>
              )}
              {application.status === 'awaiting_payment' && application.amount_paid != null && (
                <p className="mt-4 text-xs text-teal-800 bg-teal-50 rounded-lg px-3 py-2 border border-teal-100">
                  Paiement Mobile Money reçu ({formatAmount(application.amount_paid)}).
                  Confirmez le paiement pour débloquer la délivrance de la licence.
                </p>
              )}
              {(application.status === 'paid' || application.status === 'delivered') &&
                application.amount_paid != null && (
                  <p className="mt-4 text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                    Paiement confirmé ({formatAmount(application.amount_paid)}).
                    {application.status === 'delivered'
                      ? ' Licence délivrée au demandeur.'
                      : ' Licence émise — en attente de délivrance finale.'}
                  </p>
                )}
            </Panel>
          )}

          {application.issued_license && (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <ShieldCheck className="text-emerald-600" size={22} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Licence délivrée</h2>
                    <p className="text-sm font-mono text-emerald-800 mt-1">
                      {application.issued_license.license_number}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
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
                  className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <Download size={16} /> Télécharger le PDF
                </button>
              </div>
            </div>
          )}

          {application.documents && application.documents.length > 0 && (
            <Panel title="Pièces justificatives" icon={FileText}>
              <div className="space-y-3">
                {application.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-slate-50/80 border border-slate-100 px-4 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-[#0055a4]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{DOCUMENT_LABELS[doc.document_type]}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{doc.original_filename}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewDocument(doc)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-[#0055a4] px-3 py-1.5 rounded-lg hover:bg-white border border-slate-200 transition-colors"
                      >
                        <Eye size={14} /> Visualiser
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          api.download(
                            `/api/v1/admin/applications/${application.id}/documents/${doc.id}/download`,
                            doc.original_filename,
                            'admin',
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0055a4] hover:text-[#003d75] px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Download size={14} /> Télécharger
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6 lg:sticky lg:top-24">
          {canMutate && (actions.length > 0 || awaitingPaymentWithoutReceipt) && (
            <Panel title="Actions" className="border-[#0055a4]/10 ring-1 ring-[#0055a4]/5">
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Commentaire ou motif (requis pour un rejet)…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0055a4]/20 focus:border-[#0055a4]/40 resize-none"
              />
              {error && (
                <p className="text-red-600 text-sm mt-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              {awaitingPaymentWithoutReceipt && (
                <p className="text-sm text-amber-800 mt-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  Le citoyen n'a pas encore payé : la demande ne sera soumise qu'après règlement
                  Mobile Money.
                </p>
              )}
              <div className="flex flex-col gap-2 mt-4">
                {actions.map((action) => (
                  <button
                    key={action.next}
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        status: action.next,
                        comment: comment || undefined,
                        rejection_reason:
                          action.next === 'rejected' ? comment || 'Dossier rejeté' : undefined,
                      })
                    }
                    className={`${action.className} text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50`}
                  >
                    {statusMutation.isPending ? 'Traitement…' : action.label}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {application.status_history && application.status_history.length > 0 && (
            <Panel title="Historique">
              <ol className="relative space-y-0">
                {application.status_history.map((h, index) => (
                  <li key={h.id} className="relative pl-6 pb-6 last:pb-0">
                    {index < application.status_history!.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />
                    )}
                    <span className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#0055a4] shadow-sm" />
                    <div className="space-y-1.5">
                      <StatusBadge status={h.to_status} comment={h.comment} />
                      {h.comment && (
                        <p className="text-sm text-slate-600 leading-relaxed">{h.comment}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {h.changed_by_name ? `${h.changed_by_name} · ` : ''}
                        {formatDate(h.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>

      {previewDocument && application && (
        <DocumentPreviewModal
          applicationId={application.id}
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon?: typeof FileText
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,85,164,0.04)] p-5 sm:p-6 ${className}`}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
        {Icon && <Icon size={16} className="text-[#0055a4]" />}
        {title}
      </h2>
      {children}
    </section>
  )
}

function InfoTile({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: typeof User
  iconBg: string
  iconColor: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50/60 p-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5 break-words">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet
  label: string
  value: string
}) {
  return (
    <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm">
      <Icon size={14} className="text-[#0055a4] shrink-0" />
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function PaymentStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 ${highlight ? 'bg-purple-50 border border-purple-100' : 'bg-slate-50/80 border border-slate-100'}`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${highlight ? 'text-purple-800' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
