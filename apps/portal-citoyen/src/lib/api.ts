import { clearAuth, getAccessToken, resolveApiRealm, type AuthRealm } from './auth'

/** En dev : toujours le proxy Vite (/api → 127.0.0.1:8010). En prod : VITE_API_URL. */
const API_BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

const API_START_HINT =
  'Démarrez l\'API : cd services/api && .venv\\Scripts\\uvicorn app.main:app --reload --port 8010 --host 127.0.0.1'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const PAYMENT_UNAVAILABLE_MESSAGE =
  'Le paiement mobile est momentanément indisponible. Réessayez dans quelques instants.'

function sanitizeErrorMessage(message: string, status: number): string {
  const trimmed = message.trim()
  if (!trimmed) return 'Une erreur est survenue'

  if (/<!DOCTYPE|<html/i.test(trimmed) || trimmed.length > 280) {
    console.error('[API] Détail technique (réponse brute):', trimmed.slice(0, 4000))
    return status === 502 ? PAYMENT_UNAVAILABLE_MESSAGE : 'Le service est momentanément indisponible.'
  }

  if (/BambooPay instant payment failed/i.test(trimmed)) {
    console.error('[API] BambooPay:', trimmed)
    return PAYMENT_UNAVAILABLE_MESSAGE
  }

  return trimmed
}

function tokenFor(realm?: AuthRealm) {
  return getAccessToken(realm ?? resolveApiRealm())
}

async function request<T>(path: string, options: RequestInit = {}, realm?: AuthRealm): Promise<T> {
  const activeRealm = realm ?? resolveApiRealm()
  const token = tokenFor(activeRealm)
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(`Impossible de joindre le serveur. ${API_START_HINT}`, 0)
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth(activeRealm)
    }
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }))
    let message = 'Une erreur est survenue'
    const headerTechnical = response.headers.get('X-Error-Technical')
    const technical =
      headerTechnical ||
      (typeof error.technical === 'string' ? error.technical : undefined) ||
      (error.detail && typeof error.detail === 'object'
        ? (error.detail as { technical?: string }).technical
        : undefined)
    if (typeof error.detail === 'string') {
      message = error.detail
    } else if (error.detail && typeof error.detail === 'object') {
      const d = error.detail as { message?: string; technical?: string }
      message = d.message || 'Une erreur est survenue'
    }
    if (technical) {
      console.error('[API] Détail technique:', technical)
    }
    if (response.status === 401) {
      message = 'Session expirée. Veuillez vous reconnecter.'
    } else if (response.status === 404) {
      message = `API introuvable (mauvais port ou API arrêtée). ${API_START_HINT}`
    } else if (response.status >= 500 || response.status === 502) {
      console.error(
        `[API] ${options.method || 'GET'} ${path} → ${response.status}`,
        technical ? { ...error, technical } : error,
      )
    }
    message = sanitizeErrorMessage(message, response.status)
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

async function uploadRequest<T>(path: string, formData: FormData, realm?: AuthRealm): Promise<T> {
  const activeRealm = realm ?? resolveApiRealm()
  const token = tokenFor(activeRealm)
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData })
  } catch {
    throw new ApiError(`Impossible de joindre le serveur. ${API_START_HINT}`, 0)
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth(activeRealm)
    }
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }))
    let message = 'Une erreur est survenue'
    const headerTechnical = response.headers.get('X-Error-Technical')
    const technical =
      headerTechnical ||
      (typeof error.technical === 'string' ? error.technical : undefined) ||
      (error.detail && typeof error.detail === 'object'
        ? (error.detail as { technical?: string }).technical
        : undefined)
    if (typeof error.detail === 'string') {
      message = error.detail
    } else if (error.detail && typeof error.detail === 'object') {
      const d = error.detail as { message?: string; technical?: string }
      message = d.message || 'Une erreur est survenue'
    }
    if (technical) {
      console.error('[API] Détail technique:', technical)
    }
    if (response.status === 401) {
      message = 'Session expirée. Veuillez vous reconnecter.'
    } else if (response.status === 404) {
      message = `API introuvable. ${API_START_HINT}`
    } else if (response.status >= 500 || response.status === 502) {
      console.error(
        `[API] POST ${path} → ${response.status}`,
        technical ? { ...error, technical } : error,
      )
    }
    message = sanitizeErrorMessage(message, response.status)
    throw new ApiError(message, response.status)
  }

  return response.json()
}

export const api = {
  get: <T>(path: string, realm?: AuthRealm) => request<T>(path, {}, realm),
  post: <T>(path: string, body: unknown, realm?: AuthRealm) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, realm),
  patch: <T>(path: string, body: unknown, realm?: AuthRealm) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, realm),
  delete: (path: string, realm?: AuthRealm) => request<void>(path, { method: 'DELETE' }, realm),
  upload: <T>(path: string, formData: FormData, realm?: AuthRealm) =>
    uploadRequest<T>(path, formData, realm),
  download: async (path: string, filename: string, realm?: AuthRealm) => {
    const activeRealm = realm ?? resolveApiRealm()
    const token = tokenFor(activeRealm)
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      throw new ApiError(`Impossible de joindre le serveur. ${API_START_HINT}`, 0)
    }
    if (!response.ok) throw new ApiError('Téléchargement impossible', response.status)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
  fetchBlob: async (path: string, realm?: AuthRealm): Promise<Blob> => {
    const activeRealm = realm ?? resolveApiRealm()
    const token = tokenFor(activeRealm)
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      throw new ApiError(`Impossible de joindre le serveur. ${API_START_HINT}`, 0)
    }
    if (!response.ok) throw new ApiError('Impossible de charger le document', response.status)
    return response.blob()
  },
  exportFile: async (path: string, filename: string, realm?: AuthRealm) => {
    const activeRealm = realm ?? resolveApiRealm()
    const token = tokenFor(activeRealm)
    let response: Response
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch {
      throw new ApiError(`Impossible de joindre le serveur. ${API_START_HINT}`, 0)
    }
    if (!response.ok) throw new ApiError('Export impossible', response.status)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
