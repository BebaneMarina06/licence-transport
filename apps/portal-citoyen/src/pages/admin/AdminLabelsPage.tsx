import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { PlatformLabel } from '../../types'
import { formatDate } from '../../components/StatusBadge'

export function AdminLabelsPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PlatformLabel | null>(null)
  const [form, setForm] = useState({ label_fr: '', label_en: '', description: '' })

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['platform-labels'],
    queryFn: () => api.get<PlatformLabel[]>('/api/v1/admin/referentials/labels'),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch<PlatformLabel>(`/api/v1/admin/referentials/labels/${editing!.id}`, {
        label_fr: form.label_fr,
        label_en: form.label_en,
        description: form.description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-labels'] })
      queryClient.invalidateQueries({ queryKey: ['public-labels'] })
      setEditing(null)
      setError('')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur'),
  })

  const openEdit = (label: PlatformLabel) => {
    setEditing(label)
    setForm({
      label_fr: label.label_fr,
      label_en: label.label_en,
      description: label.description ?? '',
    })
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <p className="text-sm text-slate-500 mb-4">
        Libellés affichés sur le portail citoyen et le backoffice. Clés techniques en lecture seule.
      </p>

      {editing && (
        <div className="bg-white rounded-xl p-5 mb-6 shadow-[0_2px_12px_rgba(0,85,164,0.05)]">
          <h3 className="font-semibold mb-1">Modifier le libellé</h3>
          <p className="text-xs font-mono text-slate-400 mb-4">{editing.key}</p>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Français</label>
              <input
                value={form.label_fr}
                onChange={(e) => setForm({ ...form, label_fr: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">English</label>
              <input
                value={form.label_en}
                onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description interne</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#0055a4] text-white px-4 py-2 text-sm font-medium hover:bg-[#003d75] disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-slate-500">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3">Clé</th>
                  <th className="px-5 py-3">Catégorie</th>
                  <th className="px-5 py-3">FR</th>
                  <th className="px-5 py-3">EN</th>
                  <th className="px-5 py-3">Mis à jour</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label.id} className="border-t border-slate-50">
                    <td className="px-5 py-3 font-mono text-xs">{label.key}</td>
                    <td className="px-5 py-3 capitalize text-slate-500">{label.category}</td>
                    <td className="px-5 py-3">{label.label_fr}</td>
                    <td className="px-5 py-3 text-slate-600">{label.label_en}</td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                      {formatDate(label.updated_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(label)}
                        className="p-2 text-slate-500 hover:text-[#0055a4]"
                      >
                        <Pencil size={16} />
                      </button>
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
