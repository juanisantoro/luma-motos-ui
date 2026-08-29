import { Clock3 } from 'lucide-react'
import { StatePanel } from '../../shared/components/StatePanel'

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LUMA MOTOS</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <div className="content-card">
        <StatePanel
          icon={Clock3}
          title="Módulo pendiente de integración"
          description="Tu permiso fue validado. La interfaz se conectará cuando el backend publique un contrato estable para este módulo."
        />
      </div>
    </>
  )
}
