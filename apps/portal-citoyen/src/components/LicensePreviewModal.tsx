import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'

type LicensePreviewModalProps = {
  applicationId: number
  licenseNumber: string
  onClose: () => void
}

export function LicensePreviewModal({
  applicationId,
  licenseNumber,
  onClose,
}: LicensePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const downloadPath = `/api/v1/applications/${applicationId}/license/download`
  const filename = `${licenseNumber}.pdf`

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const blob = await api.fetchBlob(downloadPath)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Impossible de charger la licence')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [applicationId, downloadPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-preview-title"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p id="license-preview-title" className="font-semibold text-slate-900">
              Licence de transport
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{licenseNumber}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => api.download(downloadPath, filename)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#009e60] hover:bg-emerald-50 px-3 py-1.5 transition-colors"
            >
              <Download size={14} /> Télécharger
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
              <Loader2 size={28} className="animate-spin text-[#009e60]" />
              <p className="text-sm">Chargement de la licence…</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-8 text-center text-red-600 text-sm">{error}</div>
          )}

          {!loading && !error && blobUrl && (
            <iframe
              src={blobUrl}
              title={`Licence ${licenseNumber}`}
              className="w-full h-[min(75vh,800px)] bg-white"
            />
          )}
        </div>
      </div>
    </div>
  )
}
