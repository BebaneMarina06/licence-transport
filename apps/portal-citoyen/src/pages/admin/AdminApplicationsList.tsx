import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { canMutateApplications, getStoredUser } from '../../lib/auth'
import type { Application } from '../../types'
import { StatusBadge, formatDate } from '../../components/StatusBadge'
import { useLicenseTypes } from '../../hooks/useLicenseTypes'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'submitted', label: 'Soumis' },
  { value: 'under_review', label: 'En instruction' },
  { value: 'complement_requested', label: 'Complément demandé' },
  { value: 'approved', label: 'Approuvé' },
  { value: 'awaiting_payment', label: 'Attente paiement' },
  { value: 'paid', label: 'Payé' },
  { value: 'delivered', label: 'Délivré' },
  { value: 'rejected', label: 'Rejeté' },
]

export function AdminApplicationsListPage() {
  const user = getStoredUser('admin')
  const [searchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [mine, setMine] = useState(false)

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  const { data: licenseTypes = [] } = useLicenseTypes()

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', statusFilter, licenseTypeId, search, mine],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (licenseTypeId) params.set('license_type_id', licenseTypeId)
      if (search.trim()) params.set('search', search.trim())
      if (mine) params.set('mine', 'true')
      const qs = params.toString()
      return api.get<Application[]>(`/api/v1/admin/applications${qs ? `?${qs}` : ''}`)
    },
  })

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Référence, entreprise, immatriculation…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={licenseTypeId}
          onChange={(e) => setLicenseTypeId(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Tous les types</option>
          {licenseTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>
              {lt.name}
            </option>
          ))}
        </select>
        {canMutateApplications(user) && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
              className="rounded"
            />
            Mes dossiers
          </label>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-slate-500">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-5 py-3">Demandeur</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Soumis</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-t border-slate-50 hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-mono text-xs">{app.reference}</td>
                    <td className="px-5 py-3">
                      <p>{app.applicant?.full_name}</p>
                      <p className="text-xs text-slate-500">{app.applicant?.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{app.license_type.name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {app.assigned_agent?.full_name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={app.status} amountPaid={app.amount_paid} />
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {app.submitted_at ? formatDate(app.submitted_at) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/admin/dossiers/${app.id}`}
                        className="text-[#0055a4] font-medium hover:underline"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Aucun dossier trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
