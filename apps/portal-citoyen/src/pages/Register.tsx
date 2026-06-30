import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../lib/auth'
import { AuthLayout } from '../components/AuthLayout'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    password_confirm: '',
    full_name: '',
    phone: '',
    national_id: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await register({
        email: form.email,
        password: form.password,
        password_confirm: form.password_confirm,
        full_name: form.full_name,
        phone: form.phone || undefined,
        national_id: form.national_id || undefined,
      })
      navigate('/connexion', { state: { registered: true, email: form.email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout backTo="/connexion" backLabel="Retour à la connexion">
      <div className="w-full max-w-[420px]">
        <div className="bg-white px-8 py-10">
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo-gabon.png"
              alt="Armoiries de la République Gabonaise"
              className="h-16 w-16 object-contain mb-5"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Créer un compte</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Pour souscrire à une licence de transport
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
            )}

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nom complet *
              </label>
              <input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Téléphone
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+241 ..."
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="national_id" className="block text-sm font-medium text-slate-700 mb-1.5">
                N° CNI
              </label>
              <input
                id="national_id"
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe *
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={fieldClass}
              />
              <p className="text-xs text-slate-500 mt-1.5">Minimum 8 caractères</p>
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirmer le mot de passe *
              </label>
              <input
                id="password_confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password_confirm}
                onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                className={fieldClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#009e60] text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-8">
            Déjà inscrit ?{' '}
            <Link to="/connexion" className="text-[#0055a4] font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
