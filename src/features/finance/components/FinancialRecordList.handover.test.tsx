import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FinancialRecordList } from './FinancialRecordList'
import type { Income } from '../types'

function cashIncome(status: 'PENDIENTE_RENDICION' | 'RENDIDO') {
  return {
    id: 'income-1',
    incomeDate: '2026-09-04',
    type: 'Otros',
    description: 'Seña moto',
    totalAmount: '150000',
    paidAmount: '150000',
    currency: 'ARS',
    paymentStatus: 'PAGADO',
    branch: { id: 'b', code: 'SM', name: 'San Miguel' },
    paymentMethod: 'EFECTIVO',
    collectedBy: { id: 'p-rosa', fullName: 'Rosa Vargas' },
    handover: {
      status,
      recipient: { id: 'p-nico', fullName: 'Nicolas Martinez' },
      confirmedAt: null,
      confirmedBy: null,
    },
    rowVersion: 2,
  } as unknown as Income
}

function renderList(income: Income, currentRecipientId?: string) {
  const onConfirmHandover = vi.fn()
  render(
    <FinancialRecordList
      kind="income"
      records={[income]}
      canSettle={false}
      canRecover={false}
      canViewCosts
      onSettle={vi.fn()}
      onDetails={vi.fn()}
      {...(currentRecipientId
        ? { currentRecipientId, onConfirmHandover }
        : {})}
    />,
  )
}

describe('Rendición del efectivo en la lista de ingresos', () => {
  it('a quien cargó le muestra que está cobrado pero falta la confirmación', () => {
    renderList(cashIncome('PENDIENTE_RENDICION'))
    expect(screen.getByText('Pagado')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de rendición')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Falta que Nicolas Martinez confirme que recibió el efectivo',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Confirmar recepción/ }),
    ).not.toBeInTheDocument()
  })

  it('a quien recibe le avisa que le toca y le da el botón', () => {
    renderList(cashIncome('PENDIENTE_RENDICION'), 'p-nico')
    expect(
      screen.getByText('Te lo rinden a vos: confirmá cuando recibas el efectivo'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Confirmar recepción/ }),
    ).toBeInTheDocument()
  })

  it('una vez confirmado figura como rendido', () => {
    renderList(cashIncome('RENDIDO'), 'p-nico')
    expect(screen.getByText('Rendido')).toBeInTheDocument()
    expect(
      screen.getByText('Nicolas Martinez confirmó que recibió el efectivo'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Confirmar recepción/ }),
    ).not.toBeInTheDocument()
  })
})
