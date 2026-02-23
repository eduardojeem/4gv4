'use client'

import { Repair } from '@/types/repairs'
import { RepairCard } from './RepairCard'

interface RepairCardsViewProps {
  repairs: Repair[]
  onView?: (repair: Repair) => void
}

export function RepairCardsView({ repairs, onView }: RepairCardsViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {repairs.map((repair) => (
        <RepairCard
          key={repair.id}
          repair={repair}
          onClick={() => onView?.(repair)}
          className="h-full"
        />
      ))}
    </div>
  )
}

