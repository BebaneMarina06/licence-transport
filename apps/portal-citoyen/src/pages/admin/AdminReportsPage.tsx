import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { api, ApiError } from '../../lib/api'

export function AdminReportsPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'stats' | 'applications') => {
    setError('')
    setLoading(type)
    try {
      const date = new Date().toISOString().slice(0, 10)
      if (type === 'stats') {
        await api.exportFile('/api/v1/admin/export/stats', `statistiques_${date}.xlsx`)
      } else {
        await api.exportFile('/api/v1/admin/export/applications', `dossiers_${date}.xlsx`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export impossible')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl">
      {error && (
        <div className="mb-4 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="space-y-4">
        <ExportCard
          title="Statistiques globales"
          description="Indicateurs, recettes, délais et répartition par statut et type de licence (Excel)."
          icon={FileSpreadsheet}
          loading={loading === 'stats'}
          onExport={() => handleExport('stats')}
        />
        <ExportCard
          title="Liste des dossiers"
          description="Export complet de tous les dossiers avec statut, demandeur et montants (Excel)."
          icon={Download}
          loading={loading === 'applications'}
          onExport={() => handleExport('applications')}
        />
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Les exports sont générés au format Excel (.xlsx) avec mise en forme et libellés en français.
      </p>
    </div>
  )
}

function ExportCard({
  title,
  description,
  icon: Icon,
  loading,
  onExport,
}: {
  title: string
  description: string
  icon: typeof Download
  loading: boolean
  onExport: () => void
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_rgba(0,85,164,0.05)] flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0055a4] flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
        <button
          onClick={onExport}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-2 bg-[#0055a4] text-white px-4 py-2 text-sm font-medium hover:bg-[#003d75] disabled:opacity-60 transition-colors"
        >
          <Download size={14} />
          {loading ? 'Export en cours…' : 'Télécharger Excel'}
        </button>
      </div>
    </div>
  )
}
