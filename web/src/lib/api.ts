const BASE_URL = import.meta.env.VITE_API_URL
const HUB_URL = import.meta.env.VITE_HUB_URL
const DEV_TOKEN = import.meta.env.DEV ? import.meta.env.VITE_DEV_TOKEN : undefined

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (DEV_TOKEN) headers.set('Authorization', `Bearer ${DEV_TOKEN}`)

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })

  if (res.status === 401) {
    if (!import.meta.env.DEV) window.location.href = HUB_URL
    throw new ApiError('Não autorizado', 401)
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Erro inesperado', res.status)
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
