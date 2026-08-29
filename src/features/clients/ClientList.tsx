import { Pencil, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useMediaQuery } from '../../shared/hooks/useMediaQuery'
import type { Client } from './types'

type ClientListProps = {
  clients: Client[]
  canManage: boolean
  busyClientId: string | null
  onEdit: (client: Client) => void
  onToggleStatus: (client: Client) => void
}

function clientDocument(client: Client) {
  if (!client.documentType || !client.documentNumber) return 'Sin documento'
  return `${client.documentType} ${client.documentNumber}`
}

function clientContact(client: Client) {
  return client.email ?? client.phone ?? 'Sin datos de contacto'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function ClientActions({
  client,
  busy,
  onEdit,
  onToggleStatus,
}: {
  client: Client
  busy: boolean
  onEdit: (client: Client) => void
  onToggleStatus: (client: Client) => void
}) {
  return (
    <div className="client-actions">
      <button
        className="icon-button table-action"
        aria-label={`Editar a ${client.fullName}`}
        disabled={busy}
        onClick={() => onEdit(client)}
        title="Editar cliente"
        type="button"
      >
        <Pencil size={17} />
      </button>
      <button
        className="icon-button table-action"
        aria-label={`${client.active ? 'Desactivar' : 'Activar'} a ${client.fullName}`}
        disabled={busy}
        onClick={() => onToggleStatus(client)}
        title={client.active ? 'Desactivar cliente' : 'Activar cliente'}
        type="button"
      >
        {client.active ? (
          <UserRoundX size={18} />
        ) : (
          <UserRoundCheck size={18} />
        )}
      </button>
    </div>
  )
}

export function ClientList({
  clients,
  canManage,
  busyClientId,
  onEdit,
  onToggleStatus,
}: ClientListProps) {
  const isCardLayout = useMediaQuery('(max-width: 768px)')

  if (isCardLayout) {
    return (
      <div className="client-card-list">
        {clients.map((client) => (
          <article className="client-card" key={client.id}>
            <div className="client-card__top">
              <div>
                <strong>{client.fullName}</strong>
                <span>{clientDocument(client)}</span>
              </div>
              <span
                className={`status-badge ${client.active ? 'status-badge--success' : ''}`}
              >
                {client.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <dl>
              <div>
                <dt>Contacto</dt>
                <dd>{clientContact(client)}</dd>
              </div>
              <div>
                <dt>Organización</dt>
                <dd>{client.organization.name}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{formatDate(client.updatedAt)}</dd>
              </div>
            </dl>
            {canManage && (
              <ClientActions
                client={client}
                busy={busyClientId === client.id}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
              />
            )}
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="client-table-wrap">
      <table className="client-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Documento</th>
            <th>Contacto</th>
            <th>Organización</th>
            <th>Estado</th>
            <th>Actualizado</th>
            {canManage && (
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>
                <strong>{client.fullName}</strong>
              </td>
              <td>{clientDocument(client)}</td>
              <td>{clientContact(client)}</td>
              <td>{client.organization.name}</td>
              <td>
                <span
                  className={`status-badge ${client.active ? 'status-badge--success' : ''}`}
                >
                  {client.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>{formatDate(client.updatedAt)}</td>
              {canManage && (
                <td>
                  <ClientActions
                    client={client}
                    busy={busyClientId === client.id}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
