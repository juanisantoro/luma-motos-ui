import { useEffect, useRef, useState } from 'react'
import {
  Bike,
  CarFront,
  CheckCheck,
  ClipboardList,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ReceiptText,
  ShoppingCart,
  ScrollText,
  ShieldAlert,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { hasPermission } from '../../features/auth/PermissionRoute'
import { Brand } from '../../shared/components/Brand'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'

type NavItem = {
  label: string
  description: string
  to: string
  icon: LucideIcon
  permissions?: string[]
}

const navigation: NavItem[] = [
  {
    label: 'Inicio',
    description: 'Resumen general',
    to: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Clientes',
    description: 'Gestión comercial',
    to: '/clientes',
    icon: UsersRound,
    permissions: ['clientes.consultar'],
  },
  {
    label: 'Stock de motos',
    description: 'Inventario y proveedores',
    to: '/stock/motos',
    icon: Bike,
    permissions: ['inventario.consultar'],
  },
  {
    label: 'Stock de autos',
    description: 'Inventario y proveedores',
    to: '/stock/autos',
    icon: CarFront,
    permissions: ['inventario.consultar'],
  },
  {
    label: 'Nueva operación',
    description: 'Venta y reserva',
    to: '/operaciones/nueva',
    icon: PlusCircle,
    permissions: ['ventas.consultar', 'ventas.gestionar'],
  },
  {
    label: 'Mis operaciones',
    description: 'Seguimiento personal',
    to: '/mis-operaciones',
    icon: ReceiptText,
    permissions: ['ventas.consultar'],
  },
  {
    label: 'Operaciones',
    description: 'Ventas y reservas',
    to: '/operaciones',
    icon: ShoppingCart,
    permissions: ['ventas.consultar'],
  },
  {
    label: 'Aprobaciones',
    description: 'Control comercial',
    to: '/aprobaciones',
    icon: CheckCheck,
    permissions: ['ventas.consultar', 'ventas.aprobar'],
  },
  {
    label: 'Clientes en rojo',
    description: 'Consultas crediticias',
    to: '/consultas-crediticias',
    icon: ShieldAlert,
    permissions: ['consultas_crediticias.consultar'],
  },
  {
    label: 'Compras',
    description: 'Proveedores y unidades',
    to: '/compras',
    icon: ShoppingCart,
    permissions: ['compras.consultar'],
  },
  {
    label: 'Ingresos',
    description: 'Cobros e ingresos',
    to: '/ingresos',
    icon: CircleDollarSign,
    permissions: ['ingresos.consultar'],
  },
  {
    label: 'Gastos',
    description: 'Egresos generales',
    to: '/gastos',
    icon: ReceiptText,
    permissions: ['gastos.consultar'],
  },
  {
    label: 'Usuarios',
    description: 'Accesos y permisos',
    to: '/usuarios',
    icon: ClipboardList,
    permissions: ['usuarios.consultar'],
  },
  {
    label: 'Auditoría',
    description: 'Actividad del sistema',
    to: '/auditoria',
    icon: ScrollText,
    permissions: ['auditoria.consultar'],
  },
]

function initials(name: string | null, email: string) {
  const source = name?.trim() || email
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 900px)')
  const compactByDefault = useMediaQuery(
    '(min-width: 901px) and (max-width: 1199px)',
  )
  const [collapsed, setCollapsed] = useState(compactByDefault)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!drawerOpen || !isMobile) return
    const sidebar = sidebarRef.current
    const menuButton = menuButtonRef.current
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled])',
        ) ?? [],
      )

    focusable()[0]?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('drawer-active')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('drawer-active')
      menuButton?.focus()
    }
  }, [drawerOpen, isMobile])

  if (!user) return null

  const items = navigation.filter(
    (item) =>
      !item.permissions ||
      item.permissions.every((permission) =>
        hasPermission(user.role.permissions, permission),
      ),
  )
  const activeItem =
    navigation.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.to),
    ) ?? navigation[0]
  const sidebarCompact = collapsed && !isMobile

  return (
    <div className={`app-shell ${sidebarCompact ? 'app-shell--collapsed' : ''}`}>
      {isMobile && drawerOpen && (
        <button
          className="drawer-overlay"
          aria-label="Cerrar menú"
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
      )}
      <aside
        ref={sidebarRef}
        id="main-navigation"
        className={`sidebar ${drawerOpen ? 'sidebar--open' : ''} ${sidebarCompact ? 'sidebar--collapsed' : ''}`}
        aria-label="Navegación principal"
        inert={isMobile && !drawerOpen}
      >
        <div className="sidebar__header">
          <Brand compact={sidebarCompact} />
          {isMobile && (
            <button
              className="icon-button sidebar__close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
              type="button"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <nav className="sidebar__nav">
          {!sidebarCompact && <p className="sidebar__group">GESTIÓN</p>}
          {items.map(({ icon: Icon, ...item }) => (
            <NavLink
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item--active' : ''}`
              }
              end={item.to === '/' || item.to === '/operaciones'}
              key={item.to}
              title={sidebarCompact ? item.label : undefined}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
            >
              <Icon className="nav-item__icon" size={20} aria-hidden="true" />
              {!sidebarCompact && (
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__account">
          <span className="avatar" aria-hidden="true">
            {initials(user.name, user.email)}
          </span>
          {!sidebarCompact && (
            <span className="sidebar__user">
              <strong>{user.name ?? user.email}</strong>
              <small>{user.role.name}</small>
            </span>
          )}
          <button
            className="icon-button sidebar__logout"
            onClick={() => void logout()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            type="button"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="icon-button topbar__menu"
            aria-controls="main-navigation"
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            aria-label={
              isMobile
                ? 'Abrir menú'
                : collapsed
                  ? 'Expandir menú'
                  : 'Contraer menú'
            }
            onClick={() =>
              isMobile
                ? setDrawerOpen((current) => !current)
                : setCollapsed((current) => !current)
            }
            type="button"
          >
            {isMobile ? (
              <Menu size={21} />
            ) : collapsed ? (
              <PanelLeftOpen size={21} />
            ) : (
              <PanelLeftClose size={21} />
            )}
          </button>
          <div className="topbar__title">
            <strong>{activeItem?.label}</strong>
            <small>
              {user.organization.name}
              {user.branch ? ` · ${user.branch.name}` : ''}
            </small>
          </div>
          <span className="topbar__role">{user.role.name}</span>
        </header>
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
