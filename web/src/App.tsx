import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrdersProvider } from './context/OrdersContext'
import { ItemsProvider } from './context/ItemsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Pedidos from './pages/Pedidos'
import Administracao from './pages/Administracao'

function DefaultRedirect() {
  const { user } = useAuth()
  if (!user) return null
  return <Navigate to={user.isAdmin ? '/dashboard' : '/pedidos'} replace />
}

function App() {
  return (
    <AuthProvider>
      <OrdersProvider>
        <ItemsProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route index element={<DefaultRedirect />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="pedidos" element={<Pedidos />} />
                  <Route element={<ProtectedRoute adminOnly />}>
                    <Route path="administracao" element={<Administracao />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ItemsProvider>
      </OrdersProvider>
    </AuthProvider>
  )
}

export default App
