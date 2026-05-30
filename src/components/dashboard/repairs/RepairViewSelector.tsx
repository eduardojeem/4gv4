'use client'

import { Calendar as CalendarIcon, Columns, LayoutGrid, List as ListIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'cards' | 'kanban' | 'calendar'

interface RepairViewSelectorProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onPreload?: (view: 'kanban' | 'calendar') => void
}

const viewOptions: Array<{
  mode: ViewMode
  label: string
  mobileLabel: string
  icon: typeof ListIcon
}> = [
  { mode: 'table', label: 'Lista', mobileLabel: 'Lista', icon: ListIcon },
  { mode: 'cards', label: 'Tarjetas', mobileLabel: 'Tarjetas', icon: LayoutGrid },
  { mode: 'kanban', label: 'Kanban', mobileLabel: 'Kanban', icon: Columns },
  { mode: 'calendar', label: 'Calendario', mobileLabel: 'Agenda', icon: CalendarIcon },
]

export function RepairViewSelector({ viewMode, onViewModeChange, onPreload }: RepairViewSelectorProps) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/70">
      {viewOptions.map((option) => {
        const Icon = option.icon
        const isActive = viewMode === option.mode
        const shouldPreload = option.mode === 'kanban' || option.mode === 'calendar'

        return (
          <Button
            key={option.mode}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange(option.mode)}
            onMouseEnter={() => shouldPreload && onPreload?.(option.mode as 'kanban' | 'calendar')}
            className={cn(
              'h-10 rounded-xl px-3 text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
            )}
            aria-label={`Vista ${option.label.toLowerCase()}`}
            aria-pressed={isActive}
          >
            <Icon className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden">{option.mobileLabel}</span>
          </Button>
        )
      })}
    </div>
  )
}
