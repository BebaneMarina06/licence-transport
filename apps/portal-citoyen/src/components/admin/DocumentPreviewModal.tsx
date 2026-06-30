import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import type { ApplicationDocument } from '../../types'
import { DOCUMENT_LABELS } from '../../types'

type DocumentPreviewModalProps = {
  applicationId: number
  document: ApplicationDocument
  onClose: () => void
}

function isPreviewable(doc: ApplicationDocument) {
  const type = doc.content_type.toLowerCase()
  const name = doc.original_filename.toLowerCase()
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    /\.(jpe?g|png|webp|gif|pdf)$/i.test(name)
  )
}

function isPdf(doc: ApplicationDocument) {
  return (
    doc.content_type === 'application/pdf' || doc.original_filename.toLowerCase().endsWith('.pdf')
  )
}

function isImage(doc: ApplicationDocument) {
  return doc.content_type.startsWith('image/')
}

export function DocumentPreviewModal({ applicationId, document, onClose }: DocumentPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const downloadPath = `/api/v1/admin/applications/${applicationId}/documents/${document.id}/download`

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const blob = await api.fetchBlob(downloadPath, 'admin')
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Impossible de charger le document')
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
  }, [applicationId, document.id, downloadPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const previewable = isPreviewable(document)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-preview-title"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p id="document-preview-title" className="font-semibold text-slate-900 truncate">
              {DOCUMENT_LABELS[document.document_type]}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{document.original_filename}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => api.download(downloadPath, document.original_filename, 'admin')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0055a4] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} /> Télécharger
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
              <Loader2 size={28} className="animate-spin text-[#0055a4]" />
              <p className="text-sm">Chargement du document…</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-8 text-center text-red-600 text-sm">{error}</div>
          )}

          {!loading && !error && blobUrl && previewable && isPdf(document) && (
            <iframe
              src={blobUrl}
              title={document.original_filename}
              className="w-full h-[min(75vh,800px)] bg-white"
            />
          )}

          {!loading && !error && blobUrl && previewable && isImage(document) && (
            <div className="flex items-center justify-center p-6 min-h-[min(75vh,800px)]">
              <img
                src={blobUrl}
                alt={document.original_filename}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md bg-white"
              />
            </div>
          )}

          {!loading && !error && blobUrl && !previewable && (
            <div className="p-10 text-center text-slate-600 text-sm">
              Aperçu non disponible pour ce type de fichier. Utilisez le bouton Télécharger.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
