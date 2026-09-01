import { Calculator, LoaderCircle, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { simulateCredit } from './creditCalculator'
import { calculationMethodLabels, formatMoney } from './format'
import type { CreateCreditPlanInput, CreditCalculationMethod, CreditPlan } from './types'

type CreditPlanModalProps = {
  plan: CreditPlan | null
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: CreateCreditPlanInput) => void
}

export function CreditPlanModal({
  plan,
  submitting,
  error,
  onClose,
  onSubmit,
}: CreditPlanModalProps) {
  const dialogRef = useDialogFocus(onClose, submitting)
  const [name, setName] = useState(plan?.name ?? '')
  const [calculationMethod, setCalculationMethod] = useState<CreditCalculationMethod>(
    plan?.calculationMethod ?? 'FRANCES',
  )
  const [installmentCount, setInstallmentCount] = useState(
    plan ? String(plan.installmentCount) : '12',
  )
  const [interestRate, setInterestRate] = useState(
    plan ? String(plan.interestRate) : '3',
  )
  const [minimumAmount, setMinimumAmount] = useState(
    plan?.minimumAmount !== null && plan?.minimumAmount !== undefined
      ? String(plan.minimumAmount)
      : '',
  )
  const [maximumAmount, setMaximumAmount] = useState(
    plan?.maximumAmount !== null && plan?.maximumAmount !== undefined
      ? String(plan.maximumAmount)
      : '',
  )
  const [active, setActive] = useState(plan?.active ?? true)
  const [exampleAmount, setExampleAmount] = useState('1000000')
  const [validation, setValidation] = useState<string[]>([])

  const example = useMemo(
    () =>
      simulateCredit(
        Number(exampleAmount),
        Number(installmentCount) || 0,
        Number(interestRate),
        calculationMethod,
      ),
    [exampleAmount, installmentCount, interestRate, calculationMethod],
  )

  const rateLabel = calculationMethod === 'FRANCES' ? 'mensual' : 'total del crédito'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: string[] = []
    const trimmedName = name.trim()
    const parsedInstallments = Number(installmentCount)
    const parsedRate = Number(interestRate)
    const parsedMinimum = minimumAmount ? Number(minimumAmount) : undefined
    const parsedMaximum = maximumAmount ? Number(maximumAmount) : undefined

    if (!trimmedName) errors.push('Ingresá un nombre para el plan.')
    if (!Number.isInteger(parsedInstallments) || parsedInstallments < 1) {
      errors.push('La cantidad de cuotas debe ser un entero mayor a cero.')
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      errors.push('Ingresá una tasa de interés válida.')
    }
    if (
      parsedMinimum !== undefined &&
      parsedMaximum !== undefined &&
      parsedMaximum < parsedMinimum
    ) {
      errors.push('El monto máximo no puede ser menor al monto mínimo.')
    }
    setValidation(errors)
    if (errors.length) return

    onSubmit({
      name: trimmedName,
      calculationMethod,
      installmentCount: parsedInstallments,
      interestRate: parsedRate,
      ...(parsedMinimum !== undefined ? { minimumAmount: parsedMinimum } : {}),
      ...(parsedMaximum !== undefined ? { maximumAmount: parsedMaximum } : {}),
      active,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="credit-plan-modal-title"
        aria-modal="true"
        className="stock-modal stock-modal--wide"
        ref={dialogRef}
        role="dialog"
      >
        <header className="stock-modal__header">
          <div>
            <p className="eyebrow">CRÉDITOS PERSONALES</p>
            <h2 id="credit-plan-modal-title">
              {plan ? 'Editar plan de crédito' : 'Nuevo plan de crédito'}
            </h2>
            <p>Definí las cuotas, la tasa y el método de cálculo del interés.</p>
          </div>
          <button
            aria-label="Cerrar"
            className="icon-button"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {error && (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        )}
        {validation.length > 0 && (
          <div className="form-alert form-alert--error" role="alert">
            <strong>Revisá el plan:</strong>
            <ul>
              {validation.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="stock-form-section">
          <div className="stock-form-section__heading">
            <span>i</span>
            <div>
              <h3>¿Cómo se calcula cada método?</h3>
              <p>Elegí el que tenga más sentido para este plan antes de guardar.</p>
            </div>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>Sistema francés (cuota fija):</strong> todas las cuotas dan el mismo
            importe. Se calcula con la fórmula de amortización francesa —
            cuota = P × (i × (1+i)ⁿ) ⁄ ((1+i)ⁿ − 1) — donde P es el monto financiado,
            i la tasa <em>mensual</em> en decimal (3% → 0,03) y n la cantidad de cuotas.
            Al principio se paga más interés y menos capital; hacia el final, al revés.
          </p>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>Interés simple prorrateado:</strong> el interés se calcula UNA sola
            vez sobre el monto financiado — interés total = P × tasa (acá la tasa es{' '}
            <em>total</em>, no mensual) — y el total (capital + interés) se reparte en
            partes iguales: cuota = (P + interés total) ⁄ n.
          </p>
        </section>

        <form onSubmit={submit}>
          <div className="stock-form-grid">
            <label className="field operation-span-2">
              <span>Nombre del plan *</span>
              <input
                autoFocus
                maxLength={160}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <label className="field">
              <span>Método de cálculo *</span>
              <select
                onChange={(event) =>
                  setCalculationMethod(event.target.value as CreditCalculationMethod)
                }
                value={calculationMethod}
              >
                <option value="FRANCES">{calculationMethodLabels.FRANCES}</option>
                <option value="INTERES_SIMPLE">
                  {calculationMethodLabels.INTERES_SIMPLE}
                </option>
              </select>
            </label>
            <label className="field">
              <span>Cantidad de cuotas *</span>
              <input
                min="1"
                max="360"
                onChange={(event) => setInstallmentCount(event.target.value)}
                type="number"
                value={installmentCount}
              />
            </label>
            <label className="field">
              <span>Tasa de interés ({rateLabel}, %) *</span>
              <input
                min="0"
                step="0.001"
                onChange={(event) => setInterestRate(event.target.value)}
                type="number"
                value={interestRate}
              />
            </label>
            <label className="field">
              <span>Monto mínimo financiable</span>
              <input
                min="0"
                step="0.01"
                onChange={(event) => setMinimumAmount(event.target.value)}
                placeholder="Sin mínimo"
                type="number"
                value={minimumAmount}
              />
            </label>
            <label className="field">
              <span>Monto máximo financiable</span>
              <input
                min="0"
                step="0.01"
                onChange={(event) => setMaximumAmount(event.target.value)}
                placeholder="Sin máximo"
                type="number"
                value={maximumAmount}
              />
            </label>
            <label className="operation-check">
              <input
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                type="checkbox"
              />
              <span>Plan activo (ofrecible en ventas)</span>
            </label>
          </div>

          <section className="stock-form-section">
            <div className="stock-form-section__heading">
              <span><Calculator size={14} /></span>
              <div>
                <h3>Ejemplo en vivo</h3>
                <p>Se recalcula solo, con los valores de arriba.</p>
              </div>
            </div>
            <div className="stock-form-grid">
              <label className="field">
                <span>Monto de ejemplo</span>
                <input
                  min="0"
                  step="0.01"
                  onChange={(event) => setExampleAmount(event.target.value)}
                  type="number"
                  value={exampleAmount}
                />
              </label>
            </div>
            {example ? (
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.6 }}>
                Con {formatMoney(Number(exampleAmount))} a {installmentCount} cuotas
                {calculationMethod === 'FRANCES'
                  ? ` al ${interestRate || 0}% mensual`
                  : ` con una tasa total del ${interestRate || 0}%`}
                , la cuota sería de <strong>{formatMoney(example.installmentAmount)}</strong>
                {' '}y pagarías <strong>{formatMoney(example.totalAmount)}</strong> en
                total (interés: {formatMoney(example.totalInterest)}).
              </p>
            ) : (
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Completá un monto, cuotas y tasa válidos para ver el ejemplo.
              </p>
            )}
          </section>

          <footer className="stock-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
