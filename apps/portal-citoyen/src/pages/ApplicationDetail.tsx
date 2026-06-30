import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge, formatAmount, formatDate } from '../components/StatusBadge'
import { DocumentUploadSlot } from '../components/DocumentUpload'
import { LicensePreviewModal } from '../components/LicensePreviewModal'
import { api, ApiError } from '../lib/api'
import {
  ArrowLeft,
  Building2,
  Car,
  CreditCard,
  Download,
  Eye,
  Save,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
  Calendar,
} from 'lucide-react'
import type { Application, DeliveryFormat, DocumentUploadResult, PaymentQuote, PaymentResult } from '../types'
import { REQUIRED_DOCUMENTS } from '../types'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [form, setForm] = useState({ company_name: '', vehicle_plate: '', notes: '' })
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>('digital')
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState('airtel')
  const [paymentPending, setPaymentPending] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState('')
  const [ocrNotice, setOcrNotice] = useState('')
  const [showLicensePreview, setShowLicensePreview] = useState(false)

  const { data: application, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get<Application>(`/api/v1/applications/${id}`),
    enabled: !!id,
  })

  const { data: paymentQuotes = [] } = useQuery({
    queryKey: ['payment-quotes', id],
    queryFn: () => api.get<PaymentQuote[]>(`/api/v1/applications/${id}/payment-quote`),
    enabled: !!id && application?.status === 'awaiting_payment',
  })

  useEffect(() => {
    if (application) {
      setForm({
        company_name: application.company_name || '',
        vehicle_plate: application.vehicle_plate || '',
        notes: application.notes || '',
      })
    }
  }, [application])

  const handleDocumentUploaded = (result?: DocumentUploadResult) => {
    if (result?.ocr_applied?.length) {
      setOcrNotice(
        'Lecture automatique : des champs ont été pré-remplis — vérifiez-les avant de soumettre le dossier.',
      )
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch<Application>(`/api/v1/applications/${id}`, {
        company_name: form.company_name || null,
        vehicle_plate: form.vehicle_plate || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde')
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post<Application>(`/api/v1/applications/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      queryClient.invalidateQueries({ queryKey: ['my-applications'] })
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la soumission')
    },
  })

  const resubmitMutation = useMutation({
    mutationFn: () => api.post<Application>(`/api/v1/applications/${id}/resubmit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      queryClient.invalidateQueries({ queryKey: ['my-applications'] })
      setError('')
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la resoumission')
    },
  })

  const payMutation = useMutation({
    mutationFn: () =>
      api.post<PaymentResult>(`/api/v1/applications/${id}/pay`, {
        delivery_format: deliveryFormat,
        phone,
        operator,
      }),
    onSuccess: (result) => {
      setError('')
      setPaymentInfo(result.message)
      if (result.payment_status === 'pending') {
        setPaymentPending(true)
      } else {
        setPaymentPending(false)
        queryClient.invalidateQueries({ queryKey: ['application', id] })
        queryClient.invalidateQueries({ queryKey: ['my-applications'] })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    },
    onError: (err) => {
      setPaymentPending(false)
      console.error('[Paiement] Échec de l’initiation:', err)
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’initier le paiement. Réessayez plus tard.',
      )
    },
  })

  useEffect(() => {
    if (!paymentPending || !id) return

    let attempts = 0
    const maxAttempts = 40
    const timer = window.setInterval(async () => {
      attempts += 1
      try {
        const status = await api.get<{
          payment_status: string
          application_status: string
          message: string
        }>(`/api/v1/applications/${id}/payment-status`)

        setPaymentInfo(status.message)

        if (status.payment_status === 'completed') {
          setPaymentPending(false)
          queryClient.invalidateQueries({ queryKey: ['application', id] })
          queryClient.invalidateQueries({ queryKey: ['my-applications'] })
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
          window.clearInterval(timer)
        } else if (status.payment_status === 'failed' || attempts >= maxAttempts) {
          setPaymentPending(false)
          if (attempts >= maxAttempts) {
            setError('Délai dépassé. Vérifiez votre téléphone ou réessayez.')
          }
          window.clearInterval(timer)
        }
      } catch {
        if (attempts >= maxAttempts) {
          setPaymentPending(false)
          window.clearInterval(timer)
        }
      }
    }, 3000)

    return () => window.clearInterval(timer)
  }, [paymentPending, id, queryClient])

  if (isLoading) {
    return <p className="p-10 text-center text-slate-500 bg-[#f4f8fc] min-h-full">Chargement...</p>
  }
  if (!application) {
    return <p className="p-10 text-center text-red-600 bg-[#f4f8fc] min-h-full">Dossier introuvable</p>
  }

  const isDraft = application.status === 'draft'
  const isComplement = application.status === 'complement_requested'
  const isEditable = isDraft || isComplement
  const uploadedTypes = new Set((application.documents ?? []).map((d) => d.document_type))
  const allDocsUploaded = REQUIRED_DOCUMENTS.every((t) => uploadedTypes.has(t))
  const selectedQuote = paymentQuotes.find((q) => q.delivery_format === deliveryFormat)
  const hasLicense =
    application.issued_license && ['paid', 'delivered'].includes(application.status)
  const paymentReceivedPendingValidation =
    application.status === 'awaiting_payment' && application.amount_paid != null

  const isLandscapeReadOnly = !isEditable && application.status !== 'awaiting_payment'

  const documentsBlock = (
    <div className={isLandscapeReadOnly ? '' : 'mb-6'}>
      <h2 className="font-semibold text-slate-900 mb-4">Pièces justificatives</h2>
      {ocrNotice && (
        <p className="text-sm text-[#0055a4] bg-[#eef4fb] px-4 py-3 mb-4">{ocrNotice}</p>
      )}
      <div className="space-y-3">
        {REQUIRED_DOCUMENTS.map((docType) => (
          <DocumentUploadSlot
            key={docType}
            applicationId={application.id}
            documentType={docType}
            existing={application.documents?.find((d) => d.document_type === docType)}
            editable={isEditable}
            onUploaded={handleDocumentUploaded}
          />
        ))}
      </div>
      {isDraft && !allDocsUploaded && (
        <p className="text-amber-700 text-sm mt-3">
          Les 3 justificatifs sont obligatoires avant la soumission du dossier.
        </p>
      )}
    </div>
  )

  return (
    <div className="bg-[#f4f8fc] min-h-full">
      <div
        className={`mx-auto px-4 py-10 ${
          application.status === 'awaiting_payment' || isLandscapeReadOnly ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        <Link
          to="/espace"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#0055a4] mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Retour à mon espace
        </Link>

        <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,85,164,0.07)] mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#0055a4] bg-[#eef4fb] px-2 py-0.5">
                {application.license_type.code}
              </span>
              <h1 className="text-2xl font-bold text-slate-900 mt-2">{application.license_type.name}</h1>
              <p className="text-sm text-slate-400 font-mono mt-1">{application.reference}</p>
            </div>
            <StatusBadge status={application.status} amountPaid={application.amount_paid} />
          </div>
        </div>

        {isEditable ? (
          <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,85,164,0.07)] mb-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Informations du dossier</h2>
            <p className="text-sm text-slate-500">
              {isDraft
                ? 'Remplissez le formulaire à votre rythme. Enregistrez et revenez plus tard pour finaliser.'
                : 'Complétez les informations demandées puis resoumettez le dossier.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Raison sociale / Entreprise
              </label>
              <input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Immatriculation véhicule
              </label>
              <input
                value={form.vehicle_plate}
                onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })}
                placeholder="GA-123-AB"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Notes complémentaires
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 bg-[#0055a4] text-white px-5 py-2.5 text-sm font-medium hover:bg-[#003d75] disabled:opacity-50 transition-colors"
              >
                <Save size={16} />
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer le brouillon'}
              </button>
              {saveSuccess && <span className="text-sm text-[#009e60]">Brouillon enregistré</span>}
            </div>
          </div>
        ) : isLandscapeReadOnly ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 mb-6 items-start">
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={Building2} label="Entreprise" value={application.company_name || '—'} />
              <InfoCard icon={Car} label="Véhicule" value={application.vehicle_plate || '—'} />
              <InfoCard
                icon={Wallet}
                label="Frais de base"
                value={formatAmount(Number(application.license_type.fee_amount))}
                highlight
              />
              <InfoCard
                icon={Calendar}
                label="Soumis le"
                value={application.submitted_at ? formatDate(application.submitted_at) : 'Non soumis'}
              />
            </div>
            <div className="bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,85,164,0.07)]">
              {documentsBlock}
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <InfoCard icon={Building2} label="Entreprise" value={application.company_name || '—'} />
              <InfoCard icon={Car} label="Véhicule" value={application.vehicle_plate || '—'} />
              <InfoCard
                icon={Wallet}
                label="Frais de base"
                value={formatAmount(Number(application.license_type.fee_amount))}
                highlight
              />
              <InfoCard
                icon={Calendar}
                label="Soumis le"
                value={application.submitted_at ? formatDate(application.submitted_at) : 'Non soumis'}
              />
            </div>
            {documentsBlock}
          </>
        )}

        {isEditable && documentsBlock}

        {paymentReceivedPendingValidation && (
          <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(124,58,237,0.1)] mb-6 border-l-4 border-purple-500">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Paiement reçu</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Votre règlement de{' '}
                  <strong>{formatAmount(application.amount_paid!)}</strong> a bien été enregistré.
                  La DGTT valide votre paiement : votre licence sera disponible après confirmation.
                </p>
                {paymentInfo && (
                  <p className="text-sm text-slate-500 mt-2 bg-slate-50 px-3 py-2">{paymentInfo}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {application.status === 'awaiting_payment' && !paymentReceivedPendingValidation && (
          <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(124,58,237,0.1)] mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Paiement de la licence</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {application.submitted_at
                      ? 'Votre dossier a été validé par la DGTT. Choisissez le format et procédez au paiement.'
                      : 'Réglez les frais de licence pour finaliser et soumettre votre demande.'}
                  </p>
                </div>
              </div>
              {selectedQuote && (
                <div className="lg:text-right shrink-0">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Montant à régler</p>
                  <p className="text-2xl font-bold text-[#0055a4]">
                    {formatAmount(selectedQuote.total_amount)}
                  </p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(300px,360px)] gap-4 lg:gap-5 items-stretch">
              {paymentQuotes.map((quote) => (
                <button
                  key={quote.delivery_format}
                  type="button"
                  onClick={() => setDeliveryFormat(quote.delivery_format)}
                  className={`text-left p-5 h-full flex flex-col justify-between transition-all ${
                    deliveryFormat === quote.delivery_format
                      ? 'bg-[#eef4fb] ring-2 ring-[#0055a4]'
                      : 'bg-[#f8fafc] hover:bg-[#eef4fb]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {quote.delivery_format === 'digital' ? (
                        <Smartphone size={20} className="text-[#0055a4]" />
                      ) : (
                        <Truck size={20} className="text-amber-600" />
                      )}
                      <span className="font-semibold text-slate-900">
                        {quote.delivery_format === 'digital' ? 'Licence numérique' : 'Licence physique'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#0055a4]">
                      {formatAmount(quote.total_amount)}
                    </p>
                  </div>
                  {quote.delivery_format === 'physical' ? (
                    <p className="text-xs text-slate-500 mt-3">
                      Dont {formatAmount(quote.physical_surcharge)} de frais d'impression
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-3">
                      Téléchargement après validation du paiement par la DGTT
                    </p>
                  )}
                </button>
              ))}

              <div className="md:col-span-2 lg:col-span-1 flex flex-col justify-between bg-[#f8fafc] p-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Opérateur Mobile Money
                    </label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="airtel">Airtel Money</option>
                      <option value="moov">Moov Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Numéro de téléphone
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+241 06 XX XX XX"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="mt-5">
                  {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                  {paymentInfo && (
                    <p className="text-sm text-slate-600 mb-3 bg-white/70 px-3 py-2">{paymentInfo}</p>
                  )}
                  <button
                    onClick={() => payMutation.mutate()}
                    disabled={payMutation.isPending || paymentPending || !selectedQuote || !phone.trim()}
                    className="w-full bg-[#009e60] text-white px-6 py-3 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {payMutation.isPending || paymentPending
                      ? 'Paiement en cours...'
                      : `Payer ${selectedQuote ? formatAmount(selectedQuote.total_amount) : ''}`}
                  </button>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Paiement instantané BambooPay — validez sur votre téléphone avec votre code PIN.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasLicense && application.issued_license && (
          <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,158,96,0.12)] mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-[#009e60] flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">Licence disponible</h2>
                <p className="text-sm text-slate-600 mt-1">
                  N° <span className="font-mono font-medium">{application.issued_license.license_number}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Valide jusqu'au {formatDate(application.issued_license.expires_at)}
                </p>
                {application.delivery_format === 'physical' && application.status === 'paid' && (
                  <p className="text-xs text-amber-700 mt-2">
                    Votre carte physique est en cours de préparation. Le PDF est déjà disponible.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLicensePreview(true)}
                    className="inline-flex items-center gap-2 border border-[#009e60] text-[#009e60] px-5 py-2 text-sm font-medium hover:bg-emerald-50 transition-colors"
                  >
                    <Eye size={16} /> Visualiser la licence
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      api.download(
                        `/api/v1/applications/${application.id}/license/download`,
                        `${application.issued_license!.license_number}.pdf`,
                      )
                    }
                    className="inline-flex items-center gap-2 bg-[#009e60] text-white px-5 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Download size={16} /> Télécharger la licence (PDF)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {application.rejection_reason && (
          <div className="bg-red-50 text-red-800 p-5 mb-6">
            <p className="font-medium">Motif de rejet</p>
            <p className="text-sm mt-1">{application.rejection_reason}</p>
          </div>
        )}

        {isDraft && (
          <div className="bg-white p-5 shadow-[0_4px_20px_rgba(245,158,11,0.12)] mb-6">
            <p className="text-sm text-slate-600">
              Votre dossier est en brouillon. Joignez tous les documents puis procédez au paiement
              pour soumettre votre demande.
            </p>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !allDocsUploaded}
              className="mt-3 bg-[#009e60] text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitMutation.isPending ? 'Préparation...' : 'Soumettre et payer'}
            </button>
          </div>
        )}

        {isComplement && (
          <div className="bg-white p-5 shadow-[0_4px_20px_rgba(249,115,22,0.12)] mb-6">
            <p className="text-sm text-slate-600">
              Un complément d'information a été demandé. Modifiez votre dossier puis resoumettez-le.
            </p>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              onClick={() => resubmitMutation.mutate()}
              disabled={resubmitMutation.isPending || !allDocsUploaded}
              className="mt-3 bg-[#009e60] text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {resubmitMutation.isPending ? 'Envoi...' : 'Resoumettre le dossier'}
            </button>
          </div>
        )}

        {application.status_history && application.status_history.length > 0 && (
          <div className="bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,85,164,0.06)]">
            <h2 className="font-semibold text-slate-900 mb-5">Historique du dossier</h2>
            <div className="space-y-0">
              {[...application.status_history].reverse().map((h, i, arr) => (
                <div key={h.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 bg-[#0055a4] shrink-0 mt-1.5" />
                    {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[2rem]" />}
                  </div>
                  <div className={`pb-5 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                    <StatusBadge status={h.to_status} comment={h.comment} />
                    {h.comment && <p className="text-slate-600 text-sm mt-1.5">{h.comment}</p>}
                    <p className="text-xs text-slate-400 mt-1">{formatDate(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLicensePreview && application.issued_license && (
        <LicensePreviewModal
          applicationId={application.id}
          licenseNumber={application.issued_license.license_number}
          onClose={() => setShowLicensePreview(false)}
        />
      )}
    </div>
  )
}

function InfoCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Building2
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-white p-5 shadow-[0_4px_20px_rgba(0,85,164,0.06)]">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-[#0055a4]" />
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`font-semibold ${highlight ? 'text-[#0055a4] text-lg' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
