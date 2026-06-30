import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Application } from '../types'
import { StatusBadge, formatDate } from '../components/StatusBadge'
import { useState } from 'react'

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

export function ApplicationsListPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications', statusFilter],
    queryFn: () => {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      return api.get<Application[]>(`/api/v1/admin/applications${params}`)
    },
  })

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dossiers</h1>
          <p className="text-slate-600">File d'instruction des demandes</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-slate-500">Chargement...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Référence</th>
                <th className="text-left px-5 py-3 font-medium">Demandeur</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Véhicule</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
                <th className="text-left px-5 py-3 font-medium">Soumis</th>
                <th className="text-right px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{app.reference}</td>
                  <td className="px-5 py-3">
                    <p>{app.applicant?.full_name}</p>
                    <p className="text-xs text-slate-500">{app.applicant?.email}</p>
                  </td>
                  <td className="px-5 py-3">{app.license_type.name}</td>
                  <td className="px-5 py-3">{app.vehicle_plate || '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {app.submitted_at ? formatDate(app.submitted_at) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/dossiers/${app.id}`}
                      className="text-blue-600 font-medium hover:underline"
                    >
                      Traiter
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
        )}
      </div>
    </div>
  )
}
