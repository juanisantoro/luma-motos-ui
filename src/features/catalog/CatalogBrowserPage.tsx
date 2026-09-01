import { ImageOff, Maximize2, RefreshCw, Search, Warehouse, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { resolveMediaUrl } from '../../shared/api/client'
import { StatePanel } from '../../shared/components/StatePanel'
import { useDialogFocus } from '../../shared/hooks/useDialogFocus'
import { useAuth } from '../auth/AuthContext'
import {
  listSalesBranches,
  listSalesCatalogModels,
  listSalesPhysicalUnits,
  listSalesSupplierAvailability,
} from '../stock/api'
import { stockErrorMessage } from '../stock/errors'
import type {
  CatalogModel,
  PhysicalUnit,
  SupplierAvailability,
  VehicleKind,
} from '../stock/types'

type LoadStatus = 'loading' | 'success' | 'error'

type CatalogRow = {
  model: CatalogModel
  totalStock: number
  stockByBranch: Array<{ branchName: string; count: number }>
  supplierNames: string[]
}

function buildRows(
  models: CatalogModel[],
  units: PhysicalUnit[],
  availability: SupplierAvailability[],
): CatalogRow[] {
  return models.map((model) => {
    const modelUnits = units.filter((unit) => unit.catalogModel.id === model.id)
    const byBranch = new Map<string, number>()
    const supplierNames = new Set<string>()
    modelUnits.forEach((unit) => {
      byBranch.set(unit.branch.name, (byBranch.get(unit.branch.name) ?? 0) + 1)
      if (unit.supplier) supplierNames.add(unit.supplier.name)
    })
    if (supplierNames.size === 0) {
      availability
        .filter((item) => item.catalogModel.id === model.id)
        .forEach((item) => supplierNames.add(item.supplier.name))
    }
    return {
      model,
      totalStock: modelUnits.length,
      stockByBranch: [...byBranch.entries()]
        .map(([branchName, count]) => ({ branchName, count }))
        .sort((a, b) => b.count - a.count),
      supplierNames: [...supplierNames].sort((a, b) => a.localeCompare(b, 'es')),
    }
  })
}

export function CatalogBrowserPage({ vehicleType }: { vehicleType: VehicleKind }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')
  const [rows, setRows] = useState<CatalogRow[]>([])
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; alt: string } | null>(null)
  const organizationId = user?.globalAccess ? user.organization.id : undefined

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setLoadError('')
    Promise.all([
      listSalesCatalogModels(vehicleType, organizationId, undefined, controller.signal),
      listSalesPhysicalUnits(vehicleType, organizationId, undefined, controller.signal),
      listSalesSupplierAvailability(vehicleType, organizationId, undefined, controller.signal),
      listSalesBranches(organizationId, controller.signal),
    ])
      .then(([models, units, availability]) => {
        if (controller.signal.aborted) return
        setRows(buildRows(models, units, availability))
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(stockErrorMessage(error))
        setStatus('error')
      })
    return () => controller.abort()
  }, [vehicleType, organizationId, refreshKey])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-AR')
    if (!term) return rows
    return rows.filter((row) =>
      [row.model.brand, row.model.model, row.model.version ?? '']
        .join(' ')
        .toLocaleLowerCase('es-AR')
        .includes(term),
    )
  }, [rows, search])

  if (status === 'loading') {
    return (
      <div className="stock-page-state" aria-live="polite">
        <div className="loading-mark" />
        <span>Cargando catálogo…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="content-card">
        <StatePanel
          icon={RefreshCw}
          title="No pudimos cargar el catálogo"
          description={loadError}
          tone="danger"
          action={
            <button
              className="button button--primary"
              onClick={() => setRefreshKey((current) => current + 1)}
              type="button"
            >
              <RefreshCw size={17} />
              Reintentar
            </button>
          }
        />
      </div>
    )
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CATÁLOGO</p>
          <h1>Catálogo de {vehicleType === 'MOTO' ? 'motos' : 'autos'}</h1>
          <p>Consulta de solo lectura: modelos vigentes, stock por sucursal y proveedor.</p>
        </div>
      </header>
      <div className="catalog-browser-toolbar">
        <label className="field field--search">
          <Search size={16} aria-hidden="true" />
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por marca, modelo o versión"
            value={search}
          />
        </label>
      </div>
      {filteredRows.length === 0 ? (
        <div className="content-card">
          <StatePanel
            icon={Warehouse}
            title="No hay modelos para mostrar"
            description="No encontramos versiones de catálogo activas que coincidan con la búsqueda."
          />
        </div>
      ) : (
        <div className="catalog-browser-grid">
          {filteredRows.map((row) => {
            const photoUrl = resolveMediaUrl(row.model.photoUrl)
            return (
              <article className="catalog-browser-card" key={row.model.id}>
                <div className="catalog-browser-card__photo">
                  {photoUrl ? (
                    <button
                      aria-label={`Ampliar foto de ${row.model.brand} ${row.model.model}`}
                      className="catalog-browser-card__photo-button"
                      onClick={() =>
                        setLightboxPhoto({
                          url: photoUrl,
                          alt: `${row.model.brand} ${row.model.model}`,
                        })
                      }
                      type="button"
                    >
                      <img
                        alt={`Foto de ${row.model.brand} ${row.model.model}`}
                        src={photoUrl}
                      />
                      <span aria-hidden="true" className="catalog-browser-card__photo-zoom">
                        <Maximize2 size={16} />
                      </span>
                    </button>
                  ) : (
                    <div className="catalog-browser-card__placeholder">
                      <ImageOff size={26} aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="catalog-browser-card__body">
                  <strong>{row.model.brand} {row.model.model}</strong>
                  <span className="catalog-browser-card__version">{row.model.version}</span>
                  <div className="catalog-browser-card__stock">
                    <span className="status-badge status-badge--success">
                      {row.totalStock} en stock
                    </span>
                  </div>
                  {row.stockByBranch.length > 0 && (
                    <dl className="catalog-browser-card__branches">
                      {row.stockByBranch.map((entry) => (
                        <div key={entry.branchName}>
                          <dt>{entry.branchName}</dt>
                          <dd>{entry.count}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="catalog-browser-card__suppliers">
                    <span className="eyebrow">Proveedor</span>
                    <p>
                      {row.supplierNames.length > 0
                        ? row.supplierNames.join(', ')
                        : 'Sin proveedor asociado'}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {lightboxPhoto && (
        <CatalogPhotoLightbox onClose={() => setLightboxPhoto(null)} photo={lightboxPhoto} />
      )}
    </>
  )
}

function CatalogPhotoLightbox({
  photo,
  onClose,
}: {
  photo: { url: string; alt: string }
  onClose: () => void
}) {
  const dialogRef = useDialogFocus(onClose, false)
  return (
    <div className="catalog-lightbox-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label={`Foto de ${photo.alt}`}
        aria-modal="true"
        className="catalog-lightbox"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="Cerrar"
          className="catalog-lightbox__close"
          onClick={onClose}
          type="button"
        >
          <X size={20} />
        </button>
        <img alt={photo.alt} src={photo.url} />
      </div>
    </div>
  )
}
