import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    window.location.href = import.meta.env.VITE_HUB_URL
    return null
  }

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
