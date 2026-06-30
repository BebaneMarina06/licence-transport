import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError } from '../../lib/api'
import type { StaffUser, UserRole } from '../../types'
import { formatDate } from '../../components/StatusBadge'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Superviseur' },
  { value: 'admin', label: 'Administrateur' },
  { value: 'auditor', label: 'Auditeur' },
]

const ROLE_PERMISSIONS: { role: UserRole; permissions: string[] }[] = [
  {
    role: 'agent',
    permissions: ['Instruction des dossiers', 'Validation paiement', 'Délivrance licence'],
  },
  {
    role: 'supervisor',
    permissions: ['Toutes actions agent', 'Réaffectation des dossiers', 'Supervision des files'],
  },
  {
    role: 'admin',
    permissions: ['Accès complet', 'Gestion des utilisateurs', 'Paramétrage des référentiels'],
  },
  {
    role: 'auditor',
    permissions: ['Consultation dossiers', 'Reporting', 'Exports statistiques'],
  },
]

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'agent' as UserRole,
  })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => api.get<StaffUser[]>('/api/v1/admin/users'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post<StaffUser>('/api/v1/admin/users', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] })
      setForm({ email: '', password: '', full_name: '', role: 'agent' })
      setError('')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: Partial<StaffUser> }) =>
      api.patch<StaffUser>(`/api/v1/admin/users/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-users'] }),
  })

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
        <h3 className="font-semibold text-slate-900 mb-3">Habilitations par rôle</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ROLE_PERMISSIONS.map(({ role, permissions }) => (
            <div key={role} className="border border-slate-100 rounded-lg p-3">
              <p className="text-sm font-semibold capitalize text-[#0055a4] mb-2">{role}</p>
              <ul className="text-xs text-slate-600 space-y-1">
                {permissions.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
          {isLoading ? (
            <p className="p-8 text-center text-slate-500">Chargement…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-5 py-3">Rôle</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: user.id,
                            data: { role: e.target.value as UserRole },
                          })
                        }
                        className="text-sm border border-slate-200 rounded px-2 py-1 bg-white capitalize"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: user.id,
                            data: { is_active: !user.is_active },
                          })
                        }
                        className={`text-xs px-2 py-1 rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_rgba(0,85,164,0.05)] h-fit">
          <h3 className="font-semibold text-slate-900 mb-4">Provisionner un agent</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-3"
          >
            <input
              required
              placeholder="Nom complet"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-[#0055a4] text-white py-2.5 text-sm font-medium hover:bg-[#003d75] disabled:opacity-60"
            >
              Créer le compte
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
