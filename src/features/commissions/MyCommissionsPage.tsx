import { Bike, CarFront, RefreshCw, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import {
  CommissionOperations,
  CommissionProgress,
  CommissionStatusBadge,
} from './components'
import {
  commissionErrorMessage,
  formatCommissionDate,
  formatCommissionMoney,
  formatPeriod,
  tierLabel,
  vehicleLabels,
} from './format'
import type {
  CommissionGateway,
  CommissionVehicleType,
  MyCommissions,
} from './types'

function currentPeriod() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function MyCommissionsPage({ gateway }: { gateway: CommissionGateway }) {
  const [period, setPeriod] = useState(currentPeriod)
  const [results, setResults] = useState<Partial<Record<CommissionVehicleType, MyCommissions>>>({})
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void Promise.all([
      gateway.getMine(period, 'MOTO', controller.signal),
      gateway.getMine(period, 'AUTO', controller.signal),
    ])
      .then(([moto, auto]) => {
        setResults({ MOTO: moto, AUTO: auto })
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, period, refreshKey])

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">MI DESEMPEÑO</p>
          <h1>Mis comisiones</h1>
          <p>Tu progreso y tus pagos. Esta pantalla no permite consultar a otros vendedores.</p>
        </div>
        <label className="commission-period-field">
          <span>Período</span>
          <input aria-label="Período" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
      </header>

      {status === 'loading' && <div className="commission-loading commission-loading--page"><RefreshCw className="spin" size={24} /> Cargando tus comisiones…</div>}
      {status === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar tus comisiones" description={error} tone="danger" action={<button className="button button--primary" type="button" onClick={() => setRefreshKey((key) => key + 1)}>Reintentar</button>} />}
      {status === 'success' && (
        <div className="my-commissions">
          {(['MOTO', 'AUTO'] as const).map((vehicleType) => {
            const result = results[vehicleType]
            if (!result) return null
            const detail = result.progress
            const Icon = vehicleType === 'MOTO' ? Bike : CarFront
            return (
              <section className="my-commission-section" key={vehicleType} aria-labelledby={`my-${vehicleType.toLowerCase()}`}>
                <header className="my-commission-section__header">
                  <span><Icon size={22} /></span>
                  <div><p className="eyebrow">{formatPeriod(period)}</p><h2 id={`my-${vehicleType.toLowerCase()}`}>{vehicleLabels[vehicleType]}</h2></div>
                  <CommissionStatusBadge status={detail.status} />
                </header>
                {detail.configurationStatus === 'NOT_CONFIGURED' ? (
                  <StatePanel icon={WalletCards} title="Escalas no configuradas" description={`Todavía no existe una política de ${vehicleLabels[vehicleType].toLowerCase()} para este período.`} />
                ) : (
                  <>
                    <CommissionProgress commission={detail} />
                    <div className="commission-own-message">
                      Hoy cobrarías <strong>{formatCommissionMoney(detail.suggestedAmount)}</strong> como monto fijo total por la escala {tierLabel(detail.scale)}.
                      {detail.unitsToNextScale !== null && <> Te faltan <strong>{detail.unitsToNextScale} ventas</strong> para la próxima escala.</>}
                    </div>
                    <div className="commission-meeting__section-title"><div><h3>Tus operaciones</h3><p>Las no computables incluyen el motivo informado por el sistema.</p></div></div>
                    <CommissionOperations operations={detail.operations} />
                  </>
                )}

                <div className="commission-meeting__section-title"><div><h3>Tus comisiones pagadas</h3><p>Histórico exclusivo de {vehicleLabels[vehicleType].toLowerCase()}.</p></div></div>
                {result.paidHistory.items.length === 0 ? (
                  <p className="commission-empty-note">Todavía no tenés pagos registrados para este tipo de vehículo.</p>
                ) : (
                  <>
                    <div className="commission-desktop-table">
                      <table className="financial-table commission-table">
                        <thead><tr><th>Fecha</th><th>Período</th><th>Tipo</th><th>Cantidad</th><th>Escala</th><th>Monto</th></tr></thead>
                        <tbody>{result.paidHistory.items.map((item) => (
                          <tr key={item.id}><td>{formatCommissionDate(item.paidAt)}</td><td>{formatPeriod(item.period)}</td><td>{vehicleLabels[item.vehicleType]}</td><td>{item.computableSales}</td><td>{tierLabel(item.scaleSnapshot)}</td><td><strong>{formatCommissionMoney(item.paidAmount)}</strong></td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="commission-card-list">{result.paidHistory.items.map((item) => (
                      <article className="commission-card" key={item.id}><header><div><strong>{formatPeriod(item.period)}</strong><small>{formatCommissionDate(item.paidAt)}</small></div><CommissionStatusBadge status="PAID" /></header><dl><div><dt>Cantidad</dt><dd>{item.computableSales}</dd></div><div><dt>Escala</dt><dd>{tierLabel(item.scaleSnapshot)}</dd></div><div><dt>Monto</dt><dd><strong>{formatCommissionMoney(item.paidAmount)}</strong></dd></div></dl></article>
                    ))}</div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
