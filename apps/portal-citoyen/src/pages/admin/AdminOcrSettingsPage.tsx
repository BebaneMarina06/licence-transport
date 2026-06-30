import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ScanText } from 'lucide-react'
import { api, ApiError } from '../../lib/api'

const ADMIN_REALM = 'admin' as const

interface OcrSettings {
  enabled: boolean
}

export function AdminOcrSettingsPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ocr-settings'],
    queryFn: () => api.get<OcrSettings>('/api/v1/admin/referentials/settings/ocr', ADMIN_REALM),
  })

  const saveMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<OcrSettings>(
        '/api/v1/admin/referentials/settings/ocr',
        { enabled },
        ADMIN_REALM,
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(['ocr-settings'], result)
      setError('')
      setSuccess(
        result.enabled
          ? 'Lecture automatique OCR activée pour les nouveaux dépôts de documents.'
          : 'Lecture automatique OCR désactivée.',
      )
    },
    onError: (err) => {
      setSuccess('')
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la mise à jour')
    },
  })

  if (isLoading) {
    return <p className="px-4 sm:px-6 lg:px-8 py-8 text-slate-500">Chargement…</p>
  }

  const enabled = data?.enabled ?? false

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_12px_rgba(0,85,164,0.05)] p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#eef4fb] text-[#0055a4] flex items-center justify-center shrink-0">
            <ScanText size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Lecture automatique (OCR)</h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Lorsque cette option est activée, les pièces justificatives déposées par les citoyens
              (carte grise, visite technique, assurance) sont analysées pour pré-remplir
              l&apos;immatriculation, l&apos;entreprise et certaines dates.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Nécessite Tesseract OCR installé sur le serveur API pour les scans et images. Les PDF
              textuels sont lus directement.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <p className="font-medium text-slate-900">OCR des documents citoyens</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {enabled ? 'Activé — analyse à chaque upload' : 'Désactivé — saisie manuelle uniquement'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(!enabled)}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
              enabled ? 'bg-[#009e60]' : 'bg-slate-300'
            } disabled:opacity-60`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="mt-4 text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">{success}</p>
        )}
      </div>
    </div>
  )
}
