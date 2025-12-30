'use client'

import { Button } from '@/components/ui/button'
import { List as ListIcon, Columns, Calendar as CalendarIcon } from 'lucide-react'

type ViewMode = 'table' | 'kanban' | 'calendar'

interface RepairViewSelectorProps {
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
    onPreload?: (view: 'kanban' | 'calendar') => void
}

export function RepairViewSelector({ viewMode, onViewModeChange, onPreload }: RepairViewSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className="h-8 w-8 p-0 rounded-lg"
                aria-label="Vista de lista"
                aria-pressed={viewMode === 'table'}
            >
                <ListIcon className="h-4 w-4" />
            </Button>
            <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('kanban')}
                onMouseEnter={() => onPreload?.('kanban')}
                className="h-8 w-8 p-0 rounded-lg"
                aria-label="Vista de tablero"
                aria-pressed={viewMode === 'kanban'}
            >
                <Columns className="h-4 w-4" />
            </Button>
            <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('calendar')}
                onMouseEnter={() => onPreload?.('calendar')}
                className="h-8 w-8 p-0 rounded-lg"
                aria-label="Vista de calendario"
                aria-pressed={viewMode === 'calendar'}
            >
                <CalendarIcon className="h-4 w-4" />
            </Button>
        </div>
    )
}
