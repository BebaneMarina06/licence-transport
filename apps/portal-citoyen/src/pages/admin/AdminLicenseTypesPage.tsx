import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2, Pencil, Plus } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { refreshLicenseTypeData } from '../../lib/licenseTypeCache'
import { queryKeys } from '../../lib/queryKeys'
import type { LicenseType } from '../../types'
import { formatAmount } from '../../components/StatusBadge'

const ADMIN_REALM = 'admin' as const

const emptyForm = {
  code: '',
  name: '',
  name_en: '',
  description: '',
  description_en: '',
  fee_amount: 0,
  physical_surcharge: 50000,
  validity_months: 12,
  required_documents: '',
  is_active: true,
}

function validateForm(form: typeof emptyForm, isEdit: boolean): string | null {
  if (!isEdit && !form.code.trim()) return 'Le code est obligatoire.'
  if (!form.name.trim()) return 'Le nom (FR) est obligatoire.'
  if (form.validity_months < 1) return 'La validité doit être d\'au moins 1 mois.'
  if (form.fee_amount < 0 || form.physical_surcharge < 0) return 'Les montants ne peuvent pas être négatifs.'
  return null
}

export function AdminLicenseTypesPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<LicenseType | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data: types = [], isLoading } = useQuery({
    queryKey: queryKeys.adminLicenseTypes,
    queryFn: () =>
      api.get<LicenseType[]>('/api/v1/admin/referentials/license-types', ADMIN_REALM),
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const validationError = validateForm(form, !!editing)
      if (validationError) throw new ApiError(validationError, 400)

      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        name_en: form.name_en.trim() || null,
        description: form.description.trim() || null,
        description_en: form.description_en.trim() || null,
        required_documents: form.required_documents.trim() || null,
      }
      if (editing) {
        const { code: _, ...update } = payload
        return api.patch<LicenseType>(
          `/api/v1/admin/referentials/license-types/${editing.id}`,
          update,
          ADMIN_REALM,
        )
      }
      return api.post<LicenseType>(
        '/api/v1/admin/referentials/license-types',
        payload,
        ADMIN_REALM,
      )
    },
    onSuccess: async (saved) => {
      await refreshLicenseTypeData(queryClient)
      queryClient.setQueryData(queryKeys.adminLicenseTypes, (prev: LicenseType[] | undefined) => {
        if (!prev) return prev
        const idx = prev.findIndex((t) => t.id === saved.id)
        if (idx === -1) return [...prev, saved]
        const next = [...prev]
        next[idx] = saved
        return next
      })
      setEditing(null)
      setCreating(false)
      setForm(emptyForm)
      setError('')
      setSuccess(
        editing
          ? `Le type « ${saved.name} » a été mis à jour.`
          : `Le type « ${saved.name} » a été créé.`,
      )
    },
    onError: (err) => {
      setSuccess('')
      setError(err instanceof ApiError ? err.message : 'Erreur lors de l\'enregistrement')
    },
  })

  const openEdit = (lt: LicenseType) => {
    setSuccess('')
    setError('')
    setEditing(lt)
    setCreating(false)
    setForm({
      code: lt.code,
      name: lt.name,
      name_en: lt.name_en ?? '',
      description: lt.description ?? '',
      description_en: lt.description_en ?? '',
      fee_amount: lt.fee_amount,
      physical_surcharge: lt.physical_surcharge,
      validity_months: lt.validity_months,
      required_documents: lt.required_documents ?? '',
      is_active: lt.is_active,
    })
  }

  const openCreate = () => {
    setSuccess('')
    setError('')
    setCreating(true)
    setEditing(null)
    setForm(emptyForm)
  }

  const cancelForm = () => {
    setEditing(null)
    setCreating(false)
    setError('')
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <p className="text-sm text-slate-600">
          Gérez le catalogue des licences proposées aux citoyens : tarifs, durée de validité et
          pièces justificatives.
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-[#0055a4] text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-[#003d75] shrink-0"
        >
          <Plus size={16} /> Nouvelle licence
        </button>
      </div>

      {success && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      {(creating || editing) && (
        <div className="bg-white rounded-xl p-5 mb-6 shadow-[0_2px_12px_rgba(0,85,164,0.05)] border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">
            {editing ? `Modifier — ${editing.code}` : 'Ajouter un type de licence'}
          </h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Code *" disabled={!!editing}>
              <input
                disabled={!!editing}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ex. TAXI_URBAIN"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </Field>
            <Field label="Validité (mois) *">
              <input
                type="number"
                min={1}
                value={form.validity_months}
                onChange={(e) => setForm({ ...form, validity_months: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Nom (FR) *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Nom (EN)">
              <input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Tarif numérique (XAF) *">
              <input
                type="number"
                min={0}
                value={form.fee_amount}
                onChange={(e) => setForm({ ...form, fee_amount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Surcharge format physique (XAF)">
              <input
                type="number"
                min={0}
                value={form.physical_surcharge}
                onChange={(e) => setForm({ ...form, physical_surcharge: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description (FR)" className="sm:col-span-2">
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description (EN)" className="sm:col-span-2">
              <textarea
                rows={2}
                value={form.description_en}
                onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Pièces requises (séparées par des virgules)" className="sm:col-span-2">
              <input
                value={form.required_documents}
                onChange={(e) => setForm({ ...form, required_documents: e.target.value })}
                placeholder="carte_grise, visite_technique, assurance"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Type actif (visible sur le portail citoyen)
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#0055a4] text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-[#003d75] disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,85,164,0.05)] overflow-hidden border border-slate-100">
        {isLoading ? (
          <p className="p-8 text-center text-slate-500">Chargement…</p>
        ) : types.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-600 font-medium">Aucun type de licence configuré</p>
            <p className="text-sm text-slate-500 mt-1">
              Cliquez sur « Nouvelle licence » pour en ajouter un.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Libellé FR / EN</th>
                  <th className="px-5 py-3">Tarif</th>
                  <th className="px-5 py-3">Surcharge physique</th>
                  <th className="px-5 py-3">Validité</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {types.map((lt) => (
                  <tr key={lt.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono text-xs">{lt.code}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{lt.name}</p>
                      <p className="text-xs text-slate-400">{lt.name_en ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3">{formatAmount(lt.fee_amount)}</td>
                    <td className="px-5 py-3">{formatAmount(lt.physical_surcharge)}</td>
                    <td className="px-5 py-3">{lt.validity_months} mois</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          lt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {lt.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(lt)}
                        className="p-2 text-slate-500 hover:text-[#0055a4] rounded-lg hover:bg-blue-50"
                        title="Modifier"
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

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
