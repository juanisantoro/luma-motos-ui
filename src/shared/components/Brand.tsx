export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Luma Motos">
      <span className="brand__mark" aria-hidden="true">
        LM
      </span>
      {!compact && (
        <strong className="brand__name">
          LUMA <span>MOTOS</span>
        </strong>
      )}
    </div>
  )
}
