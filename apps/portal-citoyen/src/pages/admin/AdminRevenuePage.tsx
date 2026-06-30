import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, TrendingUp, Wallet, Clock, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { RevenueEntry, RevenueSummary } from '../../types'
import { StatusBadge, formatAmount, formatDate } from '../../components/StatusBadge'

const STATE_FILTERS = [
  { value: '', label: 'Toutes les recettes' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'pending_validation', label: 'En attente validation' },
] as const

const REVENUE_STATE_LABELS: Record<RevenueEntry['revenue_state'], string> = {
  confirmed: 'Confirmée',
  pending_validation: 'En attente validation',
  other: 'Autre',
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Wallet
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_rgba(0,85,164,0.05)] border border-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export function AdminRevenuePage() {
  const [stateFilter, setStateFilter] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['revenue-summary'],
    queryFn: () => api.get<RevenueSummary>('/api/v1/admin/revenue/summary'),
  })

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['revenue-entries', stateFilter],
    queryFn: () => {
      const qs = stateFilter ? `?state=${stateFilter}` : ''
      return api.get<RevenueEntry[]>(`/api/v1/admin/revenue/entries${qs}`)
    },
  })

  const handleExport = async () => {
    setExportError('')
    setExporting(true)
    try {
      const qs = stateFilter ? `?state=${stateFilter}` : ''
      const date = new Date().toISOString().slice(0, 10)
      await api.exportFile(`/api/v1/admin/export/revenue${qs}`, `recettes_${date}.xlsx`)
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Recettes confirmées"
          value={loadingSummary ? '—' : formatAmount(summary?.total_confirmed ?? 0)}
          sub={
            summary
              ? `${summary.confirmed_count} paiement${summary.confirmed_count > 1 ? 's' : ''}`
              : undefined
          }
          icon={Wallet}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="Recettes du mois"
          value={loadingSummary ? '—' : formatAmount(summary?.confirmed_this_month ?? 0)}
          icon={TrendingUp}
          accent="bg-blue-50 text-[#0055a4]"
        />
        <KpiCard
          label="En attente validation"
          value={loadingSummary ? '—' : formatAmount(summary?.pending_validation_amount ?? 0)}
          sub={
            summary
              ? `${summary.pending_validation_count} dossier${summary.pending_validation_count > 1 ? 's' : ''}`
              : undefined
          }
          icon={Clock}
          accent="bg-amber-50 text-amber-600"
        />
        <KpiCard
          label="Attente paiement citoyen"
          value={loadingSummary ? '—' : String(summary?.awaiting_payment_count ?? 0)}
          sub="Dossiers sans règlement reçu"
          icon={CheckCircle2}
          accent="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Par type de licence</h2>
          </div>
          {loadingSummary ? (
            <p className="p-6 text-sm text-slate-500">Chargement…</p>
          ) : !summary?.by_license_type.length ? (
            <p className="p-6 text-sm text-slate-500">Aucune recette confirmée</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Opérations</th>
                  <th className="px-5 py-3">Montant</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_license_type.map((row) => (
                  <tr key={row.license_type_name} className="border-t border-slate-50">
                    <td className="px-5 py-3 font-medium">{row.license_type_name}</td>
                    <td className="px-5 py-3 text-slate-600">{row.count}</td>
                    <td className="px-5 py-3 font-medium">{formatAmount(row.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Par mois (12 derniers)</h2>
          </div>
          {loadingSummary ? (
            <p className="p-6 text-sm text-slate-500">Chargement…</p>
          ) : !summary?.by_month.length ? (
            <p className="p-6 text-sm text-slate-500">Aucune donnée mensuelle</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Mois</th>
                  <th className="px-5 py-3">Opérations</th>
                  <th className="px-5 py-3">Montant</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_month.map((row) => (
                  <tr key={row.month} className="border-t border-slate-50">
                    <td className="px-5 py-3 font-mono text-xs">{row.month}</td>
                    <td className="px-5 py-3 text-slate-600">{row.count}</td>
                    <td className="px-5 py-3 font-medium">{formatAmount(row.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Journal des recettes</h2>
            <p className="text-xs text-slate-500 mt-0.5">Détail de chaque règlement enregistré</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {STATE_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 bg-[#0055a4] text-white px-4 py-2 text-sm font-medium hover:bg-[#003d75] disabled:opacity-60"
            >
              <Download size={14} />
              {exporting ? 'Export…' : 'Export Excel'}
            </button>
          </div>
        </div>

        {exportError && (
          <p className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{exportError}</p>
        )}

        {loadingEntries ? (
          <p className="p-8 text-center text-slate-500">Chargement…</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Aucune recette pour ce filtre</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-5 py-3">Demandeur</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Montant</th>
                  <th className="px-5 py-3">État recette</th>
                  <th className="px-5 py-3">Statut dossier</th>
                  <th className="px-5 py-3">Payé le</th>
                  <th className="px-5 py-3">Réf. paiement</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.application_id} className="border-t border-slate-50 hover:bg-slate-50/80">
                    <td className="px-5 py-3">
                      <Link
                        to={`/admin/dossiers/${entry.application_id}`}
                        className="font-mono text-xs font-medium text-[#0055a4] hover:underline"
                      >
                        {entry.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{entry.applicant_name}</td>
                    <td className="px-5 py-3 text-slate-600">{entry.license_type_name}</td>
                    <td className="px-5 py-3 font-medium">{formatAmount(entry.amount)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          entry.revenue_state === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.revenue_state === 'pending_validation'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {REVENUE_STATE_LABELS[entry.revenue_state]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={entry.status} amountPaid={entry.amount} />
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {entry.paid_at ? formatDate(entry.paid_at) : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {entry.payment_reference ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
