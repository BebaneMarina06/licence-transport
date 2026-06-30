import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Shield, Clock, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { formatAmount } from '../components/StatusBadge'
import { getStoredUser } from '../lib/auth'
import { getLanguage } from '../lib/i18n'
import { useLicenseTypes } from '../hooks/useLicenseTypes'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function HomePage() {
  const user = getStoredUser('citizen')
  const lang = getLanguage()
  const {
    data: licenseTypes = [],
    isLoading,
    isError,
    refetch,
  } = useLicenseTypes(lang)

  const { data: labelsData } = useQuery({
    queryKey: ['public-labels', lang],
    queryFn: () =>
      api.get<{ labels: Record<string, string> }>(`/api/v1/labels?lang=${lang}`),
  })

  const t = (key: string, fallback: string) => labelsData?.labels[key] ?? fallback
  const featureCards = [
    {
      icon: FileText,
      title: 'Démarche guidée',
      desc: 'Un parcours clair, étape par étape, pour déposer votre demande sans confusion.',
    },
    {
      icon: Clock,
      title: 'Suivi continu',
      desc: "Consultez l'avancement de votre dossier et les actions à effectuer.",
    },
    {
      icon: Shield,
      title: 'Licence sécurisée',
      desc: 'Un document officiel avec QR code de vérification pour plus de confiance.',
    },
  ]

  return (
    <div className="bg-[#f4f8fc]">
      <section className="relative text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/hero-bg.png)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#003366]/95 via-[#0055a4]/82 to-[#009e60]/35 backdrop-blur-[1px]" aria-hidden />
        <div className="absolute -top-24 right-8 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-[#009e60]/25 blur-3xl" aria-hidden />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full bg-white/10 border border-white/15 px-3 py-2 backdrop-blur">
                <img
                  src="/logo-gabon.png"
                  alt="Armoiries de la République Gabonaise"
                  className="h-9 w-9 object-contain rounded-full bg-white p-0.5"
                />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                  Service public numérique
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl mt-6 drop-shadow-sm">
                {t('portal.hero.title', 'Demandez votre licence de transport en ligne')}
              </h1>
              <p className="mt-5 text-blue-50/90 text-lg leading-relaxed max-w-2xl">
                {t(
                  'portal.hero.subtitle',
                  'Souscrivez, suivez et payez votre licence de transport depuis votre espace personnel, sans vous déplacer.',
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {user ? (
                  <Link
                    to="/espace"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-[#0055a4] px-6 py-3 font-semibold shadow-lg shadow-[#003366]/25 hover:bg-blue-50 hover:gap-3 transition-all"
                  >
                    Accéder à mon espace <ArrowRight size={18} />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/inscription"
                      className="inline-flex items-center gap-2 rounded-xl bg-white text-[#0055a4] px-6 py-3 font-semibold shadow-lg shadow-[#003366]/25 hover:bg-blue-50 hover:gap-3 transition-all"
                    >
                      Créer un compte <ArrowRight size={18} />
                    </Link>
                    <Link
                      to="/connexion"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/35 px-6 py-3 font-semibold hover:bg-white/10 transition-colors"
                    >
                      Se connecter
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative rounded-[2rem] bg-white/12 border border-white/20 p-5 shadow-2xl shadow-[#003366]/30 backdrop-blur-md animate-float-card">
                <div className="rounded-[1.5rem] bg-white text-slate-900 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0055a4]">
                    Parcours citoyen
                  </p>
                  <h2 className="text-2xl font-bold mt-3">Simple, rapide, traçable</h2>
                  <div className="mt-6 space-y-4">
                    {['Choisissez votre licence', 'Déposez les pièces', 'Suivez votre dossier'].map(
                      (step, index) => (
                        <div
                          key={step}
                          className="flex items-center gap-3 animate-step-in"
                          style={{ animationDelay: `${0.3 + index * 0.25}s` }}
                        >
                          <div className="h-9 w-9 rounded-full bg-[#eef4fb] text-[#0055a4] flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{step}</span>
                          <CheckCircle2
                            className="ml-auto text-[#009e60] animate-check-pop"
                            size={18}
                            style={{ animationDelay: `${0.6 + index * 0.25}s` }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-5 -mt-10 relative z-10">
            {featureCards.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 shadow-[0_10px_35px_rgba(0,85,164,0.09)] hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,85,164,0.13)] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#eef4fb] text-[#0055a4] flex items-center justify-center mb-4">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
                <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0055a4] uppercase tracking-[0.16em]">
                Catalogue
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                Types de licences disponibles
              </h2>
              <p className="text-slate-600 mt-2">
                Sélectionnez la licence correspondant à votre activité.
              </p>
            </div>
            <p className="text-xs text-slate-500 max-w-md md:text-right">
              Tarifs et pièces conformes au{' '}
              <a
                href="https://infrastructures.gouv.ga/18-transport/20-documents-administratifs/329-licence-de-transport/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0055a4] hover:underline"
              >
                site officiel du Ministère des Transports
              </a>
              .
            </p>
          </div>

        {isLoading && (
          <div className="grid md:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] animate-pulse">
                <div className="h-5 bg-slate-200 w-2/3 mb-3" />
                <div className="h-4 bg-slate-100 w-full mb-2" />
                <div className="h-4 bg-slate-100 w-4/5" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={22} />
            <div>
              <p className="font-medium text-red-800">Impossible de charger les types de licences</p>
              <p className="text-sm text-red-700 mt-1">
                Vérifiez que l'API est démarrée sur{' '}
                <code className="bg-red-100 px-1 rounded">http://127.0.0.1:8010</code>, puis
                réessayez.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          </div>
        )}

        {!isLoading && !isError && licenseTypes.length === 0 && (
          <p className="text-slate-500 text-center py-8">Aucun type de licence configuré.</p>
        )}

        {!isLoading && !isError && licenseTypes.length > 0 && (
          <div className="grid md:grid-cols-2 gap-5">
            {licenseTypes.map((lt) => (
              <div
                key={lt.id}
                className="group relative overflow-hidden bg-white rounded-2xl p-6 shadow-[0_6px_28px_rgba(0,85,164,0.07)] hover:-translate-y-1 hover:shadow-[0_16px_45px_rgba(0,85,164,0.13)] transition-all"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0055a4] to-[#009e60]" />
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block rounded-full text-[10px] font-semibold tracking-wider uppercase text-[#0055a4] bg-[#eef4fb] px-3 py-1">
                      {lt.code}
                    </span>
                    <h3 className="font-semibold text-lg text-slate-900 mt-2">{lt.name}</h3>
                    <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{lt.description}</p>
                  </div>
                  <span className="text-[#009e60] font-bold text-sm whitespace-nowrap bg-emerald-50 rounded-full px-3 py-1.5">
                    {formatAmount(Number(lt.fee_amount))}
                  </span>
                </div>
                {lt.required_documents && (
                  <ul className="text-xs text-slate-500 mt-5 space-y-2 border-t border-slate-100 pt-4">
                    {lt.required_documents.split(',').map((doc) => (
                      <li key={doc} className="flex items-center gap-2">
                        <CheckCircle2 className="text-[#009e60] shrink-0" size={14} />
                        {doc.trim()}
                      </li>
                    ))}
                  </ul>
                )}
                {user ? (
                  <Link
                    to={`/nouvelle-demande?type=${lt.id}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-[#0055a4] text-sm font-semibold group-hover:gap-2.5 transition-all"
                  >
                    Faire une demande <ArrowRight size={14} />
                  </Link>
                ) : (
                  <Link
                    to="/inscription"
                    className="mt-5 inline-flex items-center gap-1.5 text-[#0055a4] text-sm font-semibold group-hover:gap-2.5 transition-all"
                  >
                    S'inscrire pour faire une demande <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
    </div>
  )
}
