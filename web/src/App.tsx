import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrdersProvider } from './context/OrdersContext'
import { ItemsProvider } from './context/ItemsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import NovoPedido from './pages/NovoPedido'
import MeusPedidos from './pages/MeusPedidos'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import VisaoFilial from './pages/VisaoFilial'

function DefaultRedirect() {
  const { user } = useAuth()
  if (!user) return null
  return <Navigate to={user.isAdmin ? '/dashboard' : '/pedidos/novo'} replace />
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
                  <Route path="pedidos/novo" element={<NovoPedido />} />
                  <Route path="pedidos" element={<MeusPedidos />} />
                  <Route element={<ProtectedRoute adminOnly />}>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="produtos" element={<Produtos />} />
                    <Route path="filiais" element={<VisaoFilial />} />
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
