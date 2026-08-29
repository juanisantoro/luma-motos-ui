import { Construction, RefreshCw, UsersRound } from 'lucide-react'
import { StatePanel } from '../../shared/components/StatePanel'

export function ClientsPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Clientes</h1>
          <p>Consulta y administración de la cartera de clientes.</p>
        </div>
      </header>
      <div className="content-card">
        <StatePanel
          icon={Construction}
          title="Integración en preparación"
          description="El módulo está listo para conectarse cuando el backend publique su contrato estable. No se muestran datos simulados."
          action={
            <span className="integration-note">
              <RefreshCw size={16} aria-hidden="true" />
              Esperando endpoints de clientes
            </span>
          }
        />
      </div>
      <section
        className="mobile-pattern"
        aria-label="Comportamiento responsive previsto"
      >
        <UsersRound aria-hidden="true" />
        <div>
          <strong>Preparado para cualquier pantalla</strong>
          <p>
            En móvil, los resultados se presentarán como tarjetas; en escritorio,
            como tabla con overflow localizado.
          </p>
        </div>
      </section>
    </>
  )
}
