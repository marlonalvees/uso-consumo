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
import Administracao from './pages/Administracao'
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
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="pedidos" element={<Pedidos />} />
                        <Route element={<ProtectedRoute adminOnly />}>
                          <Route path="administracao" element={<Administracao />} />
                          <Route path="cadastros" element={<Cadastros />} />
                        </Route>
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
