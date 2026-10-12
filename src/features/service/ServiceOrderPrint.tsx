import { createPortal } from 'react-dom'
import { formatMoney } from '../finance/format'
import {
  conditionLabels,
  formatDateTime,
  formatDay,
  formatKm,
  orderNumber,
  partsTotal,
} from './format'
import type { ServiceOrder } from './types'

// Avisos de la planilla en papel.
const NOTICES = [
  'El taller no se responsabiliza por objetos personales dejados en el vehículo.',
  'Validez del presupuesto: 15 días.',
  'Garantía de trabajos realizados: 30 días o 1.000 km (lo que ocurra primero).',
]

function Line({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="service-print__line">
      <span>{label}:</span>
      <strong>{value === null || value === undefined || value === '' ? '' : value}</strong>
    </div>
  )
}

function Box({ checked }: { checked: boolean | null }) {
  return <span className={`service-print__box${checked ? ' service-print__box--checked' : ''}`}>{checked ? '✓' : ''}</span>
}

/**
 * Orden de trabajo para imprimir, con el formato de la planilla en papel.
 * No se ve en pantalla: sólo al imprimir (`window.print()`). Se dibuja fuera
 * de la app (en `body`) para que al imprimir no queden páginas en blanco.
 */
export function ServiceOrderPrint({ order }: { order: ServiceOrder }) {
  const parts = partsTotal(order)
  const delivered = order.delivery
  const charged = delivered?.amount !== undefined && delivered.amount !== null ? Number(delivered.amount) : null
  return createPortal(
    <article aria-hidden="true" className="service-print">
      <header className="service-print__header">
        <div>
          <div className="service-print__brand">LUMA MOTOS</div>
          <p>{order.branch.name}</p>
        </div>
        <div className="service-print__title">
          <h1>ORDEN DE TRABAJO</h1>
          <h2>SERVICE</h2>
        </div>
        <table className="service-print__number">
          <tbody>
            <tr><th>Nº ORDEN</th><td>{orderNumber(order.number)}</td></tr>
            <tr><th>FECHA</th><td>{formatDay(order.receptionDate)}</td></tr>
          </tbody>
        </table>
      </header>

      <div className="service-print__columns">
        <section>
          <h3>DATOS DEL CLIENTE</h3>
          <Line label="Nombre y apellido" value={order.client.name} />
          <Line label="Teléfono" value={order.client.phone} />
          <Line label="Email" value={order.client.email} />
          <Line label="Dirección" value={order.client.address} />
          <Line label="Localidad" value={order.client.locality} />
          <Line label="DNI" value={order.client.document} />
        </section>
        <section>
          <h3>DATOS DE LA MOTO</h3>
          <Line label="Dominio" value={order.vehicle.plate} />
          <Line label="Modelo" value={order.vehicle.model} />
          <Line label="Año" value={order.vehicle.year} />
          <Line label="Nº de chasis" value={order.vehicle.chassis} />
          <Line label="Nº de motor" value={order.vehicle.engine} />
          <Line label="KM ACTUAL" value={formatKm(order.currentKm)} />
          <Line label="KM PRÓXIMO SERVICE" value={order.nextServiceKm ? formatKm(order.nextServiceKm) : ''} />
        </section>
      </div>

      <section>
        <h3>TIPO DE SERVICE SOLICITADO</h3>
        <p className="service-print__type"><Box checked /> {order.serviceType.name.toUpperCase()}</p>
        {order.receptionNotes && <p className="service-print__note">Pedido del cliente: {order.receptionNotes}</p>}
      </section>

      <div className="service-print__columns service-print__columns--work">
        <section>
          <h3>TAREAS / MANTENIMIENTO A REALIZAR</h3>
          <table className="service-print__table">
            <thead>
              <tr><th>Nº</th><th>DESCRIPCIÓN DEL TRABAJO</th><th>SÍ</th><th>NO</th><th>OBSERVACIONES</th></tr>
            </thead>
            <tbody>
              {order.tasks.map((task, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{task.description}</td>
                  <td><Box checked={task.done === true} /></td>
                  <td><Box checked={task.done === false} /></td>
                  <td>{task.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div>
          <section>
            <h3>CAMBIO DE ACEITE</h3>
            <Line label="Tipo de aceite" value={order.oil.type} />
            <Line label="Viscosidad" value={order.oil.viscosity} />
            <Line label="Cantidad (Lts)" value={order.oil.liters} />
            <p className="service-print__line">
              <span>Filtro de aceite:</span> <Box checked={order.oil.filter === true} /> SÍ <Box checked={order.oil.filter === false} /> NO
            </p>
          </section>
          <section>
            <h3>REPUESTOS / MATERIALES UTILIZADOS</h3>
            <table className="service-print__table">
              <thead>
                <tr><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>CANT.</th><th>PRECIO UNIT.</th><th>TOTAL</th></tr>
              </thead>
              <tbody>
                {(order.parts.length ? order.parts : Array.from({ length: 4 }, () => null)).map((part, index) => (
                  <tr key={index}>
                    <td>{part?.code ?? ''}</td>
                    <td>{part?.description ?? ''}</td>
                    <td>{part?.quantity ?? ''}</td>
                    <td>{part?.unitPrice ? formatMoney(part.unitPrice, 'ARS') : ''}</td>
                    <td>{part?.unitPrice ? formatMoney((Number(part.unitPrice) * part.quantity).toFixed(2), 'ARS') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="service-print__total">TOTAL REPUESTOS: {parts > 0 ? formatMoney(parts.toFixed(2), 'ARS') : '$'}</p>
          </section>
        </div>
      </div>

      <div className="service-print__columns">
        <section>
          <h3>OBSERVACIONES / DIAGNÓSTICO</h3>
          <p className="service-print__text">{order.diagnosis ?? ''}</p>
          {order.signedBy && (
            <p className="service-print__note">
              Trabajo firmado por {order.signedBy.fullName} el {formatDateTime(order.signedAt)}.
            </p>
          )}
        </section>
        <section>
          <h3>RESUMEN DE COSTOS</h3>
          <Line label="Repuestos / materiales" value={parts > 0 ? formatMoney(parts.toFixed(2), 'ARS') : ''} />
          <p className="service-print__grand">
            TOTAL GENERAL: {charged !== null ? (charged > 0 ? formatMoney(charged.toFixed(2), 'ARS') : 'Sin cargo') : '$'}
          </p>
        </section>
      </div>

      <div className="service-print__columns">
        <section>
          <h3>ENTREGA DEL VEHÍCULO</h3>
          <Line label="Fecha y hora de entrega" value={delivered ? formatDateTime(delivered.at) : ''} />
          <p className="service-print__line">
            <span>Estado del vehículo al entregar:</span>
            {(['OPTIMO', 'BUENO', 'REGULAR'] as const).map((condition) => (
              <span key={condition}> <Box checked={delivered?.vehicleCondition === condition} /> {conditionLabels[condition]}</span>
            ))}
          </p>
          <Line label="Observaciones" value={delivered?.notes} />
        </section>
        <section className="service-print__notice">
          <h3>IMPORTANTE</h3>
          <ul>
            {NOTICES.map((notice) => <li key={notice}>{notice}</li>)}
          </ul>
        </section>
      </div>

      <div className="service-print__signatures">
        <div>
          <strong>FIRMA DEL CLIENTE</strong>
          <small>Recibí conforme el vehículo y acepto los trabajos realizados detallados en la presente orden.</small>
          <span>Aclaración:</span>
          <span>DNI:</span>
        </div>
        <div>
          <strong>FIRMA DEL RESPONSABLE</strong>
          <span>Aclaración: {order.signedBy?.fullName ?? ''}</span>
          <small>LUMA MOTOS · {order.branch.name}</small>
        </div>
      </div>
      <footer>GRACIAS POR CONFIAR EN LUMA MOTOS</footer>
    </article>,
    document.body,
  )
}
