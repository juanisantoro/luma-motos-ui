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
  listSalesCatalogModels: vi.fn(),
  alertSuccess: vi.fn(),
}))

vi.mock('./api', () => ({
  correctSalesOperation: mocks.correctSalesOperation,
  listSalesSellers: mocks.listSalesSellers,
  listSalesContacts: mocks.listSalesContacts,
  listSalesFinancialInstitutions: mocks.listSalesFinancialInstitutions,
}))
vi.mock('../clients/api', () => ({ listClients: mocks.listClients }))
vi.mock('../stock/api', () => ({
  listSalesCatalogModels: mocks.listSalesCatalogModels,
}))
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
  mocks.listSalesCatalogModels.mockResolvedValue([
    catalogModel('version-1', 'Wave', '110 S', 5000000),
    catalogModel('version-2', 'Biz', '125', 6200000),
    catalogModel('version-3', 'CG', 'Titan 150', 7100000),
  ])
})

function catalogModel(id: string, model: string, version: string, listPrice: number) {
  return {
    id,
    brandId: 'brand-1',
    modelId: `model-${id}`,
    vehicleType: 'MOTO',
    brand: 'Honda',
    model,
    version,
    active: true,
    pricePolicy: {
      id: `policy-${id}`,
      versionId: id,
      branchId: 'branch-1',
      currency: 'ARS',
      listPrice,
      minimumPrice: listPrice - 100000,
      validFrom: '2026-01-01',
      validUntil: null,
    },
    photoUrl: null,
  }
}

// El diálogo enfoca su primer campo en el cuadro siguiente: se espera a que
// carguen las listas antes de escribir, como haría una persona.
async function modelSearchInput() {
  await screen.findByRole('option', { name: 'Vendedor Dos' })
  return screen.findByPlaceholderText(
    'Para cambiarlo, escribí marca, modelo o versión',
  )
}

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

  it('al programar la entrega pide el día y lo manda', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByRole('option', { name: 'Vendedor Dos' })

    expect(screen.queryByLabelText(/^Día de entrega/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Entrega'), 'PROGRAMADA')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByText('Elegí el día de la entrega.')).toBeInTheDocument()
    expect(mocks.correctSalesOperation).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/^Día de entrega/), '2026-10-20')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      deliveryStatus: 'PROGRAMADA',
      deliveryScheduledDate: '2026-10-20',
    })
  })

  it('permite cambiar el cliente buscándolo', async () => {
    const user = userEvent.setup()
    mocks.listClients.mockResolvedValue({
      items: [{ id: 'client-9', fullName: 'VAZQUEZ LUCIANA', documentNumber: '34365310' }],
    })
    renderModal()
    // Mismo motivo que modelSearchInput: que el foco del diálogo ya esté puesto.
    await screen.findByRole('option', { name: 'Vendedor Dos' })

    await user.type(screen.getByLabelText('Cliente *'), 'vazquez')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await user.click(await screen.findByRole('button', { name: /VAZQUEZ LUCIANA/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      clientId: 'client-9',
    })
  })

  it('corrige el modelo que eligió mal el vendedor', async () => {
    const user = userEvent.setup()
    renderModal()

    const search = await modelSearchInput()
    expect(mocks.listSalesCatalogModels).toHaveBeenCalledWith(
      'MOTO',
      operation.organizationId,
      'branch-1',
      expect.anything(),
    )
    // Sin acentos ni orden: "titan cg" encuentra "CG Titan 150".
    await user.type(search, 'titán cg')
    const results = screen.getByRole('group', { name: 'Modelos encontrados' })
    expect(results).toHaveTextContent('Honda CG Titan 150')
    expect(results).not.toHaveTextContent('Biz')
    await user.click(screen.getByRole('button', { name: /Honda CG Titan 150/ }))

    expect(screen.getByText(/Pasa a/)).toHaveTextContent('Honda CG Titan 150')
    expect(screen.getByText(/primero liberá la reserva/)).toHaveTextContent('VIN-001')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(mocks.correctSalesOperation).toHaveBeenCalledWith('operation-1', {
      expectedVersion: 4,
      versionId: 'version-3',
    })
  })

  it('no ofrece el modelo cargado y permite volver atrás', async () => {
    const user = userEvent.setup()
    renderModal()

    const search = await modelSearchInput()
    await user.type(search, 'wave')
    expect(screen.getByText('No hay otro modelo con esas palabras.')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'biz')
    await user.click(screen.getByRole('button', { name: /Honda Biz 125/ }))
    await user.click(screen.getByRole('button', { name: 'Dejar el cargado' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByRole('alert')).toHaveTextContent('No cambiaste ningún dato.')
    expect(mocks.correctSalesOperation).not.toHaveBeenCalled()
  })

  it('explica que hay que liberar la unidad del modelo anterior', async () => {
    const user = userEvent.setup()
    mocks.correctSalesOperation.mockRejectedValue(
      new ApiError(409, 'The operation has a unit of another model assigned', {
        code: 'CORRECTION_UNIT_OTHER_MODEL',
      }),
    )
    renderModal()

    await user.type(
      await modelSearchInput(),
      'biz',
    )
    await user.click(screen.getByRole('button', { name: /Honda Biz 125/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Primero liberá la reserva de esa unidad',
    )
  })
})
