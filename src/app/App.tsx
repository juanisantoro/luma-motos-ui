import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/LoginPage'
import { PermissionRoute } from '../features/auth/PermissionRoute'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { ClientsPage } from '../features/clients/ClientsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ExpensesPage } from '../features/finance/ExpensesPage'
import { IncomesPage } from '../features/finance/IncomesPage'
import { PurchasesPage } from '../features/finance/PurchasesPage'
import { ModulePlaceholder } from '../features/placeholders/ModulePlaceholder'
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
                element={<PermissionRoute permission="compras.consultar" />}
              >
                <Route path="compras" element={<PurchasesPage />} />
              </Route>
              <Route
                element={<PermissionRoute permission="ingresos.consultar" />}
              >
                <Route path="ingresos" element={<IncomesPage />} />
              </Route>
              <Route
                element={<PermissionRoute permission="gastos.consultar" />}
              >
                <Route path="gastos" element={<ExpensesPage />} />
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
