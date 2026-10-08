import type { ExcelColumn } from '../../shared/export/excel'
import type { Client } from './types'

// Columnas del Excel de Clientes: las de la grilla, con el contacto separado
// en email y teléfono.

export const clientExcelColumns: Array<ExcelColumn<Client>> = [
  { header: 'Cliente', value: (row) => row.fullName },
  { header: 'Tipo de documento', value: (row) => row.documentType },
  { header: 'Documento', value: (row) => row.documentNumber },
  { header: 'Email', value: (row) => row.email },
  { header: 'Teléfono', value: (row) => row.phone },
  { header: 'Organización', value: (row) => row.organization.name },
  { header: 'Estado', value: (row) => (row.active ? 'Activo' : 'Inactivo') },
  { header: 'Actualizado', value: (row) => row.updatedAt, type: 'datetime' },
]
