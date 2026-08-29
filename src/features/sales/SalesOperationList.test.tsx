import { render, screen } from '@testing-library/react'
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
    client: { id: 'client-1', fullName: 'Ana Cliente', active: true },
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
  const cells = screen.getAllByRole('cell')
  expect(headers.at(-1)).toHaveTextContent('Acciones')
  expect(cells[4]).toHaveTextContent('Casa Central')
  expect(cells.at(-1)).toHaveTextContent('Liberar')
})
