import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type KpiCardProps = {
  icon: LucideIcon
  label: string
  value: string
  meta?: ReactNode
  metaTone?: 'positive' | 'negative' | 'neutral'
}

export function KpiCard({ icon: Icon, label, value, meta, metaTone = 'neutral' }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <p className="kpi-card__label">
        <span className="kpi-card__icon">
          <Icon size={16} />
        </span>
        {label}
      </p>
      <p className="kpi-card__value">{value}</p>
      {meta && (
        <p
          className={`kpi-card__meta${metaTone !== 'neutral' ? ` kpi-card__meta--${metaTone}` : ''}`}
        >
          {meta}
        </p>
      )}
    </article>
  )
}

type AlertStripProps = {
  icon: LucideIcon
  children: ReactNode
  cta?: { label: string; to: string }
  tone?: 'urgent' | 'warning'
}

export function AlertStrip({ icon: Icon, children, cta, tone = 'urgent' }: AlertStripProps) {
  return (
    <section
      className={`alert-strip${tone === 'warning' ? ' alert-strip--warning' : ''}`}
      role="alert"
    >
      <div className="alert-strip__text">
        <span className="alert-strip__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span>{children}</span>
      </div>
      {cta && (
        <Link to={cta.to} className="button button--secondary button--compact">
          {cta.label}
        </Link>
      )}
    </section>
  )
}

type DashboardPanelProps = {
  title: string
  description?: string | undefined
  action?: ReactNode
  children: ReactNode
}

export function DashboardPanel({ title, description, action, children }: DashboardPanelProps) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel__header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PanelEmptyState({ children }: { children: ReactNode }) {
  return <p className="dashboard-panel__empty">{children}</p>
}

type RankingListItem = {
  key: string
  name: string
  subtitle?: string
  stat: string
  statSubtitle?: string
}

export function RankingList({ items }: { items: RankingListItem[] }) {
  return (
    <ol className="ranking-list">
      {items.map((item, index) => (
        <li className="ranking-list__item" key={item.key}>
          <span className="ranking-list__rank">{index + 1}</span>
          <span className="ranking-list__name">
            {item.name}
            {item.subtitle && <small>{item.subtitle}</small>}
          </span>
          <span className="ranking-list__stat">
            {item.stat}
            {item.statSubtitle && <small>{item.statSubtitle}</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function TopModelsPanel({
  title,
  description,
  models,
}: {
  title: string
  description?: string
  models: Array<{ versionId: string; brand: string; model: string; version: string; units: number; amount: number }> | null
}) {
  if (models === null) return null
  return (
    <DashboardPanel title={title} description={description}>
      {models.length === 0 ? (
        <PanelEmptyState>Todavía no hay ventas computables este mes.</PanelEmptyState>
      ) : (
        <RankingList
          items={models.map((model) => ({
            key: model.versionId,
            name: `${model.brand} ${model.model}`,
            subtitle: model.version,
            stat: `${model.units} un.`,
          }))}
        />
      )}
    </DashboardPanel>
  )
}
