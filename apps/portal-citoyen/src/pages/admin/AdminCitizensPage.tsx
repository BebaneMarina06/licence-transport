import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { api } from '../../lib/api'
import type { CitizenUser } from '../../types'
import { formatDate } from '../../components/StatusBadge'

export function AdminCitizensPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const { data: citizens = [], isLoading } = useQuery({
    queryKey: ['admin-citizens', debouncedSearch],
    queryFn: () => {
      const params = debouncedSearch
        ? `?search=${encodeURIComponent(debouncedSearch)}`
        : ''
      return api.get<CitizenUser[]>(`/api/v1/admin/citizens${params}`)
    },
  })

  const totalApplications = useMemo(
    () => citizens.reduce((sum, c) => sum + c.applications_count, 0),
    [citizens],
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {citizens.length} citoyen{citizens.length > 1 ? 's' : ''} inscrit
            {citizens.length > 1 ? 's' : ''}
            {citizens.length > 0 && ` · ${totalApplications} dossier(s) au total`}
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, e-mail, téléphone…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0055a4]/20 focus:border-[#0055a4]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-slate-500">Chargement…</p>
        ) : citizens.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-500">Aucun citoyen trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Citoyen</th>
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3">N° national</th>
                  <th className="px-5 py-3">Dossiers</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {citizens.map((citizen) => (
                  <tr key={citizen.id} className="border-t border-slate-50 hover:bg-slate-50/80">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{citizen.full_name}</p>
                      <p className="text-xs text-slate-400">{citizen.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {citizen.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">
                      {citizen.national_id ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {citizen.applications_count > 0 ? (
                        <Link
                          to={`/admin/dossiers?search=${encodeURIComponent(citizen.email)}`}
                          className="text-[#0055a4] font-medium hover:underline"
                        >
                          {citizen.applications_count} dossier
                          {citizen.applications_count > 1 ? 's' : ''}
                        </Link>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          citizen.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {citizen.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(citizen.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
