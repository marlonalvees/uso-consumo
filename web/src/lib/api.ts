const BASE_URL = import.meta.env.VITE_API_URL
const HUB_URL = import.meta.env.VITE_HUB_URL

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Sem token, token inválido ou expirado — a API sempre responde 401 nesses
    // três casos (ver requireAuth no backend). Manda de volta pro hub pra
    // logar de novo, em vez de deixar a página presa num estado quebrado.
    if (HUB_URL) window.location.href = HUB_URL
    throw new ApiError('Não autorizado', 401)
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Erro inesperado', res.status)
  }

  return data as T
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  return handleResponse<T>(res)
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: formData, credentials: 'include' })
  return handleResponse<T>(res)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
}

export function assetUrl(relativePath: string): string {
  return `${BASE_URL}/uploads/${relativePath}`
}
