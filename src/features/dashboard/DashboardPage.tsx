import {
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock3,
  UsersRound,
  Warehouse,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  const canViewClients = hasPermission(
    user.role.permissions,
    'clientes.consultar',
  )
  const canViewStock = hasPermission(
    user.role.permissions,
    'inventario.consultar',
  )

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS</p>
          <h1>Buen día, {user.name?.split(' ')[0] ?? 'equipo'}</h1>
          <p>Este es el punto de entrada a la gestión comercial.</p>
        </div>
        <span className="status-badge status-badge--success">
          <CheckCircle2 size={15} aria-hidden="true" />
          Sesión activa
        </span>
      </header>

      <section className="hero-card">
        <div>
          <span className="hero-card__icon" aria-hidden="true">
            <Bike />
          </span>
          <p className="eyebrow">SEGUNDO CORTE PRODUCTIVO</p>
          <h2>Inventario y abastecimiento conectados</h2>
          <p>
            Catálogo, unidades físicas y disponibilidad de proveedores con
            permisos reales.
          </p>
        </div>
        <div className="hero-card__meta">
          <small>Organización</small>
          <strong>{user.organization.name}</strong>
          <small>Sucursal</small>
          <strong>{user.branch?.name ?? 'Acceso global'}</strong>
        </div>
      </section>

      <section aria-labelledby="modules-title">
        <div className="section-heading">
          <div>
            <h2 id="modules-title">Módulos</h2>
            <p>Las opciones se habilitan según tus permisos.</p>
          </div>
        </div>
        <div className="module-grid">
          <article className="module-card">
            <span className="module-card__icon">
              <UsersRound />
            </span>
            <div>
              <span
                className={`status-badge ${canViewClients ? 'status-badge--success' : ''}`}
              >
                {canViewClients ? 'Disponible' : 'Sin permiso'}
              </span>
              <h3>Clientes</h3>
              <p>Consulta y gestión centralizada de clientes.</p>
            </div>
            {canViewClients && (
              <Link to="/clientes" className="text-link">
                Abrir módulo <ArrowRight size={16} />
              </Link>
            )}
          </article>
          <article className="module-card">
            <span className="module-card__icon">
              <Warehouse />
            </span>
            <div>
              <span
                className={`status-badge ${canViewStock ? 'status-badge--success' : ''}`}
              >
                {canViewStock ? 'Disponible' : 'Sin permiso'}
              </span>
              <h3>Stock y abastecimiento</h3>
              <p>
                Motos, autos, proveedores y recepciones en un único circuito.
              </p>
            </div>
            {canViewStock && (
              <Link to="/stock/motos" className="text-link">
                Abrir módulo <ArrowRight size={16} />
              </Link>
            )}
          </article>
          <article className="module-card module-card--muted">
            <span className="module-card__icon">
              <Clock3 />
            </span>
            <div>
              <span className="status-badge">Próximamente</span>
              <h3>Operaciones comerciales</h3>
              <p>Ventas, reservas y documentación se incorporarán más adelante.</p>
            </div>
          </article>
        </div>
      </section>
    </>
  )
}
