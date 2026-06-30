import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { formatAmount } from '../components/StatusBadge'
import { DocumentUploadSlot } from '../components/DocumentUpload'
import type { Application } from '../types'
import { REQUIRED_DOCUMENTS } from '../types'
import { useLicenseTypes } from '../hooks/useLicenseTypes'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

const STEPS = ['Type de licence', 'Vos informations', 'Pièces justificatives']

export function NewApplicationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedType = searchParams.get('type')

  const { data: licenseTypes = [] } = useLicenseTypes()

  const [step, setStep] = useState(1)
  const [applicationId, setApplicationId] = useState<number | null>(null)
  const [form, setForm] = useState({
    license_type_id: preselectedType || '',
    company_name: '',
    vehicle_plate: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedType = licenseTypes.find((lt) => lt.id === Number(form.license_type_id))

  const { data: application, refetch: refetchApplication } = useQuery({
    queryKey: ['application', String(applicationId)],
    queryFn: () => api.get<Application>(`/api/v1/applications/${applicationId}`),
    enabled: !!applicationId && step === 3,
  })

  const uploadedTypes = new Set((application?.documents ?? []).map((d) => d.document_type))
  const allDocsUploaded = REQUIRED_DOCUMENTS.every((t) => uploadedTypes.has(t))

  const goNext = () => {
    setError('')
    if (!form.license_type_id) {
      setError('Veuillez sélectionner un type de licence')
      return
    }
    setStep(2)
  }

  const saveDraft = async (): Promise<Application> => {
    if (applicationId) {
      return api.patch<Application>(`/api/v1/applications/${applicationId}`, {
        company_name: form.company_name || null,
        vehicle_plate: form.vehicle_plate || null,
        notes: form.notes || null,
      })
    }
    return api.post<Application>('/api/v1/applications', {
      license_type_id: Number(form.license_type_id),
      company_name: form.company_name || null,
      vehicle_plate: form.vehicle_plate || null,
      notes: form.notes || null,
    })
  }

  const handleCreateDraftOnly = async () => {
    setError('')
    setLoading(true)
    try {
      const app = await saveDraft()
      queryClient.invalidateQueries({ queryKey: ['my-applications'] })
      navigate(`/dossier/${app.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const handleContinueToDocuments = async () => {
    setError('')
    setLoading(true)
    try {
      const app = await saveDraft()
      setApplicationId(app.id)
      queryClient.invalidateQueries({ queryKey: ['my-applications'] })
      setStep(3)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#f4f8fc] min-h-full">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          to="/espace"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#0055a4] mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Retour à mon espace
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Nouvelle demande</h1>
        <p className="text-slate-500 mb-8">
          Complétez les étapes pour initier votre dossier. Créez un brouillon ou téléversez vos
          documents directement.
        </p>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const num = i + 1
            const active = step === num
            const done = step > num
            return (
              <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 flex items-center justify-center text-sm font-semibold shrink-0 ${
                      done
                        ? 'bg-[#009e60] text-white'
                        : active
                          ? 'bg-[#0055a4] text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? <Check size={16} /> : num}
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium truncate hidden sm:block ${
                      active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 min-w-[8px] ${done ? 'bg-[#009e60]' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,85,164,0.07)]">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 mb-5">{error}</div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="license_type" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type de licence *
                </label>
                <select
                  id="license_type"
                  value={form.license_type_id}
                  onChange={(e) => setForm({ ...form, license_type_id: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Sélectionner...</option>
                  {licenseTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} — {formatAmount(Number(lt.fee_amount))}
                    </option>
                  ))}
                </select>
              </div>

              {selectedType && (
                <div className="bg-[#eef4fb] p-5 text-sm text-slate-700">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-[#0055a4]">
                        {selectedType.code}
                      </span>
                      <p className="font-semibold text-slate-900 mt-1">{selectedType.name}</p>
                    </div>
                    <span className="text-[#009e60] font-bold whitespace-nowrap">
                      {formatAmount(Number(selectedType.fee_amount))}
                    </span>
                  </div>
                  {selectedType.description && (
                    <p className="text-slate-500 mb-3">{selectedType.description}</p>
                  )}
                  {selectedType.required_documents && (
                    <>
                      <p className="font-medium text-slate-800 mb-2">Pièces à fournir (photocopies) :</p>
                      <ul className="space-y-1 text-slate-600">
                        {selectedType.required_documents.split(',').map((doc) => (
                          <li key={doc} className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-[#0055a4] shrink-0" />
                            {doc.trim()}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="text-xs text-slate-400 mt-3">
                    Formats acceptés : PDF, JPG, PNG (max 5 Mo par fichier).
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-2 bg-[#0055a4] text-white px-6 py-2.5 font-medium hover:bg-[#003d75] transition-colors"
                >
                  Continuer <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/espace')}
                  className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {selectedType && (
                <div className="bg-[#eef4fb] px-4 py-3 text-sm flex justify-between items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Licence sélectionnée</p>
                    <p className="font-medium text-slate-900">{selectedType.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-[#0055a4] hover:underline shrink-0"
                  >
                    Modifier
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Raison sociale / Entreprise
                </label>
                <input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="vehicle_plate" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Immatriculation véhicule
                </label>
                <input
                  id="vehicle_plate"
                  value={form.vehicle_plate}
                  onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                  placeholder="GA-123-AB"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notes complémentaires
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <p className="text-sm text-slate-500 pt-1">
                Choisissez de créer le brouillon maintenant ou d'ajouter vos documents tout de suite.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCreateDraftOnly}
                  disabled={loading}
                  className="bg-[#0055a4] text-white px-6 py-2.5 font-medium hover:bg-[#003d75] disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Création...' : 'Créer le brouillon'}
                </button>
                <button
                  type="button"
                  onClick={handleContinueToDocuments}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 bg-[#009e60] text-white px-6 py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Upload size={16} />
                  {loading ? 'Création...' : 'Téléverser les documents'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#0055a4] transition-colors"
              >
                <ArrowLeft size={16} />
                Retour
              </button>
            </div>
          )}

          {step === 3 && applicationId && (
            <div className="space-y-5">
              <div className="bg-[#eef4fb] px-4 py-3 text-sm">
                <p className="text-xs text-slate-500">Brouillon créé</p>
                <p className="font-medium text-slate-900">
                  {application?.reference ?? 'Chargement...'} — {selectedType?.name}
                </p>
              </div>

              <div>
                <h2 className="font-semibold text-slate-900 mb-1">Pièces justificatives</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Téléversez les 3 documents requis. Vous pourrez les modifier tant que le dossier
                  est en brouillon.
                </p>
                <div className="space-y-3">
                  {REQUIRED_DOCUMENTS.map((docType) => (
                    <DocumentUploadSlot
                      key={docType}
                      applicationId={applicationId}
                      documentType={docType}
                      existing={application?.documents?.find((d) => d.document_type === docType)}
                      editable
                      onUploaded={async () => {
                        const { data: app } = await refetchApplication()
                        if (app) {
                          setForm((f) => ({
                            ...f,
                            company_name: app.company_name || f.company_name,
                            vehicle_plate: app.vehicle_plate || f.vehicle_plate,
                            notes: app.notes || f.notes,
                          }))
                        }
                      }}
                    />
                  ))}
                </div>
                {!allDocsUploaded && (
                  <p className="text-amber-700 text-sm mt-3">
                    Les 3 justificatifs sont obligatoires avant le paiement et la soumission.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to={`/dossier/${applicationId}`}
                  className="text-center bg-[#0055a4] text-white px-6 py-2.5 font-medium hover:bg-[#003d75] transition-colors"
                >
                  {allDocsUploaded ? 'Soumettre et payer →' : 'Voir mon dossier →'}
                </Link>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
