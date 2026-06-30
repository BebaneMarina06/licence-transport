import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, FileUp, ScanText, Trash2, Upload } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { ApplicationDocument, DocumentType, DocumentUploadResult } from '../types'
import { DOCUMENT_LABELS } from '../types'

interface DocumentUploadProps {
  applicationId: number
  documentType: DocumentType
  existing?: ApplicationDocument
  editable: boolean
  onUploaded?: (result?: DocumentUploadResult) => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatOcrField(key: string, value: string) {
  const labels: Record<string, string> = {
    vehicle_plate: 'Immatriculation',
    company_name: 'Entreprise',
    technical_inspection_date: 'Visite technique',
    insurance_expiry: 'Expiration assurance',
  }
  return `${labels[key] ?? key} : ${value}`
}

export function DocumentUploadSlot({
  applicationId,
  documentType,
  existing,
  editable,
  onUploaded,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [ocrInfo, setOcrInfo] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('document_type', documentType)
      formData.append('file', file)
      return api.upload<DocumentUploadResult>(
        `/api/v1/applications/${applicationId}/documents`,
        formData,
      )
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['application', String(applicationId)] })
      setOcrInfo(result.ocr_message ?? null)
      onUploaded?.(result)
      setError('')
    },
    onError: (err) => {
      setOcrInfo(null)
      setError(err instanceof ApiError ? err.message : 'Erreur upload')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/api/v1/applications/${applicationId}/documents/${existing!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', String(applicationId)] })
      setOcrInfo(null)
      onUploaded?.()
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur suppression')
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    e.target.value = ''
  }

  const ocrFields = existing?.ocr_fields

  return (
    <div className="bg-[#eef4fb] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {existing ? (
            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
          ) : (
            <FileUp className="text-slate-400 shrink-0 mt-0.5" size={20} />
          )}
          <div>
            <p className="font-medium text-sm">{DOCUMENT_LABELS[documentType]}</p>
            {existing ? (
              <p className="text-xs text-slate-500 mt-1">
                {existing.original_filename} — {formatFileSize(existing.file_size)}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">PDF, JPG ou PNG — max 5 Mo</p>
            )}
            {ocrFields && Object.keys(ocrFields).length > 0 && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-[#0055a4]">
                <ScanText size={14} className="shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {Object.entries(ocrFields).map(([key, value]) => (
                    <p key={key}>{formatOcrField(key, value)}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="inline-flex items-center gap-1 text-xs bg-[#0055a4] text-white px-3 py-1.5 rounded-md hover:bg-[#003d75] disabled:opacity-50"
            >
              <Upload size={14} />
              {existing ? 'Remplacer' : 'Joindre'}
            </button>
            {existing && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1 text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />
      {ocrInfo && (
        <p className="text-xs text-[#0055a4] mt-2 bg-white/60 px-2 py-1.5 rounded">{ocrInfo}</p>
      )}
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  )
}
