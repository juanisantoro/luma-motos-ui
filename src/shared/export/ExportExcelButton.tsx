import { Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { alertError } from '../alerts'

/**
 * Botón "Exportar a Excel" de las grillas. `onExport` arma y descarga el
 * archivo (ver `downloadExcel`); mientras tanto el botón queda ocupado.
 */
export function ExportExcelButton({
  onExport,
  disabled = false,
  label = 'Exportar a Excel',
}: {
  onExport: () => Promise<void>
  disabled?: boolean
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="button button--secondary"
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true)
        onExport()
          .catch(() =>
            alertError('No pudimos generar el Excel. Intentá nuevamente.'),
          )
          .finally(() => setBusy(false))
      }}
      title={disabled ? 'No hay registros para exportar' : undefined}
      type="button"
    >
      {busy ? (
        <LoaderCircle className="spin" size={17} aria-hidden="true" />
      ) : (
        <Download size={17} aria-hidden="true" />
      )}
      {busy ? 'Exportando…' : label}
    </button>
  )
}
