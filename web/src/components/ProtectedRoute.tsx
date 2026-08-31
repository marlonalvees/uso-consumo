import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    const hubUrl = import.meta.env.VITE_HUB_URL
    if (!hubUrl) {
      return (
        <p className="p-6 text-sm text-red-600">
          Não foi possível autenticar. Verifique se VITE_API_URL e VITE_HUB_URL estão
          configurados em web/.env, se a API está acessível e se existe um cookie "token" válido
          para este domínio.
        </p>
      )
    }
    window.location.href = hubUrl
    return null
  }

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
