import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PendingOrdersProvider } from './context/PendingOrdersContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import NovoPedido from './pages/NovoPedido'
import MeusPedidos from './pages/MeusPedidos'
import Dashboard from './pages/Dashboard'

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return null
  return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/pedidos/novo'} replace />
}

function App() {
  return (
    <AuthProvider>
      <PendingOrdersProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<RoleRedirect />} />
                <Route element={<ProtectedRoute roles={['FILIAL']} />}>
                  <Route path="pedidos/novo" element={<NovoPedido />} />
                  <Route path="pedidos" element={<MeusPedidos />} />
                </Route>
                <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                  <Route path="dashboard" element={<Dashboard />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </PendingOrdersProvider>
    </AuthProvider>
  )
}

export default App
