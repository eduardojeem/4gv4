'use client'

import { Badge } from '@/components/ui/badge'
import { PLAN_STYLES, STATUS_STYLES } from './utils'

export function PlanBadge({ plan }: { plan: string }) {
  const normalized = plan.toUpperCase()
  return (
    <Badge variant="outline" className={PLAN_STYLES[normalized] ?? PLAN_STYLES.FREE}>
      {normalized}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] ?? STATUS_STYLES.sin_estado}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}
