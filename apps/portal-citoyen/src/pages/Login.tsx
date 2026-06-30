import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login, isStaff } from '../lib/auth'
import { AuthLayout } from '../components/AuthLayout'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname
  const registered = (location.state as { registered?: boolean; email?: string })?.registered
  const registeredEmail = (location.state as { registered?: boolean; email?: string })?.email

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login({
        email: email || undefined,
        phone: phone || undefined,
        password,
      })
      if (isStaff(user)) {
        navigate('/admin')
        return
      }
      navigate(from && !from.startsWith('/admin') ? from : '/espace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px]">
        <div className="bg-white px-8 py-10">
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo-gabon.png"
              alt="Armoiries de la République Gabonaise"
              className="h-16 w-16 object-contain mb-5"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Connexion</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Citoyens et transporteurs
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {registered && (
              <div className="bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
                Compte créé avec succès
                {registeredEmail ? ` pour ${registeredEmail}` : ''}. Connectez-vous pour accéder à votre
                espace.
              </div>
            )}
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.ga"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Numéro de téléphone
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+241 06 XX XX XX"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={fieldClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!email && !phone)}
              className="w-full bg-[#0055a4] text-white py-3 font-semibold hover:bg-[#003d75] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="text-[#0055a4] font-semibold hover:underline">
              Créer un compte
            </Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-4">
            Agent DGTT ?{' '}
            <Link to="/admin/connexion" className="text-[#0055a4] hover:underline">
              Connexion backoffice
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
