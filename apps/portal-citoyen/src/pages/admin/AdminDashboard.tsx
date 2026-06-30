import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  CreditCard,
  CheckCircle,
  XCircle,
  Users,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '../../lib/api'
import type { Application, DashboardStats } from '../../types'
import { StatusBadge, formatAmount, formatDate } from '../../components/StatusBadge'

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: '#94a3b8' },
  submitted: { label: 'Soumis', color: '#3b82f6' },
  under_review: { label: 'En instruction', color: '#f59e0b' },
  complement_requested: { label: 'Complément', color: '#fb923c' },
  approved: { label: 'Approuvé', color: '#10b981' },
  awaiting_payment: { label: 'Attente paiement', color: '#a855f7' },
  paid: { label: 'Payé', color: '#14b8a6' },
  delivered: { label: 'Délivré', color: '#22c55e' },
  rejected: { label: 'Refusé', color: '#ef4444' },
  cancelled: { label: 'Annulé', color: '#6b7280' },
}

const TYPE_COLORS = ['#0055a4', '#2f7dc4', '#5fa0d9', '#009e60', '#34b97f', '#f59e0b', '#a855f7']

const statCards = [
  {
    key: 'total',
    label: 'Total dossiers',
    field: 'total_applications' as const,
    icon: FileText,
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#0055a4]',
    accent: 'border-[#0055a4]',
    link: '/admin/dossiers',
  },
  {
    key: 'review',
    label: 'En instruction',
    field: 'pending_review' as const,
    icon: Clock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accent: 'border-amber-400',
    link: '/admin/dossiers',
  },
  {
    key: 'payment',
    label: 'Attente paiement',
    field: 'awaiting_payment' as const,
    icon: CreditCard,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    accent: 'border-purple-400',
    link: '/admin/dossiers',
  },
  {
    key: 'delivered',
    label: 'Délivrés',
    field: 'delivered' as const,
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accent: 'border-emerald-400',
    link: '/admin/dossiers',
  },
  {
    key: 'rejected',
    label: 'Refusés',
    field: 'rejected' as const,
    icon: XCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    accent: 'border-red-400',
    link: '/admin/dossiers',
  },
  {
    key: 'citizens',
    label: 'Citoyens inscrits',
    field: 'total_citizens' as const,
    icon: Users,
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-600',
    accent: 'border-slate-300',
    link: null,
  },
]

export function AdminDashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/api/v1/admin/dashboard'),
  })

  const { data: recentApps = [], isLoading: loadingApps } = useQuery({
    queryKey: ['applications', 'recent'],
    queryFn: () => api.get<Application[]>('/api/v1/admin/applications'),
    select: (data) => data.slice(0, 5),
  })

  const pendingCount = stats?.pending_review ?? 0
  const overdueCount = stats?.overdue_count ?? 0

  const statusData = stats
    ? [
        {
          key: 'delivered',
          name: STATUS_META.delivered.label,
          value: stats.delivered,
          color: STATUS_META.delivered.color,
        },
        {
          key: 'rejected',
          name: STATUS_META.rejected.label,
          value: stats.rejected,
          color: STATUS_META.rejected.color,
        },
      ]
    : []
  const typeData = stats
    ? Object.entries(stats.applications_by_license_type)
        .filter(([, v]) => v > 0)
        .map(([typeName, count]) => ({ name: typeName, value: count }))
    : []

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-end mb-6">
        <Link
          to="/admin/dossiers"
          className="inline-flex items-center gap-2 bg-[#0055a4] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#003d75] transition-colors shadow-sm shadow-[#0055a4]/20"
        >
          <FileText size={16} />
          Tous les dossiers
          <ArrowRight size={14} />
        </Link>
      </div>

      {(pendingCount > 0 || overdueCount > 0) && (
        <div className="mb-5 flex flex-col sm:flex-row gap-3">
          {pendingCount > 0 && (
            <div className="flex-1 flex items-center gap-3 bg-amber-50/60 px-4 py-3 rounded-xl">
              <TrendingUp size={16} className="text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-slate-900 flex-1">
                {pendingCount} dossier{pendingCount > 1 ? 's' : ''} en instruction
              </p>
              <Link to="/admin/dossiers" className="text-xs font-medium text-[#0055a4] hover:underline">
                Traiter →
              </Link>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex-1 flex items-center gap-3 bg-red-50/60 px-4 py-3 rounded-xl">
              <Clock size={16} className="text-red-600 shrink-0" />
              <p className="text-sm font-semibold text-slate-900 flex-1">
                {overdueCount} dossier{overdueCount > 1 ? 's' : ''} en retard (&gt;7 j)
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
        {statCards.map(({ key, label, field, icon: Icon, iconBg, iconColor, accent, link }) => {
          const value = stats?.[field] ?? 0
          const card = (
            <div
              key={key}
              className={`bg-white rounded-xl px-3 py-3 border-l-[3px] ${accent} shadow-[0_2px_12px_rgba(0,85,164,0.05)] hover:shadow-[0_4px_16px_rgba(0,85,164,0.08)] transition-shadow`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-slate-900 tabular-nums leading-none">
                    {loadingStats ? '—' : value}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
                </div>
              </div>
            </div>
          )

          return link ? (
            <Link key={key} to={link} className="block">
              {card}
            </Link>
          ) : (
            card
          )
        })}
        <div className="bg-white rounded-xl px-3 py-3 border-l-[3px] border-emerald-500 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
          <p className="text-xs text-slate-500">Recettes totales</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {loadingStats ? '—' : formatAmount(stats?.total_revenue ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl px-3 py-3 border-l-[3px] border-teal-400 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
          <p className="text-xs text-slate-500">Recettes du mois</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {loadingStats ? '—' : formatAmount(stats?.revenue_this_month ?? 0)}
          </p>
        </div>
      </div>

      {(statusData.length > 0 || typeData.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {statusData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Répartition par statut</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const n = Number(value)
                      return [`${n} dossier${n > 1 ? 's' : ''}`, String(name)]
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      boxShadow: '0 4px 16px rgba(0,85,164,0.08)',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span className="text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {typeData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Volume par type de licence</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={typeData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,85,164,0.05)' }}
                    formatter={(value) => {
                      const n = Number(value)
                      return [`${n} dossier${n > 1 ? 's' : ''}`, 'Volume']
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      boxShadow: '0 4px 16px rgba(0,85,164,0.08)',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                    {typeData.map((entry, index) => (
                      <Cell key={entry.name} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {stats?.avg_processing_days != null && (
                <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                  Délai moyen de traitement : <strong>{stats.avg_processing_days} jours</strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Dossiers récents</h2>
              <p className="text-xs text-slate-500 mt-0.5">Les dernières demandes déposées</p>
            </div>
            <Link
              to="/admin/dossiers"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#0055a4] hover:underline"
            >
              Voir tout
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-2.5">Référence</th>
                  <th className="px-5 py-2.5">Demandeur</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5">Statut</th>
                  <th className="px-5 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {loadingApps ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Chargement…
                    </td>
                  </tr>
                ) : recentApps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <FileText size={32} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-500">Aucun dossier pour le moment</p>
                    </td>
                  </tr>
                ) : (
                  recentApps.map((app) => (
                    <tr
                      key={app.id}
                      className="border-t border-slate-50 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/admin/dossiers/${app.id}`}
                          className="font-mono text-xs font-medium text-[#0055a4] hover:underline"
                        >
                          {app.reference}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-800">
                        {app.applicant?.full_name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{app.license_type.name}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={app.status} amountPaid={app.amount_paid} />
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(app.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}
