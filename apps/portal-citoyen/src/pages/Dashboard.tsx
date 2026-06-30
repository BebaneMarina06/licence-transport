import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  FileText,
  Plus,
  CreditCard,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { StatusBadge, formatDate } from '../components/StatusBadge'
import { getStoredUser } from '../lib/auth'
import type { Application, Notification } from '../types'

function actionLabel(status: Application['status'], amountPaid?: number | null) {
  switch (status) {
    case 'draft':
      return 'Reprendre'
    case 'awaiting_payment':
      return amountPaid == null ? 'Payer et soumettre' : 'Payer'
    case 'complement_requested':
      return 'Compléter'
    default:
      return 'Voir le dossier'
  }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

const IN_PROGRESS: Application['status'][] = [
  'submitted',
  'under_review',
  'complement_requested',
  'approved',
  'awaiting_payment',
  'paid',
]

export function DashboardPage() {
  const citizen = getStoredUser('citizen')
  const firstName = citizen?.full_name?.split(' ')[0] ?? ''

  const {
    data: applications,
    isLoading: loadingApps,
    isError: appsError,
    error: appsErrorDetail,
    refetch: refetchApps,
  } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => api.get<Application[]>('/api/v1/applications/mine'),
    retry: 1,
  })

  const apps = applications ?? []

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/v1/notifications/mine'),
  })

  const awaitingPayment = apps.filter((a) => a.status === 'awaiting_payment')
  const drafts = apps.filter((a) => a.status === 'draft')
  const inProgress = apps.filter((a) => IN_PROGRESS.includes(a.status))
  const delivered = apps.filter((a) => a.status === 'delivered')
  const unreadPaymentNotifs = notifications.filter(
    (n) => !n.is_read && n.title.includes('Paiement'),
  )

  const stats = [
    { label: 'Demandes', value: apps.length, icon: FileText, tone: 'text-[#0055a4] bg-[#eef4fb]' },
    { label: 'En cours', value: inProgress.length, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
    {
      label: 'À payer',
      value: awaitingPayment.length,
      icon: CreditCard,
      tone: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Licences',
      value: delivered.length,
      icon: ShieldCheck,
      tone: 'text-[#009e60] bg-emerald-50',
    },
  ]

  const hasAlerts = awaitingPayment.length > 0 || unreadPaymentNotifs.length > 0 || drafts.length > 0

  return (
    <div className="bg-[#f4f8fc]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0055a4] via-[#004a8f] to-[#003366] text-white">
        <div
          className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-[#009e60]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-20">
          <p className="text-blue-200 text-sm font-medium">{greeting()}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            {firstName ? `Bienvenue, ${firstName}` : 'Mon espace'}
          </h1>
          <p className="text-blue-100/90 mt-2 max-w-lg">
            Suivez vos demandes de licence et gérez vos paiements en toute simplicité.
          </p>
          <Link
            to="/nouvelle-demande"
            className="mt-6 inline-flex items-center gap-2 bg-white text-[#0055a4] px-5 py-3 rounded-xl font-semibold shadow-lg shadow-[#003366]/30 hover:bg-blue-50 hover:gap-3 transition-all"
          >
            <Plus size={18} /> Nouvelle demande
          </Link>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pb-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 -mt-12 relative z-10">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,85,164,0.08)] border border-white"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {hasAlerts && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {(awaitingPayment.length > 0 || unreadPaymentNotifs.length > 0) && (
              <div className="bg-white rounded-2xl p-5 flex items-start gap-3 border-l-4 border-purple-500 shadow-[0_4px_24px_rgba(124,58,237,0.08)]">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <CreditCard size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">Paiement requis</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {awaitingPayment.length === 1
                      ? 'Votre demande est validée. Procédez au paiement pour obtenir votre licence.'
                      : `${awaitingPayment.length} demandes en attente de paiement.`}
                  </p>
                  {awaitingPayment.slice(0, 3).map((app) => (
                    <Link
                      key={app.id}
                      to={`/dossier/${app.id}`}
                      className="inline-flex items-center gap-1 mt-2 mr-4 text-sm font-semibold text-[#0055a4] hover:gap-2 transition-all"
                    >
                      Payer {app.reference} <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="bg-white rounded-2xl p-5 flex items-start gap-3 border-l-4 border-amber-500 shadow-[0_4px_24px_rgba(245,158,11,0.08)]">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">Brouillons à finaliser</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Vous avez {drafts.length} demande{drafts.length > 1 ? 's' : ''} non soumise
                    {drafts.length > 1 ? 's' : ''}.
                  </p>
                  {drafts.slice(0, 3).map((app) => (
                    <Link
                      key={app.id}
                      to={`/dossier/${app.id}`}
                      className="inline-flex items-center gap-1 mt-2 mr-4 text-sm font-semibold text-[#0055a4] hover:gap-2 transition-all"
                    >
                      Reprendre {app.reference} <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Mes demandes</h2>
            {apps.length > 0 && (
              <span className="text-sm text-slate-400">
                {apps.length} dossier{apps.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loadingApps ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                  <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
                  <div className="h-5 w-2/3 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : appsError ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_24px_rgba(220,38,38,0.08)] border border-red-100">
              <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-slate-900">
                Impossible de charger vos demandes
              </h3>
              <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                {appsErrorDetail instanceof ApiError
                  ? appsErrorDetail.message
                  : 'Une erreur réseau est survenue.'}
              </p>
              <button
                type="button"
                onClick={() => refetchApps()}
                className="inline-flex items-center gap-2 mt-5 text-[#0055a4] font-semibold hover:underline"
              >
                <RefreshCw size={16} /> Réessayer
              </button>
            </div>
          ) : apps.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-[0_4px_24px_rgba(0,85,164,0.06)]">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-[#eef4fb] text-[#0055a4] flex items-center justify-center mb-4">
                <FileText size={28} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Aucune demande pour le moment</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                Lancez votre première demande de licence de transport, c'est rapide et entièrement
                en ligne.
              </p>
              <Link
                to="/nouvelle-demande"
                className="mt-5 inline-flex items-center gap-2 bg-[#0055a4] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#003d75] transition-colors"
              >
                <Plus size={18} /> Faire une demande
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {apps.map((app) => (
                <Link
                  key={app.id}
                  to={`/dossier/${app.id}`}
                  className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,85,164,0.06)] hover:shadow-[0_10px_36px_rgba(0,85,164,0.12)] hover:-translate-y-0.5 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs text-slate-400">{app.reference}</span>
                      <StatusBadge status={app.status} amountPaid={app.amount_paid} />
                    </div>
                    <p className="font-semibold text-slate-900 truncate">{app.license_type.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Créée le {formatDate(app.created_at)}
                      {app.submitted_at && ` · Soumise le ${formatDate(app.submitted_at)}`}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-[#0055a4]">
                    <span className="hidden sm:inline">{actionLabel(app.status, app.amount_paid)}</span>
                    <ChevronRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
