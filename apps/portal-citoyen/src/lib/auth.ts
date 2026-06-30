import type { TokenResponse, User, UserRole } from '../types'

export type AuthRealm = 'citizen' | 'admin'

const KEYS = {
  citizen: {
    access: 'citizen_access_token',
    refresh: 'citizen_refresh_token',
    user: 'citizen_user',
  },
  admin: {
    access: 'admin_access_token',
    refresh: 'admin_refresh_token',
    user: 'admin_user',
  },
} as const

const LEGACY_ACCESS = 'access_token'
const LEGACY_REFRESH = 'refresh_token'
const LEGACY_USER = 'user'

export const STAFF_ROLES: UserRole[] = ['agent', 'supervisor', 'admin', 'auditor']
export const MUTATE_ROLES: UserRole[] = ['agent', 'supervisor', 'admin']

function migrateLegacyAuth() {
  const legacyToken = localStorage.getItem(LEGACY_ACCESS)
  const legacyUser = localStorage.getItem(LEGACY_USER)
  if (!legacyToken || !legacyUser) return

  const user = JSON.parse(legacyUser) as User
  const realm: AuthRealm = isStaff(user) ? 'admin' : 'citizen'
  if (!localStorage.getItem(KEYS[realm].access)) {
    localStorage.setItem(KEYS[realm].access, legacyToken)
    localStorage.setItem(KEYS[realm].refresh, localStorage.getItem(LEGACY_REFRESH) ?? '')
    localStorage.setItem(KEYS[realm].user, legacyUser)
  }

  localStorage.removeItem(LEGACY_ACCESS)
  localStorage.removeItem(LEGACY_REFRESH)
  localStorage.removeItem(LEGACY_USER)
}

migrateLegacyAuth()

export function resolveApiRealm(): AuthRealm {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return 'admin'
  }
  return 'citizen'
}

export function isStaff(user: User | null): boolean {
  return !!user && STAFF_ROLES.includes(user.role)
}

export function canMutateApplications(user: User | null): boolean {
  return !!user && MUTATE_ROLES.includes(user.role)
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

export function canManageLicenseTypes(user: User | null): boolean {
  return !!user && (user.role === 'admin' || user.role === 'supervisor')
}

export function isAuditor(user: User | null): boolean {
  return user?.role === 'auditor'
}

export function staffProfileComplete(user: User | null): boolean {
  if (!user || !isStaff(user)) return true
  if (user.profile_complete === false) return false
  return Boolean(user.email?.trim() && user.phone?.trim())
}

export function updateStoredUser(realm: AuthRealm, user: User) {
  localStorage.setItem(KEYS[realm].user, JSON.stringify(user))
}

export function getAccessToken(realm: AuthRealm = resolveApiRealm()): string | null {
  return localStorage.getItem(KEYS[realm].access)
}

export function isLoggedIn(realm: AuthRealm): boolean {
  return !!getStoredUser(realm) && !!getAccessToken(realm)
}

export function getStoredUser(realm: AuthRealm): User | null {
  const raw = localStorage.getItem(KEYS[realm].user)
  return raw ? (JSON.parse(raw) as User) : null
}

export function storeAuth(data: TokenResponse, realm: AuthRealm) {
  localStorage.setItem(KEYS[realm].access, data.access_token)
  localStorage.setItem(KEYS[realm].refresh, data.refresh_token)
  localStorage.setItem(KEYS[realm].user, JSON.stringify(data.user))
}

export function clearAuth(realm: AuthRealm) {
  localStorage.removeItem(KEYS[realm].access)
  localStorage.removeItem(KEYS[realm].refresh)
  localStorage.removeItem(KEYS[realm].user)
}

const API_BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

const API_START_HINT =
  'Démarrez l\'API : scripts\\dev-api.bat (port 8010)'

async function authRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(`Impossible de joindre le serveur. ${API_START_HINT}`)
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }))
    let message = typeof error.detail === 'string' ? error.detail : 'Une erreur est survenue'
    if (response.status === 404) {
      message = `API introuvable (mauvais port ou API arrêtée). ${API_START_HINT}`
    }
    throw new Error(message)
  }
  return response.json()
}

export async function login(
  payload: { email?: string; phone?: string; password: string },
  realm?: AuthRealm,
) {
  const data = await authRequest<TokenResponse>('/api/v1/auth/login', payload)
  const targetRealm = realm ?? (isStaff(data.user) ? 'admin' : 'citizen')
  storeAuth(data, targetRealm)
  return data.user
}

export async function register(payload: {
  email: string
  password: string
  password_confirm: string
  full_name: string
  phone?: string
  national_id?: string
}) {
  await authRequest<User>('/api/v1/auth/register', payload)
}
