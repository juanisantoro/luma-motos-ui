import type { ExcelColumn } from '../../shared/export/excel'
import { formatPeriodo, situacionLabel } from './format'
import type { BcraEntidadHistorica, BcraSituacionDetalle } from './types'

// Excel del detalle de la Consulta BCRA: una fila por entidad y período, con
// el monto ya convertido a pesos (el BCRA lo informa en miles).

export type BcraExcelRow = BcraEntidadHistorica & { periodo: string }

export function bcraExcelRows(detalle: BcraSituacionDetalle | undefined): BcraExcelRow[] {
  return (detalle?.periodos ?? []).flatMap((periodo) =>
    periodo.entidades.map((entidad) => ({ ...entidad, periodo: periodo.periodo })),
  )
}

export const bcraExcelColumns: Array<ExcelColumn<BcraExcelRow>> = [
  { header: 'Período', value: (row) => formatPeriodo(row.periodo) },
  { header: 'Entidad', value: (row) => row.entidad },
  { header: 'Situación', value: (row) => situacionLabel(row.situacion) },
  { header: 'Monto', value: (row) => row.monto * 1000, type: 'money' },
  { header: 'Revisión', value: (row) => row.enRevision },
  { header: 'Proceso judicial', value: (row) => row.procesoJud },
]
