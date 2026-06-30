/** En dev : proxy Vite (/api → 127.0.0.1:8010). En prod : VITE_API_URL. */
const API_BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur serveur' }))
    const message = typeof error.detail === 'string' ? error.detail : 'Une erreur est survenue'
    throw new ApiError(message, response.status)
  }
  return response.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  download: async (path: string, filename: string) => {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) throw new ApiError('Téléchargement impossible', response.status)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
