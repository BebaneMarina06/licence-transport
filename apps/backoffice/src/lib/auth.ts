import type { TokenResponse, User, UserRole } from '../types'
import { api } from './api'

const STAFF_ROLES: UserRole[] = ['agent', 'supervisor', 'admin', 'auditor']

export function getStoredUser(): User | null {
  const raw = localStorage.getItem('user')
  return raw ? (JSON.parse(raw) as User) : null
}

export function isStaff(user: User | null): boolean {
  return !!user && STAFF_ROLES.includes(user.role)
}

export function storeAuth(data: TokenResponse) {
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('user', JSON.stringify(data.user))
}

export function clearAuth() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

export async function adminLogin(email: string, password: string) {
  const data = await api.post<TokenResponse>('/api/v1/auth/login', { email, password })
  if (!STAFF_ROLES.includes(data.user.role)) {
    throw new Error('Accès réservé au personnel administratif')
  }
  storeAuth(data)
  return data.user
}
