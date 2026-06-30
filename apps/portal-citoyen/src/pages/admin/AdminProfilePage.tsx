import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../lib/api'
import { getStoredUser, staffProfileComplete, updateStoredUser } from '../../lib/auth'
import type { User } from '../../types'
import { AuthLayout } from '../../components/AuthLayout'

const fieldClass =
  'w-full bg-[#eef4fb] px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-[#e3edf8] transition-colors'

type Props = {
  required?: boolean
}

export function AdminProfileForm({ required = false }: Props) {
  const navigate = useNavigate()
  const stored = getStoredUser('admin')
  const [email, setEmail] = useState(stored?.email ?? '')
  const [phone, setPhone] = useState(stored?.phone ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .get<User>('/api/v1/auth/me', 'admin')
      .then((user) => {
        setEmail(user.email)
        setPhone(user.phone ?? '')
        updateStoredUser('admin', user)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const user = await api.patch<User>(
        '/api/v1/auth/me',
        {
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        },
        'admin',
      )
      updateStoredUser('admin', user)
      if (required || !staffProfileComplete(user)) {
        if (!staffProfileComplete(user)) {
          setError('Veuillez renseigner votre e-mail et votre numéro de téléphone.')
          return
        }
        navigate('/admin')
        return
      }
      setSuccess('Profil mis à jour.')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Erreur de mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3">{success}</div>}

      <div>
        <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          E-mail de contact *
        </label>
        <input
          id="profile-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="agent@dgtt.ga"
          className={fieldClass}
        />
        <p className="text-xs text-slate-500 mt-1">Utilisé pour recevoir les alertes de nouvelles demandes.</p>
      </div>

      <div>
        <label htmlFor="profile-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
          Téléphone mobile *
        </label>
        <input
          id="profile-phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+241 07 78 61 36"
          className={fieldClass}
        />
        <p className="text-xs text-slate-500 mt-1">Format Gabon (+241…) pour les SMS d&apos;alerte.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0055a4] text-white py-3 font-semibold hover:bg-[#003d75] disabled:opacity-60 transition-colors"
      >
        {loading ? 'Enregistrement…' : required ? 'Continuer' : 'Enregistrer'}
      </button>
    </form>
  )

  if (required) {
    return (
      <AuthLayout backTo="/admin/connexion" backLabel="Déconnexion">
        <div className="w-full max-w-[420px]">
          <div className="bg-white px-8 py-10">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-center">
              Complétez votre profil
            </h1>
            <p className="text-slate-500 text-sm mt-2 mb-8 text-center leading-relaxed">
              Pour recevoir les alertes SMS et e-mail des nouvelles demandes, renseignez vos coordonnées.
            </p>
            {content}
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold text-slate-900">Mon profil agent</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">
        Coordonnées utilisées pour les notifications de nouvelles demandes.
      </p>
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">{content}</div>
    </div>
  )
}

export function AdminCompleteProfilePage() {
  return <AdminProfileForm required />
}

export function AdminProfilePage() {
  return <AdminProfileForm />
}
