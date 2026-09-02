import {
  Eye,
  Gavel,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { alertError } from '../../shared/alerts'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { getBcraSituacion } from './api'
import './bcra-check.css'
import {
  bcraErrorMessage,
  formatConsultadoEn,
  formatCuit,
  formatMontoMiles,
  formatPeriodo,
  isValidCuit,
  montoIrregularLine,
  normalizeCuit,
  situacionLabel,
  situacionTone,
  veredictoDescription,
  veredictoLabels,
} from './format'
import type { BcraCheckState, BcraVeredicto } from './types'

const veredictoIcon: Record<BcraVeredicto, LucideIcon> = {
  VERDE: ShieldCheck,
  AMARILLO: ShieldAlert,
  ROJO: ShieldX,
  SIN_DATOS: Search,
}

export function BcraCheckPage() {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canSeeDetail = hasPermission(permissions, 'creditos.bcra.detalle')

  const [rawInput, setRawInput] = useState('')
  const [state, setState] = useState<BcraCheckState>({ status: 'idle' })

  const digits = normalizeCuit(rawInput)
  const validInput = isValidCuit(digits)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validInput || state.status === 'loading') return

    setState({ status: 'loading' })
    try {
      const data = await getBcraSituacion(digits)
      setState({ status: 'success', data })
    } catch (error) {
      const message = bcraErrorMessage(error)
      setState({ status: 'error', message })
      void alertError(message)
    }
  }

  const resumen = state.status === 'success' ? state.data.resumen : null
  const detalle = state.status === 'success' ? state.data.detalle : undefined
  const Icon = resumen ? veredictoIcon[resumen.veredicto] : null
  const montoLine = resumen ? montoIrregularLine(resumen) : null

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CRÉDITOS PERSONALES</p>
          <h1>Consulta BCRA</h1>
          <p>
            Verificá antecedentes de mora de un cliente en la Central de
            Deudores del BCRA antes de avanzar con un crédito personal.
          </p>
        </div>
      </header>

      <form className="bcra-search" onSubmit={(event) => void submit(event)}>
        <div className="filter-field">
          <label htmlFor="bcra-cuit">CUIT / CUIL</label>
          <input
            autoComplete="off"
            id="bcra-cuit"
            inputMode="numeric"
            onChange={(event) => setRawInput(formatCuit(event.target.value))}
            placeholder="20-38097441-0"
            value={rawInput}
          />
        </div>
        <button
          className="button button--primary"
          disabled={!validInput || state.status === 'loading'}
          type="submit"
        >
          <ScanSearch size={18} aria-hidden="true" />
          Consultar
        </button>
      </form>
      {rawInput.length > 0 && !validInput && (
        <p className="bcra-search__hint">
          Revisá el CUIT/CUIL ingresado: tiene que tener 11 dígitos y un
          dígito verificador válido.
        </p>
      )}

      {state.status === 'loading' && (
        <div className="bcra-result__loading" role="status">
          <RefreshCw className="bcra-result__spin" size={20} aria-hidden="true" />
          <span>Consultando la Central de Deudores del BCRA…</span>
        </div>
      )}

      {resumen && Icon && (
        <section
          aria-label="Resultado de la consulta BCRA"
          className={`bcra-result bcra-result--${resumen.veredicto.toLowerCase()}`}
        >
          <div className="bcra-result__head">
            <Icon aria-hidden="true" size={26} />
            <div>
              <h2>{veredictoLabels[resumen.veredicto]}</h2>
              <p>{veredictoDescription(resumen)}</p>
              {montoLine && <p className="bcra-result__monto">{montoLine}</p>}
            </div>
          </div>

          <dl>
            <div>
              <dt>Nombre según BCRA</dt>
              <dd>{resumen.denominacion ?? 'No informado'}</dd>
            </div>
            <div>
              <dt>CUIT/CUIL consultado</dt>
              <dd>{formatCuit(resumen.identificacion)}</dd>
            </div>
            <div>
              <dt>Período informado más reciente</dt>
              <dd>
                {resumen.periodoMasReciente
                  ? formatPeriodo(resumen.periodoMasReciente)
                  : 'Sin datos'}
              </dd>
            </div>
            <div>
              <dt>Consultado</dt>
              <dd>{formatConsultadoEn(resumen.consultadoEn)}</dd>
            </div>
          </dl>

          {(resumen.procesoJudActual ||
            resumen.enRevisionActual ||
            resumen.antecedenteSeveroReciente) && (
            <div className="bcra-result__flags">
              {resumen.procesoJudActual && (
                <span className="bcra-result__flag">
                  <Gavel size={14} aria-hidden="true" />
                  Proceso judicial activo
                </span>
              )}
              {resumen.antecedenteSeveroReciente && (
                <span className="bcra-result__flag">
                  Registró mora en los últimos 24 meses
                </span>
              )}
              {resumen.enRevisionActual && (
                <span className="bcra-result__flag bcra-result__flag--neutral">
                  <Eye size={14} aria-hidden="true" />
                  Información sometida a revisión
                </span>
              )}
            </div>
          )}

          {canSeeDetail && detalle && (
            <details className="bcra-detail">
              <summary>
                Ver detalle completo ({detalle.periodos.length}{' '}
                {detalle.periodos.length === 1 ? 'período' : 'períodos'})
              </summary>
              {detalle.periodos.length === 0 && (
                <p className="bcra-detail__note">
                  El BCRA no informó entidades ni períodos para este CUIT/CUIL.
                </p>
              )}
              {detalle.periodos.map((periodo) => (
                <div className="bcra-detail__period" key={periodo.periodo}>
                  <h3>{formatPeriodo(periodo.periodo)}</h3>
                  <div className="financial-table-wrap">
                    <table className="financial-table">
                      <thead>
                        <tr>
                          <th>Entidad</th>
                          <th>Situación</th>
                          <th>Monto</th>
                          <th>Revisión</th>
                          <th>Proceso judicial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodo.entidades.map((entidad, index) => (
                          <tr key={`${periodo.periodo}-${entidad.entidad}-${index}`}>
                            <td>{entidad.entidad}</td>
                            <td>
                              <span
                                className={`status-badge${situacionTone(entidad.situacion)}`}
                              >
                                {situacionLabel(entidad.situacion)}
                              </span>
                            </td>
                            <td>{formatMontoMiles(entidad.monto)}</td>
                            <td>{entidad.enRevision ? 'Sí' : 'No'}</td>
                            <td>{entidad.procesoJud ? 'Sí' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="bcra-detail__note">
                Montos informados por el BCRA en miles de pesos, ya
                convertidos aquí a su valor total.
              </p>
            </details>
          )}
        </section>
      )}
    </>
  )
}
