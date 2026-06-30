import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Application } from '../../types'
import { StatusBadge, formatAmount, formatDate } from '../../components/StatusBadge'

function sortByPaidAtDesc(apps: Application[]) {
  return [...apps].sort((a, b) => {
    const aTime = a.paid_at ? new Date(a.paid_at).getTime() : 0
    const bTime = b.paid_at ? new Date(b.paid_at).getTime() : 0
    return bTime - aTime
  })
}

function PaymentsTable({ applications, emptyMessage }: { applications: Application[]; emptyMessage: string }) {
  if (applications.length === 0) {
    return <p className="px-5 py-6 text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <th className="px-5 py-3">Référence</th>
            <th className="px-5 py-3">Demandeur</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Montant</th>
            <th className="px-5 py-3">Format</th>
            <th className="px-5 py-3">Payé le</th>
            <th className="px-5 py-3">Licence</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-t border-slate-50 hover:bg-slate-50/80">
              <td className="px-5 py-3">
                <Link
                  to={`/admin/dossiers/${app.id}`}
                  className="font-mono text-xs font-medium text-[#0055a4] hover:underline"
                >
                  {app.reference}
                </Link>
              </td>
              <td className="px-5 py-3">
                <div>{app.applicant?.full_name ?? '—'}</div>
                {app.applicant?.email && (
                  <div className="text-xs text-slate-400">{app.applicant.email}</div>
                )}
              </td>
              <td className="px-5 py-3 text-slate-600">{app.license_type.name}</td>
              <td className="px-5 py-3">
                <StatusBadge status={app.status} amountPaid={app.amount_paid} />
              </td>
              <td className="px-5 py-3 font-medium">
                {app.amount_paid != null ? formatAmount(app.amount_paid) : '—'}
              </td>
              <td className="px-5 py-3 capitalize text-slate-600">
                {app.delivery_format === 'physical'
                  ? 'Physique'
                  : app.delivery_format === 'digital'
                    ? 'Numérique'
                    : '—'}
              </td>
              <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                {app.paid_at ? formatDate(app.paid_at) : '—'}
              </td>
              <td className="px-5 py-3 font-mono text-xs text-slate-600">
                {app.issued_license?.license_number ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['payments-queue'],
    queryFn: async () => {
      const [awaiting, paid, delivered] = await Promise.all([
        api.get<Application[]>('/api/v1/admin/applications?status=awaiting_payment'),
        api.get<Application[]>('/api/v1/admin/applications?status=paid'),
        api.get<Application[]>('/api/v1/admin/applications?status=delivered'),
      ])
      const awaitingWithPayment = awaiting.filter((app) => app.amount_paid != null)
      const confirmed = sortByPaidAtDesc([...paid, ...delivered])
      return { pending: awaitingWithPayment, confirmed }
    },
  })

  const pending = data?.pending ?? []
  const confirmed = data?.confirmed ?? []
  const isEmpty = !isLoading && pending.length === 0 && confirmed.length === 0

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] p-8 text-center text-slate-500">
          Chargement…
        </div>
      ) : isEmpty ? (
        <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] p-8 text-center text-slate-500">
          Aucun paiement enregistré pour le moment
        </div>
      ) : (
        <>
          <section className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">En attente de validation</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paiements Mobile Money reçus — confirmation backoffice requise
              </p>
            </div>
            <PaymentsTable
              applications={pending}
              emptyMessage="Aucun paiement en attente de validation"
            />
          </section>

          <section className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Paiements confirmés</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dossiers payés ou délivrés (licence émise)
              </p>
            </div>
            <PaymentsTable
              applications={confirmed}
              emptyMessage="Aucun paiement confirmé"
            />
          </section>
        </>
      )}
    </div>
  )
}
