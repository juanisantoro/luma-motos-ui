import { Landmark, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertError, alertSuccess } from '../../shared/alerts'
import { StatePanel } from '../../shared/components/StatePanel'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/PermissionRoute'
import { createCreditPlan, listCreditPlans, updateCreditPlan } from './api'
import { CreditPlanModal } from './CreditPlanModal'
import { calculationMethodLabels, creditPlansErrorMessage, formatMoney } from './format'
import type { CreateCreditPlanInput, CreditPlan } from './types'

const PAGE_SIZE = 50

export function CreditPlansPage() {
  const { user } = useAuth()
  const permissions = user?.role.permissions ?? []
  const canManage = hasPermission(permissions, 'creditos.gestionar')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [plans, setPlans] = useState<CreditPlan[]>([])
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showInactive, setShowInactive] = useState(false)

  const [editingPlan, setEditingPlan] = useState<CreditPlan | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')
    listCreditPlans(
      { page: 1, limit: PAGE_SIZE, ...(showInactive ? {} : { active: true }) },
      controller.signal,
    )
      .then((result) => {
        setPlans(result.items)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(creditPlansErrorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [refreshKey, showInactive])

  const reload = () => {
    setRefreshKey((current) => current + 1)
  }

  const openCreate = () => {
    setEditingPlan(null)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (plan: CreditPlan) => {
    setEditingPlan(plan)
    setFormError(null)
    setShowModal(true)
  }

  const submit = async (input: CreateCreditPlanInput) => {
    setSubmitting(true)
    setFormError(null)
    try {
      if (editingPlan) {
        await updateCreditPlan(editingPlan.id, input)
        setShowModal(false)
        reload()
        void alertSuccess('Plan de crédito actualizado correctamente.')
      } else {
        await createCreditPlan(input)
        setShowModal(false)
        reload()
        void alertSuccess('Plan de crédito creado correctamente.')
      }
    } catch (error) {
      const message = creditPlansErrorMessage(error)
      setFormError(message)
      void alertError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (plan: CreditPlan) => {
    try {
      await updateCreditPlan(plan.id, { active: !plan.active })
      const message = plan.active
        ? 'Plan desactivado. Ya no se ofrecerá en nuevas ventas.'
        : 'Plan reactivado.'
      reload()
      void alertSuccess(message)
    } catch (error) {
      void alertError(creditPlansErrorMessage(error))
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CRÉDITOS PERSONALES</p>
          <h1>Planes de crédito</h1>
          <p>Financiación propia de la agencia: definí cuotas, tasa y método de interés.</p>
        </div>
        {canManage && (
          <button className="button button--primary" onClick={openCreate} type="button">
            <Plus size={18} />
            Nuevo plan
          </button>
        )}
      </header>

      <label className="operation-check" style={{ marginBottom: 12 }}>
        <input
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
          type="checkbox"
        />
        <span>Mostrar también los planes inactivos</span>
      </label>

      <section className="financial-panel" aria-label="Listado de planes de crédito">
        {status === 'loading' && (
          <div className="financial-loading">
            <div className="loading-mark" />
            <span>Cargando planes…</span>
          </div>
        )}
        {status === 'error' && (
          <StatePanel
            icon={RefreshCw}
            title="No pudimos cargar los planes"
            description={loadError}
            tone="danger"
            action={
              <button
                className="button button--primary"
                onClick={() => setRefreshKey((current) => current + 1)}
                type="button"
              >
                <RefreshCw size={17} />
                Reintentar
              </button>
            }
          />
        )}
        {status === 'success' && plans.length === 0 && (
          <StatePanel
            icon={Landmark}
            title="Todavía no hay planes de crédito"
            description="Creá el primero para poder ofrecerlo durante una venta."
          />
        )}
        {status === 'success' && plans.length > 0 && (
          <div className="financial-table-wrap">
            <table className="financial-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Método</th>
                  <th>Cuotas</th>
                  <th>Tasa</th>
                  <th>Monto financiable</th>
                  <th>Estado</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>{calculationMethodLabels[plan.calculationMethod]}</td>
                    <td>{plan.installmentCount}</td>
                    <td>
                      {plan.interestRate}%{' '}
                      {plan.calculationMethod === 'FRANCES' ? 'mensual' : 'total'}
                    </td>
                    <td>
                      {plan.minimumAmount === null && plan.maximumAmount === null
                        ? 'Sin restricción'
                        : `${plan.minimumAmount !== null ? formatMoney(plan.minimumAmount) : 'Sin mínimo'} – ${plan.maximumAmount !== null ? formatMoney(plan.maximumAmount) : 'sin máximo'}`}
                    </td>
                    <td>
                      <span
                        className={`status-badge${plan.active ? ' status-badge--success' : ''}`}
                      >
                        {plan.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="financial-actions">
                        <button
                          className="button button--secondary"
                          onClick={() => openEdit(plan)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="button button--secondary"
                          onClick={() => void toggleActive(plan)}
                          type="button"
                        >
                          {plan.active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <CreditPlanModal
          error={formError}
          onClose={() => setShowModal(false)}
          onSubmit={(input) => void submit(input)}
          plan={editingPlan}
          submitting={submitting}
        />
      )}
    </>
  )
}
