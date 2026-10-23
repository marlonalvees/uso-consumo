import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrdersProvider } from './context/OrdersContext'
import { ItemsProvider } from './context/ItemsContext'
import { CategoriesProvider } from './context/CategoriesContext'
import { PackagingProvider } from './context/PackagingContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Pedidos from './pages/Pedidos'
import Acompanhar from './pages/Acompanhar'
import Historico from './pages/Historico'
import MinhaFilial from './pages/MinhaFilial'
import GestaoPedidos from './pages/GestaoPedidos'
import GestaoEstoque from './pages/GestaoEstoque'
import GestaoCompras from './pages/GestaoCompras'
import Relatorios from './pages/Relatorios'
import Cadastros from './pages/Cadastros'

function DefaultRedirect() {
  const { user } = useAuth()
  if (!user) return null
  return <Navigate to={user.isAdmin ? '/dashboard' : '/pedidos'} replace />
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <OrdersProvider>
          <ItemsProvider>
            <CategoriesProvider>
              <PackagingProvider>
                <BrowserRouter>
                  <Routes>
                    <Route element={<ProtectedRoute />}>
                      <Route element={<Layout />}>
                        <Route index element={<DefaultRedirect />} />
                        <Route path="pedidos" element={<Pedidos />} />
                        <Route path="acompanhar" element={<Acompanhar />} />
                        <Route path="historico" element={<Historico />} />
                        <Route path="filial" element={<MinhaFilial />} />
                        <Route element={<ProtectedRoute adminOnly />}>
                          <Route path="dashboard" element={<Dashboard />} />
                          <Route path="gestao" element={<GestaoPedidos />} />
                          {/* endereço antigo (links e notificações já enviadas) */}
                          <Route path="administracao" element={<Navigate to="/gestao" replace />} />
                          <Route path="estoque" element={<GestaoEstoque />} />
                          <Route path="compras" element={<GestaoCompras />} />
                          <Route path="relatorios" element={<Relatorios />} />
                          <Route path="cadastros" element={<Cadastros />} />
                        </Route>
                        <Route path="*" element={<DefaultRedirect />} />
                      </Route>
                    </Route>
                  </Routes>
                </BrowserRouter>
              </PackagingProvider>
            </CategoriesProvider>
          </ItemsProvider>
        </OrdersProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
