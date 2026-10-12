import type { BalanceData } from './api'

// Datos de ejemplo para las pruebas del balance.
export const sm = 'sm'
export const dv = 'dv'
export const juan = 'juan'

export const sampleBalance: BalanceData = {
  period: '2026-10',
  from: '2026-09-28',
  to: '2026-10-27',
  current: true,
  currency: 'ARS',
  branches: [
    { key: dv, name: 'Del Viso' },
    { key: sm, name: 'San Miguel' },
    { key: 'GENERAL', name: 'Generales' },
  ],
  partners: [
    { key: juan, name: 'Juan Capdevila' },
    { key: 'NONE', name: 'Sin caja' },
  ],
  entries: [
    { section: 'INCOME', line: 'Venta', branch: sm, partner: juan, amount: 1000000, paid: true },
    { section: 'INCOME', line: 'Venta', branch: dv, partner: juan, amount: 2500000, paid: true },
    { section: 'INCOME', line: 'Otros', branch: dv, partner: 'NONE', amount: 200000, paid: false },
    { section: 'EXPENSE', line: 'ALQUILER', branch: sm, partner: juan, amount: 300000, paid: true },
    { section: 'EXPENSE', line: 'PUBLICIDAD', branch: 'GENERAL', partner: juan, amount: 40000, paid: true },
    { section: 'EXPENSE', line: 'PUBLICIDAD', branch: 'GENERAL', partner: 'NONE', amount: 60000, paid: false },
    { section: 'COMMISSION', line: 'Comisiones de vendedores', branch: sm, partner: juan, amount: 80000, paid: true },
    { section: 'COMMISSION', line: 'Comisiones de gerentes', branch: 'GENERAL', partner: 'NONE', amount: 45000, paid: true },
    { section: 'VEHICLE_EXPENSE', line: 'Patente', branch: dv, partner: juan, amount: 60000, paid: true },
    { section: 'VEHICLE_EXPENSE', line: 'Seguro', branch: sm, partner: 'NONE', amount: 30000, paid: false },
    { section: 'PURCHASE', line: 'Compras a proveedores', branch: sm, partner: juan, amount: 500000, paid: true },
    { section: 'PURCHASE', line: 'Compras a proveedores', branch: sm, partner: 'NONE', amount: 400000, paid: false },
    { section: 'COST_OF_SALES', line: 'Lo que costaron las unidades vendidas', branch: sm, partner: null, amount: 2000000, paid: true },
    { section: 'COST_OF_SALES', line: 'Lo que costaron las unidades vendidas', branch: dv, partner: null, amount: 1700000, paid: true },
  ],
  sales: {
    units: 3,
    unitsWithoutCost: 1,
    pending: [
      { branch: sm, amount: 2000000, operations: 1 },
      { branch: dv, amount: 1500000, operations: 1 },
    ],
  },
}
