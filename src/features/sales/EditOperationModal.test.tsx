import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { EditOperationModal } from './EditOperationModal'
import { operationFixture } from './licensing.fixtures'

const mocks = vi.hoisted(() => ({
  correctSalesOperation: vi.fn(),
  listSalesSellers: vi.fn(),
  listSalesContacts: vi.fn(),
  listSalesFinancialInstitutions: vi.fn(),
  listClients: vi.fn(),
  alertSuccess: vi.fn(),
}))

vi.mock('./api', () => ({
  correctSalesOperation: mocks.correctSalesOperation,
  listSalesSellers: mocks.listSalesSellers,
  listSalesContacts: mocks.listSalesContacts,
  listSalesFinancialInstitutions: mocks.listSalesFinancialInstitutions,
}))
vi.mock('../clients/api', () => ({ listClients: mocks.listClients }))
vi.mock('../../shared/alerts', () => ({ alertSuccess: mocks.alertSuccess }))

const operation = operationFixture({
  status: 'CERRADA',
  rowVersion: 4,
  seller: { id: 'seller-1', fullName: 'Vendedor Uno' },
})

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.listSalesSellers.mockResolvedValue({
    items: [
      { id: 'seller-1', employeeCode: '1', fullName: 'Vendedor Uno' },
      { id: 'seller-2', employeeCode: '2', fullName: 'Vendedor Dos' },
    ],
  })
  mocks.listSalesContacts.mockResolvedValue({ items: [] })
  mocks.listSalesFinancialInstitutions.mockResolvedValue({
    items: [{ id: 'fin-1', name: 'Banco Demo', taxId: null, active: true }],
  })
  mocks.correctSalesOperation.mockResolvedValue(operation)
})

function renderModal() {
  const onSaved = vi.fn()
  render(
    <EditOperationModal
      onClose={vi.fn()}
      onSaved={onSaved}
      operation={operation}
    />,
  )
  return onSaved
}

describe('Editar una venta ya cargada', () => {
  it('manda sólo lo que cambió, con la versión de la fila', async () => {
    const user = userEvent.setup()
    const onSaved = renderModal()

    expect(screen.getByRole('heading', { name: /Operación #105 · Cerrada/ })).toBeInTheDocument()
    await screen.findByRole('option', { name: 'Vendedor Dos' })
    await user.selectOptions(screen.getByLabelText('Vendedor *'), 'seller-2')
    await user.clear(screen.getByLabelText('Número de boleto'))
    await user.type(screen.getByLabelText('Número de boleto'), 'SM-77')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      sellerId: 'seller-2',
      ticketNumber: 'SM-77',
    })
    expect(onSaved).toHaveBeenCalled()
  })

  it('al pasar a una forma de pago con crédito pide monto y financiera', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(screen.getByLabelText('Forma de pago'), 'EFECTIVO_CREDITO')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el monto del crédito.')
    expect(mocks.correctSalesOperation).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Monto del crédito *'), '2000000')
    await screen.findByRole('option', { name: 'Banco Demo' })
    await user.selectOptions(screen.getByLabelText('Financiera *'), 'fin-1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      paymentPlatform: 'EFECTIVO_CREDITO',
      creditAmount: 2000000,
      financialInstitutionId: 'fin-1',
    })
  })

  it('no guarda si no cambió nada y explica los rechazos del servidor', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No cambiaste ningún dato.')

    mocks.correctSalesOperation.mockRejectedValueOnce(
      new ApiError(409, 'trade-in', { code: 'CORRECTION_TRADE_IN_REQUIRED' }),
    )
    await user.selectOptions(screen.getByLabelText('Forma de pago'), 'MOTO_EFECTIVO')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'la venta no tiene ninguna cargada',
    )
  })

  it('permite cambiar el cliente buscándolo', async () => {
    const user = userEvent.setup()
    mocks.listClients.mockResolvedValue({
      items: [{ id: 'client-9', fullName: 'VAZQUEZ LUCIANA', documentNumber: '34365310' }],
    })
    renderModal()

    await user.type(screen.getByLabelText('Cliente *'), 'vazquez')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.click(await screen.findByRole('button', { name: /VAZQUEZ LUCIANA/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      clientId: 'client-9',
    })
  })
})
