import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type StatePanelProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  tone?: 'default' | 'danger'
}

export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  tone = 'default',
}: StatePanelProps) {
  return (
    <section
      className={`state-panel state-panel--${tone}`}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <span className="state-panel__icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <h1>{title}</h1>
      <p>{description}</p>
      {action && <div className="state-panel__action">{action}</div>}
    </section>
  )
}
