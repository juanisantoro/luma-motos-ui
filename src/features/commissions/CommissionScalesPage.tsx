import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { StatePanel } from '../../shared/components/StatePanel'
import { VehicleTypeNav } from './components'
import { alertError, alertSuccess } from '../../shared/alerts'
import {
  commissionErrorMessage,
  formatCommissionDate,
  formatCommissionMoney,
  localIsoDate,
  tierLabel,
  validateScalePolicy,
  vehicleLabels,
} from './format'
import type {
  CommissionGateway,
  CommissionScalePolicy,
  CommissionVehicleType,
  SaveScalePolicyInput,
} from './types'

type DraftTier = {
  key: string
  minUnits: string
  maxUnits: string
  fixedAmount: string
}

function newTier(minUnits = '1'): DraftTier {
  return {
    key: crypto.randomUUID(),
    minUnits,
    maxUnits: '',
    fixedAmount: '',
  }
}

export function CommissionScalesPage({
  vehicleType,
  gateway,
}: {
  vehicleType: CommissionVehicleType
  gateway: CommissionGateway
}) {
  const [policies, setPolicies] = useState<CommissionScalePolicy[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [validFrom, setValidFrom] = useState(localIsoDate)
  const [validTo, setValidTo] = useState('')
  const [tiers, setTiers] = useState<DraftTier[]>([newTier()])
  const [validation, setValidation] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    void gateway.listPolicies(vehicleType, controller.signal)
      .then((result) => {
        setPolicies(result.items)
        setStatus('success')
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(commissionErrorMessage(loadError))
        setStatus('error')
      })
    return () => controller.abort()
  }, [gateway, refreshKey, vehicleType])

  const updateTier = (key: string, field: keyof Omit<DraftTier, 'key'>, value: string) => {
    setTiers((current) => current.map((tier) => tier.key === key ? { ...tier, [field]: value } : tier))
    setValidation([])
  }

  const moveTier = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= tiers.length) return
    setTiers((current) => {
      const next = [...current]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(destination, 0, moved)
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const input: SaveScalePolicyInput = {
      vehicleType,
      currency: 'ARS',
      validFrom,
      ...(validTo ? { validTo } : {}),
      status: 'ACTIVE',
      tiers: tiers.map((tier) => ({
        minUnits: Number(tier.minUnits),
        maxUnits: tier.maxUnits ? Number(tier.maxUnits) : null,
        fixedAmount: Number(tier.fixedAmount).toFixed(2),
      })),
    }
    const errors = validateScalePolicy(input)
    if (validTo && validTo < validFrom) errors.push('La fecha hasta no puede ser anterior a la vigencia.')
    setValidation(errors)
    if (errors.length) return

    setSubmitting(true)
    setError('')
    try {
      await gateway.savePolicy(input)
      const successMessage = `Nueva escala de ${vehicleLabels[vehicleType].toLowerCase()} guardada. Los históricos no se modificaron.`
      setNotice(successMessage)
      setTiers([newTier()])
      setValidTo('')
      setRefreshKey((key) => key + 1)
      void alertSuccess(successMessage)
    } catch (saveError) {
      const message = commissionErrorMessage(saveError)
      setError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const active = policies.filter((policy) => policy.status === 'ACTIVE')

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COMISIONES · CONFIGURACIÓN</p>
          <h1>Configuración de escalas</h1>
          <p>Definí rangos y un monto fijo total por período. El cálculo ocurre exclusivamente en el backend.</p>
        </div>
      </header>
      <VehicleTypeNav active={vehicleType} path="/comisiones/escalas" />
      <div className="commission-history-warning">
        <SlidersHorizontal size={20} />
        <p><strong>Los cambios tienen vigencia hacia adelante.</strong> Las liquidaciones pagadas conservan la escala y el monto que tenían al momento del pago.</p>
      </div>

      <section className="commission-policy-list">
        <div className="commission-section-heading"><div><h2>Escalas vigentes</h2><p>{vehicleLabels[vehicleType]} se administra como un circuito independiente.</p></div></div>
        {status === 'loading' && <div className="commission-loading"><RefreshCw className="spin" size={22} /> Cargando escalas…</div>}
        {status === 'error' && <StatePanel icon={RefreshCw} title="No pudimos cargar las escalas" description={error} tone="danger" action={<button className="button button--primary" type="button" onClick={() => setRefreshKey((key) => key + 1)}>Reintentar</button>} />}
        {status === 'success' && active.length === 0 && (
          <StatePanel
            icon={SlidersHorizontal}
            title="Escalas no configuradas"
            description={`No hay una política activa para ${vehicleLabels[vehicleType].toLowerCase()}. Hasta configurarla, el sistema no sugerirá montos.`}
          />
        )}
        {status === 'success' && active.map((policy) => (
          <article className="commission-policy-card" key={policy.id}>
            <header>
              <div><strong>Vigente desde {formatCommissionDate(policy.validFrom)}</strong><span>{policy.validTo ? `hasta ${formatCommissionDate(policy.validTo)}` : 'sin fecha de fin'}</span></div>
              <span className="status-badge status-badge--success">Activa</span>
            </header>
            <div className="commission-tier-strip">
              {policy.tiers.map((tier) => <article key={tier.id}><small>{tierLabel(tier)} ventas</small><strong>{formatCommissionMoney(tier.fixedAmount)}</strong><span>total del período</span></article>)}
            </div>
          </article>
        ))}
      </section>

      <section className="commission-scale-editor">
        <header><div><p className="eyebrow">NUEVA VIGENCIA</p><h2>Crear escala de {vehicleLabels[vehicleType].toLowerCase()}</h2></div></header>
        {notice && <div className="form-alert" role="status">{notice}</div>}
        {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
        {validation.length > 0 && <div className="form-alert form-alert--error" role="alert"><strong>Revisá la escala:</strong><ul>{validation.map((message) => <li key={message}>{message}</li>)}</ul></div>}
        <form onSubmit={submit}>
          <div className="commission-validity-fields">
            <label className="field"><span>Vigente desde *</span><input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required /></label>
            <label className="field"><span>Vigente hasta</span><input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} /></label>
          </div>
          <div className="commission-tier-editor" aria-label="Tramos de la escala">
            {tiers.map((tier, index) => (
              <fieldset key={tier.key}>
                <legend>Tramo {index + 1}</legend>
                <label className="field"><span>Mínimo *</span><input aria-label={`Mínimo tramo ${index + 1}`} type="number" min="1" value={tier.minUnits} onChange={(event) => updateTier(tier.key, 'minUnits', event.target.value)} required /></label>
                <label className="field"><span>Máximo {index === tiers.length - 1 && '(abierto)'}</span><input aria-label={`Máximo tramo ${index + 1}`} type="number" min="1" value={tier.maxUnits} disabled={index === tiers.length - 1} onChange={(event) => updateTier(tier.key, 'maxUnits', event.target.value)} placeholder={index === tiers.length - 1 ? 'Sin límite' : ''} /></label>
                <label className="field"><span>Monto fijo total *</span><input aria-label={`Monto tramo ${index + 1}`} type="number" min="0" step="0.01" value={tier.fixedAmount} onChange={(event) => updateTier(tier.key, 'fixedAmount', event.target.value)} required /></label>
                <div className="commission-tier-actions">
                  <button className="icon-button" aria-label={`Subir tramo ${index + 1}`} type="button" disabled={index === 0} onClick={() => moveTier(index, -1)}><ArrowUp size={17} /></button>
                  <button className="icon-button" aria-label={`Bajar tramo ${index + 1}`} type="button" disabled={index === tiers.length - 1} onClick={() => moveTier(index, 1)}><ArrowDown size={17} /></button>
                  <button className="icon-button button--danger" aria-label={`Eliminar tramo ${index + 1}`} type="button" disabled={tiers.length === 1} onClick={() => setTiers((current) => current.filter((item) => item.key !== tier.key))}><Trash2 size={17} /></button>
                </div>
              </fieldset>
            ))}
          </div>
          <footer className="commission-scale-actions">
            <button className="button button--secondary" type="button" onClick={() => {
              const previous = tiers.at(-1)
              const nextMinimum = previous?.maxUnits ? String(Number(previous.maxUnits) + 1) : ''
              setTiers((current) => [...current, newTier(nextMinimum)])
            }}><Plus size={17} /> Agregar tramo</button>
            <button className="button button--primary" type="submit" disabled={submitting}><Save size={17} /> {submitting ? 'Guardando…' : 'Guardar nueva vigencia'}</button>
          </footer>
        </form>
      </section>
    </>
  )
}
