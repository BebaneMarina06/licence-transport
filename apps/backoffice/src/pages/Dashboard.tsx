import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Clock, CreditCard, CheckCircle, XCircle, Users } from 'lucide-react'
import { api } from '../lib/api'
import type { Application, DashboardStats } from '../types'
import { StatusBadge, formatDate } from '../components/StatusBadge'

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/api/v1/admin/dashboard'),
  })

  const { data: recentApps = [] } = useQuery({
    queryKey: ['applications', 'recent'],
    queryFn: () => api.get<Application[]>('/api/v1/admin/applications'),
    select: (data) => data.slice(0, 5),
  })

  const cards = [
    { label: 'Total dossiers', value: stats?.total_applications ?? 0, icon: FileText, color: 'bg-blue-500' },
    { label: 'En instruction', value: stats?.pending_review ?? 0, icon: Clock, color: 'bg-amber-500' },
    { label: 'Attente paiement', value: stats?.awaiting_payment ?? 0, icon: CreditCard, color: 'bg-purple-500' },
    { label: 'Délivrés', value: stats?.delivered ?? 0, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Rejetés', value: stats?.rejected ?? 0, icon: XCircle, color: 'bg-red-500' },
    { label: 'Citoyens inscrits', value: stats?.total_citizens ?? 0, icon: Users, color: 'bg-slate-500' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="text-slate-600 mt-1">Vue d'ensemble des licences de transport</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-5 flex items-center gap-4">
            <div className={`${color} text-white p-3 rounded-lg`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white border rounded-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold">Dossiers récents</h2>
          <Link to="/dossiers" className="text-sm text-blue-600 hover:underline">
            Voir tout →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Référence</th>
              <th className="text-left px-5 py-3 font-medium">Demandeur</th>
              <th className="text-left px-5 py-3 font-medium">Type</th>
              <th className="text-left px-5 py-3 font-medium">Statut</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {recentApps.map((app) => (
              <tr key={app.id} className="border-t hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link to={`/dossiers/${app.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                    {app.reference}
                  </Link>
                </td>
                <td className="px-5 py-3">{app.applicant?.full_name ?? '—'}</td>
                <td className="px-5 py-3">{app.license_type.name}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-5 py-3 text-slate-600">{formatDate(app.created_at)}</td>
              </tr>
            ))}
            {recentApps.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Aucun dossier pour le moment
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
