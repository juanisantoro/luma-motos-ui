import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { RoleDetailPage } from '../features/access/RoleDetailPage'
import { RoleFormPage } from '../features/access/RoleFormPage'
import { RolesPage } from '../features/access/RolesPage'
import { UserFormPage } from '../features/access/UserFormPage'
import { UsersPage } from '../features/access/UsersPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { InitialPasswordPage } from '../features/auth/InitialPasswordPage'
import { PermissionRoute } from '../features/auth/PermissionRoute'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { CatalogBrowserPage } from '../features/catalog/CatalogBrowserPage'
import { ClientsPage } from '../features/clients/ClientsPage'
import { CreditInquiriesPage } from '../features/credit-inquiries'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import {
  commissionApiGateway,
  CommissionPaymentsPage,
  CommissionScalesPage,
  MyCommissionsPage,
  PaidCommissionsPage,
  SellerMeetingPage,
  SuggestedCommissionsPage,
} from '../features/commissions'
import { ExpensesPage } from '../features/finance/ExpensesPage'
import { IncomesPage } from '../features/finance/IncomesPage'
import { VehiclePaymentsPage } from '../features/vehicle-payments/VehiclePaymentsPage'
import { PurchasesPage } from '../features/finance/PurchasesPage'
import { ModulePlaceholder } from '../features/placeholders/ModulePlaceholder'
import { ApprovalsPage } from '../features/sales/ApprovalsPage'
import { OperationsPage } from '../features/sales/OperationsPage'
import { NewOperationPage } from '../features/sales/NewOperationPage'
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
          <Route
            path="/olvide-mi-contrasena"
            element={<ForgotPasswordPage />}
          />
          <Route
            path="/configurar-contrasena"
            element={<InitialPasswordPage />}
          />
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
                  <PermissionRoute permission="inventario.gestionar" />
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
                element={<PermissionRoute permission="catalogo.consultar" />}
              >
                <Route
                  path="catalogo/motos"
                  element={<CatalogBrowserPage vehicleType="MOTO" />}
                />
                <Route
                  path="catalogo/autos"
                  element={<CatalogBrowserPage vehicleType="AUTO" />}
                />
              </Route>
              <Route
                element={<PermissionRoute permission="ventas.consultar" />}
              >
                <Route
                  path="motos/operaciones"
                  element={<OperationsPage vehicleType="MOTO" />}
                />
                <Route
                  path="autos/operaciones"
                  element={<OperationsPage vehicleType="AUTO" />}
                />
                <Route
                  path="motos/mis-operaciones"
                  element={<OperationsPage mine vehicleType="MOTO" />}
                />
                <Route
                  path="autos/mis-operaciones"
                  element={<OperationsPage mine vehicleType="AUTO" />}
                />
                <Route
                  element={<PermissionRoute permission="ventas.gestionar" />}
                >
                  <Route
                    path="motos/operaciones/nueva"
                    element={<NewOperationPage vehicleType="MOTO" />}
                  />
                  <Route
                    path="autos/operaciones/nueva"
                    element={<NewOperationPage vehicleType="AUTO" />}
                  />
                </Route>
                <Route
                  element={<PermissionRoute permission="ventas.aprobar" />}
                >
                  <Route
                    path="motos/aprobaciones"
                    element={<ApprovalsPage vehicleType="MOTO" />}
                  />
                  <Route
                    path="autos/aprobaciones"
                    element={<ApprovalsPage vehicleType="AUTO" />}
                  />
                </Route>
                <Route
                  path="operaciones"
                  element={<Navigate replace to="/motos/operaciones" />}
                />
                <Route
                  path="mis-operaciones"
                  element={<Navigate replace to="/motos/mis-operaciones" />}
                />
                <Route
                  path="operaciones/nueva"
                  element={<Navigate replace to="/motos/operaciones/nueva" />}
                />
                <Route
                  path="aprobaciones"
                  element={<Navigate replace to="/motos/aprobaciones" />}
                />
              </Route>
              <Route
                element={
                  <PermissionRoute permission="consultas_crediticias.consultar" />
                }
              >
                <Route
                  path="consultas-crediticias"
                  element={<CreditInquiriesPage />}
                />
              </Route>
              <Route
                element={<PermissionRoute permission="usuarios.consultar" />}
              >
                <Route path="usuarios" element={<UsersPage />} />
                <Route
                  element={<PermissionRoute permission="usuarios.gestionar" />}
                >
                  <Route path="usuarios/nuevo" element={<UserFormPage />} />
                  <Route
                    path="usuarios/:id/editar"
                    element={<UserFormPage />}
                  />
                </Route>
              </Route>
              <Route
                element={<PermissionRoute permission="roles.consultar" />}
              >
                <Route path="usuarios/roles" element={<RolesPage />} />
                <Route
                  path="usuarios/roles/:id"
                  element={<RoleDetailPage />}
                />
                <Route
                  element={<PermissionRoute permission="roles.gestionar" />}
                >
                  <Route
                    path="usuarios/roles/nuevo"
                    element={<RoleFormPage />}
                  />
                  <Route
                    path="usuarios/roles/:id/editar"
                    element={<RoleFormPage />}
                  />
                </Route>
              </Route>
              <Route
                element={<PermissionRoute permission="compras.consultar" />}
              >
                <Route
                  path="motos/compras"
                  element={<PurchasesPage vehicleType="MOTO" />}
                />
                <Route
                  path="autos/compras"
                  element={<PurchasesPage vehicleType="AUTO" />}
                />
                <Route
                  path="compras"
                  element={<Navigate replace to="/motos/compras" />}
                />
              </Route>
              <Route
                element={<PermissionRoute permission="ingresos.consultar" />}
              >
                <Route
                  path="motos/ingresos"
                  element={<IncomesPage vehicleType="MOTO" />}
                />
                <Route
                  path="autos/ingresos"
                  element={<IncomesPage vehicleType="AUTO" />}
                />
                <Route
                  path="ingresos"
                  element={<Navigate replace to="/motos/ingresos" />}
                />
              </Route>
              <Route
                element={<PermissionRoute permission="pagos_vehiculo.consultar" />}
              >
                <Route
                  path="motos/pagos-vehiculo"
                  element={<VehiclePaymentsPage vehicleType="MOTO" />}
                />
                <Route
                  path="autos/pagos-vehiculo"
                  element={<VehiclePaymentsPage vehicleType="AUTO" />}
                />
                <Route
                  path="pagos-vehiculo"
                  element={<Navigate replace to="/motos/pagos-vehiculo" />}
                />
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
              <Route element={<PermissionRoute permission="comisiones.consultar" />}>
                <Route path="comisiones/sugerido/motos" element={<SuggestedCommissionsPage vehicleType="MOTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/sugerido/autos" element={<SuggestedCommissionsPage vehicleType="AUTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/reunion/motos" element={<SellerMeetingPage vehicleType="MOTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/reunion/autos" element={<SellerMeetingPage vehicleType="AUTO" gateway={commissionApiGateway} />} />
              </Route>
              <Route element={<PermissionRoute permission="comisiones.pagar" />}>
                <Route path="comisiones/pagar/motos" element={<CommissionPaymentsPage vehicleType="MOTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/pagar/autos" element={<CommissionPaymentsPage vehicleType="AUTO" gateway={commissionApiGateway} />} />
              </Route>
              <Route element={<PermissionRoute permission="comisiones.historial" />}>
                <Route path="comisiones/pagadas/motos" element={<PaidCommissionsPage vehicleType="MOTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/pagadas/autos" element={<PaidCommissionsPage vehicleType="AUTO" gateway={commissionApiGateway} />} />
              </Route>
              <Route element={<PermissionRoute permission="comisiones.configurar" />}>
                <Route path="comisiones/escalas/motos" element={<CommissionScalesPage vehicleType="MOTO" gateway={commissionApiGateway} />} />
                <Route path="comisiones/escalas/autos" element={<CommissionScalesPage vehicleType="AUTO" gateway={commissionApiGateway} />} />
              </Route>
              <Route element={<PermissionRoute permission="comisiones.propias" />}>
                <Route path="mis-comisiones" element={<MyCommissionsPage gateway={commissionApiGateway} />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
