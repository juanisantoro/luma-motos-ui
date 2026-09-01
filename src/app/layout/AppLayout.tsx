import { useEffect, useRef, useState } from 'react'
import {
  Bike,
  BadgeDollarSign,
  CarFront,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  CircleDollarSign,
  FileCheck2,
  HandCoins,
  History,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  ReceiptText,
  ShoppingCart,
  ScrollText,
  ShieldAlert,
  Settings2,
  Warehouse,
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
  excludeRoles?: string[]
  activePrefix?: string
}

type NavSubGroup = {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

type NavEntry = NavItem | NavSubGroup

type NavGroup = {
  id: string
  label: string
  icon: LucideIcon
  items: NavEntry[]
}

function isNavSubGroup(entry: NavEntry): entry is NavSubGroup {
  return 'items' in entry
}

const NAV_GROUPS_STORAGE_KEY = 'luma.ui.navigation.groups'

const homeItem: NavItem = {
  label: 'Inicio',
  description: 'Resumen general',
  to: '/',
  icon: LayoutDashboard,
}

const navigationGroups: NavGroup[] = [
  {
    id: 'sales',
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      {
        id: 'sales-motos',
        label: 'Operaciones moto',
        icon: Bike,
        items: [
          {
            label: 'Mis operaciones',
            description: 'Seguimiento personal',
            to: '/motos/mis-operaciones',
            icon: ReceiptText,
            permissions: ['ventas.consultar'],
          },
          {
            label: 'Operaciones',
            description: 'Ventas y reservas',
            to: '/motos/operaciones',
            icon: Bike,
            permissions: ['ventas.consultar'],
            excludeRoles: ['VENDEDOR'],
          },
          {
            label: 'Aprobaciones',
            description: 'Control comercial',
            to: '/motos/aprobaciones',
            icon: CheckCheck,
            permissions: ['ventas.consultar', 'ventas.aprobar'],
          },
        ],
      },
      {
        id: 'sales-autos',
        label: 'Operaciones auto',
        icon: CarFront,
        items: [
          {
            label: 'Mis operaciones',
            description: 'Seguimiento personal',
            to: '/autos/mis-operaciones',
            icon: ReceiptText,
            permissions: ['ventas.consultar'],
          },
          {
            label: 'Operaciones',
            description: 'Ventas y reservas',
            to: '/autos/operaciones',
            icon: CarFront,
            permissions: ['ventas.consultar'],
            excludeRoles: ['VENDEDOR'],
          },
          {
            label: 'Aprobaciones',
            description: 'Control comercial',
            to: '/autos/aprobaciones',
            icon: CheckCheck,
            permissions: ['ventas.consultar', 'ventas.aprobar'],
          },
        ],
      },
    ],
  },
  {
    id: 'clients',
    label: 'Clientes',
    icon: UsersRound,
    items: [
      {
        label: 'Clientes',
        description: 'Gestión comercial',
        to: '/clientes',
        icon: UsersRound,
        permissions: ['clientes.consultar'],
      },
      {
        label: 'Clientes en rojo',
        description: 'Consultas rechazadas',
        to: '/consultas-crediticias',
        icon: ShieldAlert,
        permissions: ['consultas_crediticias.consultar'],
      },
    ],
  },
  {
    id: 'stock',
    label: 'Stock y abastecimiento',
    icon: Warehouse,
    items: [
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
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    icon: Images,
    items: [
      {
        label: 'Catálogo de motos',
        description: 'Modelos, stock y proveedor',
        to: '/catalogo/motos',
        icon: Bike,
        permissions: ['catalogo.consultar'],
      },
      {
        label: 'Catálogo de autos',
        description: 'Modelos, stock y proveedor',
        to: '/catalogo/autos',
        icon: CarFront,
        permissions: ['catalogo.consultar'],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Administración financiera',
    icon: CircleDollarSign,
    items: [
      {
        label: 'Compras de motos',
        description: 'Proveedores y motos',
        to: '/motos/compras',
        icon: Bike,
        permissions: ['compras.consultar'],
      },
      {
        label: 'Compras de autos',
        description: 'Proveedores y autos',
        to: '/autos/compras',
        icon: CarFront,
        permissions: ['compras.consultar'],
      },
      {
        label: 'Ingresos de motos',
        description: 'Cobros vinculados',
        to: '/motos/ingresos',
        icon: CircleDollarSign,
        permissions: ['ingresos.consultar'],
      },
      {
        label: 'Ingresos de autos',
        description: 'Cobros vinculados',
        to: '/autos/ingresos',
        icon: CircleDollarSign,
        permissions: ['ingresos.consultar'],
      },
      {
        label: 'Gastos generales',
        description: 'Egresos generales',
        to: '/gastos',
        icon: ReceiptText,
        permissions: ['gastos.consultar'],
      },
      {
        label: 'Patentes/seguros de motos',
        description: 'Documentación por unidad',
        to: '/motos/pagos-vehiculo',
        icon: FileCheck2,
        permissions: ['pagos_vehiculo.consultar'],
      },
      {
        label: 'Patentes/seguros de autos',
        description: 'Documentación por unidad',
        to: '/autos/pagos-vehiculo',
        icon: FileCheck2,
        permissions: ['pagos_vehiculo.consultar'],
      },
    ],
  },
  {
    id: 'commissions',
    label: 'Comisiones',
    icon: BadgeDollarSign,
    items: [
      {
        label: 'Sugerido',
        description: 'Cálculo por escala',
        to: '/comisiones/sugerido/motos',
        activePrefix: '/comisiones/sugerido/',
        icon: BadgeDollarSign,
        permissions: ['comisiones.consultar'],
      },
      {
        label: 'Visualizar con vendedor',
        description: 'Reunión y acuerdo',
        to: '/comisiones/reunion/motos',
        activePrefix: '/comisiones/reunion/',
        icon: Presentation,
        permissions: ['comisiones.consultar'],
      },
      {
        label: 'Pagar',
        description: 'Liquidaciones pendientes',
        to: '/comisiones/pagar/motos',
        activePrefix: '/comisiones/pagar/',
        icon: HandCoins,
        permissions: ['comisiones.pagar'],
      },
      {
        label: 'Pagadas',
        description: 'Histórico y auditoría',
        to: '/comisiones/pagadas/motos',
        activePrefix: '/comisiones/pagadas/',
        icon: History,
        permissions: ['comisiones.historial'],
      },
      {
        label: 'Escalas',
        description: 'Montos y vigencias',
        to: '/comisiones/escalas/motos',
        activePrefix: '/comisiones/escalas/',
        icon: Settings2,
        permissions: ['comisiones.configurar'],
      },
      {
        label: 'Mis comisiones',
        description: 'Progreso personal',
        to: '/mis-comisiones',
        icon: BadgeDollarSign,
        permissions: ['comisiones.propias'],
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuración',
    icon: Settings2,
    items: [
      {
        label: 'Usuarios',
        description: 'Personas y accesos',
        to: '/usuarios',
        icon: UsersRound,
        permissions: ['usuarios.consultar'],
      },
      {
        label: 'Roles y permisos',
        description: 'Perfiles de acceso',
        to: '/usuarios/roles',
        icon: ClipboardList,
        permissions: ['roles.consultar'],
      },
      {
        label: 'Auditoría',
        description: 'Actividad del sistema',
        to: '/auditoria',
        icon: ScrollText,
        permissions: ['auditoria.consultar'],
      },
    ],
  },
]

function storedOpenGroups() {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(NAV_GROUPS_STORAGE_KEY) ?? '[]',
    )
    return new Set<string>(
      Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === 'string')
        : [],
    )
  } catch {
    return new Set<string>()
  }
}

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
  const [openGroups, setOpenGroups] = useState(storedOpenGroups)
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

  const roleCode = user?.role.code
  const permissions = user?.role.permissions ?? []
  const passesAccess = (item: Pick<NavItem, 'excludeRoles' | 'permissions'>) =>
    !item.excludeRoles?.includes(roleCode ?? '') &&
    (!item.permissions ||
      item.permissions.every((permission) =>
        hasPermission(permissions, permission),
      ))
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((entry) =>
          isNavSubGroup(entry)
            ? { ...entry, items: entry.items.filter(passesAccess) }
            : entry,
        )
        .filter((entry) =>
          isNavSubGroup(entry) ? entry.items.length > 0 : passesAccess(entry),
        ),
    }))
    .filter((group) => group.items.length > 0)
  const navigationItems = [
    homeItem,
    ...visibleGroups.flatMap((group) =>
      group.items.flatMap((entry) =>
        isNavSubGroup(entry) ? entry.items : [entry],
      ),
    ),
  ]
  const activeItem =
    navigationItems
      .filter((item) =>
        item.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.activePrefix ?? item.to),
      )
      .sort(
        (left, right) =>
          (right.activePrefix ?? right.to).length -
          (left.activePrefix ?? left.to).length,
      )[0] ?? homeItem
  const isItemActive = (item: Pick<NavItem, 'to'>) =>
    item.to === activeItem.to
  const entryContainsActive = (entry: NavEntry): boolean =>
    isNavSubGroup(entry) ? entry.items.some(isItemActive) : isItemActive(entry)
  const activeGroup = visibleGroups.find((group) =>
    group.items.some(entryContainsActive),
  )
  const activeSubGroup = visibleGroups
    .flatMap((group) => group.items)
    .filter(isNavSubGroup)
    .find((subGroup) => subGroup.items.some(isItemActive))
  const sidebarCompact = collapsed && !isMobile
  const visibleGroupKey = visibleGroups
    .flatMap((group) => [
      group.id,
      ...group.items.filter(isNavSubGroup).map((subGroup) => subGroup.id),
    ])
    .join('|')
  const activeGroupId = activeGroup?.id
  const activeSubGroupId = activeSubGroup?.id

  useEffect(() => {
    const available = new Set(visibleGroupKey ? visibleGroupKey.split('|') : [])
    setOpenGroups((current) => {
      const next = new Set(
        [...current].filter((groupId) => available.has(groupId)),
      )
      if (activeGroupId) next.add(activeGroupId)
      if (activeSubGroupId) next.add(activeSubGroupId)
      const unchanged =
        next.size === current.size &&
        [...next].every((groupId) => current.has(groupId))
      return unchanged ? current : next
    })
  }, [activeGroupId, activeSubGroupId, roleCode, visibleGroupKey])

  useEffect(() => {
    sessionStorage.setItem(
      NAV_GROUPS_STORAGE_KEY,
      JSON.stringify([...openGroups]),
    )
  }, [openGroups])

  if (!user) return null

  const toggleGroup = (groupId: string) => {
    if (sidebarCompact) {
      setCollapsed(false)
      setOpenGroups((current) => new Set(current).add(groupId))
      return
    }
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    return (
      <NavLink
        className={() =>
          `nav-item nav-item--nested ${isItemActive(item) ? 'nav-item--active' : ''}`
        }
        end={item.to === '/' || item.to.endsWith('/operaciones')}
        key={item.to}
        to={item.to}
        onClick={() => setDrawerOpen(false)}
      >
        <Icon className="nav-item__icon" size={18} aria-hidden="true" />
        <span>
          <strong>{item.label}</strong>
          <small>{item.description}</small>
        </span>
      </NavLink>
    )
  }

  const renderSubGroup = (subGroup: NavSubGroup) => {
    const SubGroupIcon = subGroup.icon
    const expanded = !sidebarCompact && openGroups.has(subGroup.id)
    const containsActive = activeSubGroupId === subGroup.id
    const panelId = `navigation-group-${subGroup.id}`
    return (
      <section className="nav-group nav-group--sub" key={subGroup.id}>
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          aria-label={
            sidebarCompact ? `Abrir grupo ${subGroup.label}` : undefined
          }
          className={`nav-group__toggle ${containsActive ? 'nav-group__toggle--active' : ''}`}
          onClick={() => toggleGroup(subGroup.id)}
          title={sidebarCompact ? subGroup.label : undefined}
          type="button"
        >
          <SubGroupIcon size={18} aria-hidden="true" />
          {!sidebarCompact && (
            <>
              <span>{subGroup.label}</span>
              <ChevronDown
                className="nav-group__chevron"
                size={16}
                aria-hidden="true"
              />
            </>
          )}
        </button>
        <div
          aria-hidden={!expanded}
          className={`nav-group__items ${expanded ? 'nav-group__items--open' : ''}`}
          id={panelId}
          inert={!expanded}
        >
          <div className="nav-group__items-inner">
            {subGroup.items.map((item) => renderNavItem(item))}
          </div>
        </div>
      </section>
    )
  }

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
          <NavLink
            className={() =>
              `nav-item nav-item--root ${isItemActive(homeItem) ? 'nav-item--active' : ''}`
            }
            end
            title={sidebarCompact ? homeItem.label : undefined}
            to={homeItem.to}
            onClick={() => setDrawerOpen(false)}
          >
            <LayoutDashboard
              className="nav-item__icon"
              size={20}
              aria-hidden="true"
            />
            {!sidebarCompact && (
              <span>
                <strong>{homeItem.label}</strong>
                <small>{homeItem.description}</small>
              </span>
            )}
          </NavLink>
          <div className="nav-groups">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon
              const expanded = !sidebarCompact && openGroups.has(group.id)
              const containsActive = activeGroup?.id === group.id
              const panelId = `navigation-group-${group.id}`
              return (
                <section className="nav-group" key={group.id}>
                  <button
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    aria-label={
                      sidebarCompact
                        ? `Abrir grupo ${group.label}`
                        : undefined
                    }
                    className={`nav-group__toggle ${containsActive ? 'nav-group__toggle--active' : ''}`}
                    onClick={() => toggleGroup(group.id)}
                    title={sidebarCompact ? group.label : undefined}
                    type="button"
                  >
                    <GroupIcon size={20} aria-hidden="true" />
                    {!sidebarCompact && (
                      <>
                        <span>{group.label}</span>
                        <ChevronDown
                          className="nav-group__chevron"
                          size={17}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                  <div
                    aria-hidden={!expanded}
                    className={`nav-group__items ${expanded ? 'nav-group__items--open' : ''}`}
                    id={panelId}
                    inert={!expanded}
                  >
                    <div className="nav-group__items-inner">
                      {group.items.map((entry) =>
                        isNavSubGroup(entry)
                          ? renderSubGroup(entry)
                          : renderNavItem(entry),
                      )}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
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
