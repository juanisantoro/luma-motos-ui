import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SalesOperationList } from './SalesOperationList'
import type { SalesOperation } from './types'

it('mantiene acciones en la última columna de la tabla', () => {
  const operation = {
    id: 'operation-1',
    number: '105',
    operationDate: '2026-08-29',
    status: 'BORRADOR',
    agreedPrice: '4400000',
    currency: 'ARS',
    rowVersion: 3,
    client: {
      id: 'client-1',
      fullName: 'Ana Cliente',
      active: true,
      documentType: 'DNI',
      documentNumber: '12.345.678',
    },
    branch: { id: 'branch-1', code: 'CENTRO', name: 'Casa Central' },
    vehicle: {
      versionId: 'version-1',
      versionName: '110 S',
      condition: 'NUEVO',
      model: {
        id: 'model-1',
        name: 'Wave',
        vehicleType: 'MOTO',
        brand: { id: 'brand-1', name: 'Honda' },
      },
      unit: {
        id: 'unit-1',
        vin: 'VIN-001',
        licensePlate: null,
        inventoryStatus: 'RESERVADO',
      },
    },
    seller: { id: 'seller-1', fullName: 'Vendedor Uno' },
    reservation: {
      id: 'reservation-1',
      unitId: 'unit-1',
      status: 'ACTIVO',
      quantity: 1,
      expiresAt: null,
      releasedAt: null,
      releaseReason: null,
    },
    approval: null,
  } as SalesOperation
  const onRelease = vi.fn()

  render(
    <SalesOperationList
      operations={[operation]}
      canRelease
      onRelease={onRelease}
    />,
  )

  const headers = screen.getAllByRole('columnheader')
  expect(headers.at(-1)).toHaveTextContent('Acciones')
  expect(headers.slice(1).map((header) => header.textContent)).toEqual([
    'Operación',
    'Cliente',
    'Vehículo',
    'Precio',
    'Vendedor',
    'Estado operación',
    'Unidad',
    'Acciones',
  ])
  const [, row] = screen.getAllByRole('row')
  expect(row).toHaveTextContent('Honda Wave 110 S')
  expect(row).not.toHaveTextContent('[object Object]')
  expect(row).not.toHaveTextContent('DNI 12.345.678')
  expect(screen.getAllByRole('cell').at(-1)).toHaveTextContent('Liberar')

  // El detalle (documento, chasis, origen) se despliega en acordeón.
  fireEvent.click(
    screen.getByRole('button', { name: 'Ver detalle de la operación #105' }),
  )
  const detail = screen.getAllByRole('row')[2]
  expect(detail).toHaveTextContent('29/08/2026')
  expect(detail).toHaveTextContent('DNI 12.345.678')
  expect(detail).toHaveTextContent('VIN-001')
  expect(detail).toHaveTextContent('Stock físico · Casa Central')
})
