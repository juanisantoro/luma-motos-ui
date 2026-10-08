import type { ExcelColumn } from '../../shared/export/excel'
import type { CreditInquiry } from './types'

// Columnas del Excel de Clientes en rojo: las de la grilla, con el documento,
// el cliente, el vendedor y la sucursal en columnas separadas.

export const creditInquiryExcelColumns: Array<ExcelColumn<CreditInquiry>> = [
  { header: 'Tipo de documento', value: (row) => row.client.documentType },
  { header: 'Documento', value: (row) => row.client.documentNumber },
  { header: 'Cliente', value: (row) => row.client.fullName },
  { header: 'Financiera', value: (row) => row.financialEntity.name },
  { header: 'Motivo informado', value: (row) => row.reason ?? 'Sin motivo informado' },
  { header: 'Intentos', value: (row) => row.attemptCount, type: 'integer' },
  { header: 'Último rechazo', value: (row) => row.consultedAt, type: 'datetime' },
  { header: 'Registrado por', value: (row) => row.registeredBy.fullName },
  { header: 'Sucursal', value: (row) => row.branch.name },
  { header: 'Operación', value: (row) => (row.operation ? `#${row.operation.number}` : null) },
  { header: 'Referencia externa', value: (row) => row.externalReference },
]
