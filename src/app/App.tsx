import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/LoginPage'
import { PermissionRoute } from '../features/auth/PermissionRoute'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { ClientsPage } from '../features/clients/ClientsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ModulePlaceholder } from '../features/placeholders/ModulePlaceholder'
import { stockApiGateway } from '../features/stock/api'
import { StockPage } from '../features/stock/StockPage'
import { AppLayout } from './layout/AppLayout'
import { ForbiddenPage, NotFoundPage } from './pages/ErrorPages'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="sin-permiso" element={<ForbiddenPage />} />
              <Route
                element={<PermissionRoute permission="clientes.consultar" />}
              >
                <Route path="clientes" element={<ClientsPage />} />
              </Route>
              <Route
                element={
                  <PermissionRoute permission="inventario.consultar" />
                }
              >
                <Route
                  path="stock/motos"
                  element={
                    <StockPage
                      gateway={stockApiGateway}
                      vehicleType="MOTO"
                    />
                  }
                />
                <Route
                  path="stock/autos"
                  element={
                    <StockPage
                      gateway={stockApiGateway}
                      vehicleType="AUTO"
                    />
                  }
                />
              </Route>
              <Route
                element={<PermissionRoute permission="usuarios.consultar" />}
              >
                <Route
                  path="usuarios"
                  element={
                    <ModulePlaceholder
                      title="Usuarios"
                      description="Administración de accesos y permisos."
                    />
                  }
                />
              </Route>
              <Route
                element={<PermissionRoute permission="auditoria.consultar" />}
              >
                <Route
                  path="auditoria"
                  element={
                    <ModulePlaceholder
                      title="Auditoría"
                      description="Registro de actividad del sistema."
                    />
                  }
                />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
