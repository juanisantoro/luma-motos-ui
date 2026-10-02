import { LoaderCircle, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { cashAccountTypeLabels, cashAccountTypes } from './cashAccounts'
import type {
  BranchOption,
  CashAccount,
  CashAccountInput,
  CashAccountType,
  MinimalPersonnel,
} from './types'

// Alta y edición de una cuenta de caja: a quién le entra la plata (efectivo
// o depósito), de qué sucursal es y quién es su responsable.
export function CashAccountModal({
  account,
  branches,
  responsibles,
  canShare,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  account: CashAccount | null
  branches: BranchOption[]
  responsibles: MinimalPersonnel[]
  // Las cuentas compartidas (sin sucursal) sólo las crea quien ve todas.
  canShare: boolean
  submitting: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: CashAccountInput) => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<CashAccountType>(account?.type ?? 'SOCIO')
  const [responsibleId, setResponsibleId] = useState(
    account?.responsiblePersonnelId ?? account?.responsiblePersonnel?.id ?? '',
  )
  const [branchId, setBranchId] = useState(
    account
      ? (account.branchId ?? account.branch?.id ?? '')
      : canShare
        ? ''
        : (branches[0]?.id ?? ''),
  )
  const [active, setActive] = useState(account?.active ?? true)
  const [validation, setValidation] = useState('')
  const dialogRef = useDialogFocus(onClose, submitting)

  // El responsable actual puede no estar más entre quienes reciben
  // rendiciones: se conserva en la lista para no perderlo al editar.
  const responsibleOptions =
    account?.responsiblePersonnel &&
    !responsibles.some((item) => item.id === account.responsiblePersonnel?.id)
      ? [...responsibles, account.responsiblePersonnel]
      : responsibles

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setValidation('Ingresá un nombre para la cuenta.')
      return
    }
    if (!branchId && !canShare) {
      setValidation('Elegí la sucursal de la cuenta.')
      return
    }
    setValidation('')
    onSubmit({
      name: name.trim(),
      type,
      branchId: branchId || null,
      responsiblePersonnelId: responsibleId || null,
      active,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="cash-account-modal-title"
        aria-modal="true"
        className="settlement-modal"
        ref={dialogRef}
        role="dialog"
      >
        <header className="client-modal__header">
          <div>
            <p className="eyebrow">CUENTAS DE CAJA</p>
            <h2 id="cash-account-modal-title">
              {account ? 'Editar cuenta' : 'Nueva cuenta'}
            </h2>
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
        {(validation || error) && (
          <div className="form-alert form-alert--error" role="alert">
            {validation || error}
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field">
            <span>Nombre *</span>
            <input
              maxLength={140}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej.: Caja Lucas, Banco Galicia Nicolás"
              required
              value={name}
            />
          </label>
          <label className="field">
            <span>Tipo *</span>
            <select
              onChange={(event) => setType(event.target.value as CashAccountType)}
              required
              value={type}
            >
              {cashAccountTypes.map((item) => (
                <option key={item} value={item}>
                  {cashAccountTypeLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Responsable</span>
            <select
              onChange={(event) => setResponsibleId(event.target.value)}
              value={responsibleId}
            >
              <option value="">Sin responsable</option>
              {responsibleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
            <small>
              A quién le entra la plata de esta cuenta: efectivo que se le
              rinde o depósitos en su cuenta bancaria.
            </small>
          </label>
          <label className="field">
            <span>Sucursal{canShare ? '' : ' *'}</span>
            <select
              onChange={(event) => setBranchId(event.target.value)}
              required={!canShare}
              value={branchId}
            >
              {canShare && (
                <option value="">Compartida (todas las sucursales)</option>
              )}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="operation-check">
            <input
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              type="checkbox"
            />
            <span>Cuenta activa (se puede elegir al cobrar o pagar)</span>
          </label>
          <footer className="financial-modal__actions">
            <button
              className="button button--secondary"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="spin" size={17} />}
              {submitting ? 'Guardando…' : 'Guardar cuenta'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
