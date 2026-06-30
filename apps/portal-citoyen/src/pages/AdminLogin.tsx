import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { clearAuth, login, isStaff, staffProfileComplete } from '../lib/auth'
import { AuthLayout } from '../components/AuthLayout'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(
        {
          email: email.trim().toLowerCase(),
          password,
        },
        'admin',
      )
      if (!isStaff(user)) {
        clearAuth('admin')
        setError('Accès réservé aux agents DGTT')
        return
      }
      const target =
        !staffProfileComplete(user)
          ? '/admin/completer-profil'
          : from?.startsWith('/admin')
            ? from
            : '/admin'
      navigate(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout backTo="/" backLabel="Retour au portail">
      <div className="w-full max-w-[420px]">
        <div className="bg-white px-8 py-10">
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo-gabon.png"
              alt="Armoiries de la République Gabonaise"
              className="h-16 w-16 object-contain mb-5"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Backoffice DGTT</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Connexion réservée aux agents de la Direction Générale des Transports Terrestres
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email *
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@dgtt.ga"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe *
              </label>
              <input
                id="admin-password"
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
              disabled={loading}
              className="w-full bg-[#0055a4] text-white py-3 font-semibold hover:bg-[#003d75] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <p className="text-center text-xs text-slate-400 mt-6 bg-slate-50 px-3 py-2">
              Compte test : <span className="font-mono">admin@dgtt.ga</span> /{' '}
              <span className="font-mono">Admin@2026!</span>
            </p>
          )}

          <p className="text-center text-sm text-slate-500 mt-8">
            Vous êtes usager ?{' '}
            <Link to="/connexion" className="text-[#0055a4] font-semibold hover:underline">
              Connexion citoyen
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
