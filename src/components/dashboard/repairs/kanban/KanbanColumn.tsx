'use client'

import { memo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react'
import { KanbanCard } from './KanbanCard'
import { RepairOrder } from '@/types/repairs'
import { StatusKey } from '@/lib/repairs/mapping'
import { cn } from '@/lib/utils'

interface KanbanColumnProps {
  title: string
  status: StatusKey
  items: RepairOrder[]
  scores: Record<string, number>
  metrics: {
    count: number
    avgPredictedHours: number
    avgWaitTime: number
    urgentCount: number
    overdueCount: number
    totalValue: number
  }
  isCollapsed?: boolean
  isDragOver?: boolean
  onDrop: (e: React.DragEvent, status: StatusKey) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onToggleCollapse?: () => void
  onViewItem?: (id: string) => void
  onEditItem?: (id: string) => void
  onDeleteItem?: (id: string) => void
}

const statusConfig = {
  pending: {
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    headerColor: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/80',
    borderColor: 'border-slate-200 dark:border-slate-700'
  },
  in_progress: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    headerColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/80 dark:to-blue-800/80',
    borderColor: 'border-blue-200 dark:border-blue-700'
  },
  waiting_parts: {
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    headerColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/80 dark:to-yellow-800/80',
    borderColor: 'border-yellow-200 dark:border-yellow-700'
  },
  on_hold: {
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    headerColor: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/80 dark:to-orange-800/80',
    borderColor: 'border-orange-200 dark:border-orange-700'
  },
  completed: {
    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    headerColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/80 dark:to-green-800/80',
    borderColor: 'border-green-200 dark:border-green-700'
  },
  cancelled: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    headerColor: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/80 dark:to-red-800/80',
    borderColor: 'border-red-200 dark:border-red-700'
  }
}

export const KanbanColumn = memo(function KanbanColumn({
  title,
  status,
  items,
  scores,
  metrics,
  isCollapsed = false,
  isDragOver = false,
  onDrop,
  onDragStart,
  onToggleCollapse,
  onViewItem,
  onEditItem,
  onDeleteItem
}: KanbanColumnProps) {
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  
  const config = statusConfig[status]
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverItem(null)
    onDrop(e, status)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear drag over if we're leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem(null)
    }
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200 min-h-[500px] flex flex-col border-border dark:border-muted/60 bg-card dark:bg-card/95 shadow-sm dark:shadow-lg",
        config.borderColor,
        isDragOver && "ring-2 ring-primary ring-offset-2 scale-[1.02] dark:ring-offset-background",
        isCollapsed && "min-h-[120px]"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <CardHeader className={cn("pb-3 border-b border-muted/30 dark:border-muted/40", config.headerColor)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground dark:text-foreground">
            {title}
            <Badge variant="secondary" className={cn(config.color, "font-medium")}>
              {metrics.count}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-6 w-6 p-0 hover:bg-white/60 dark:hover:bg-black/40"
            >
              {isCollapsed ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Column metrics */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="text-center p-2 bg-white/70 dark:bg-black/50 rounded-lg border border-white/30 dark:border-white/15 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground dark:text-muted-foreground/80">Tiempo Prom.</div>
              <div className="font-semibold text-sm flex items-center justify-center gap-1 text-foreground dark:text-foreground">
                <Clock className="h-3 w-3" />
                {metrics.avgPredictedHours}h
              </div>
            </div>
            
            <div className="text-center p-2 bg-white/70 dark:bg-black/50 rounded-lg border border-white/30 dark:border-white/15 backdrop-blur-sm">
              <div className="text-xs text-muted-foreground dark:text-muted-foreground/80">Espera</div>
              <div className="font-semibold text-sm flex items-center justify-center gap-1 text-foreground dark:text-foreground">
                <Clock className="h-3 w-3" />
                {Math.round(metrics.avgWaitTime)}h
              </div>
            </div>

            {metrics.urgentCount > 0 && (
              <div className="text-center p-2 bg-red-50 dark:bg-red-950/60 rounded-lg border border-red-200 dark:border-red-800/70">
                <div className="text-xs text-red-600 dark:text-red-300">Urgentes</div>
                <div className="font-semibold text-sm flex items-center justify-center gap-1 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" />
                  {metrics.urgentCount}
                </div>
              </div>
            )}

            {metrics.overdueCount > 0 && (
              <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/60 rounded-lg border border-orange-200 dark:border-orange-800/70">
                <div className="text-xs text-orange-600 dark:text-orange-300">Atrasados</div>
                <div className="font-semibold text-sm flex items-center justify-center gap-1 text-orange-700 dark:text-orange-300">
                  <Clock className="h-3 w-3" />
                  {metrics.overdueCount}
                </div>
              </div>
            )}

            {metrics.totalValue > 0 && (
              <div className="col-span-2 text-center p-2 bg-green-50 dark:bg-green-950/60 rounded-lg border border-green-200 dark:border-green-800/70">
                <div className="text-xs text-green-600 dark:text-green-300">Valor Total</div>
                <div className="font-semibold text-sm text-green-700 dark:text-green-300">
                  ${metrics.totalValue.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-3 space-y-3 overflow-y-auto">
        {isCollapsed ? (
          <div className="text-center text-sm text-muted-foreground dark:text-muted-foreground/80 py-4">
            Columna contraída
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground dark:text-muted-foreground/80 py-8 border-2 border-dashed border-muted-foreground/30 dark:border-muted-foreground/25 rounded-lg bg-muted/20 dark:bg-muted/15">
            <div className="space-y-2">
              <div className="text-2xl opacity-50">📋</div>
              <div>Sin elementos</div>
              <div className="text-xs">Arrastra elementos aquí</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items
              .sort((a, b) => {
                // Sort by urgency first, then by score, then by creation date
                const urgencyA = a.urgency ?? 3
                const urgencyB = b.urgency ?? 3
                if (urgencyA !== urgencyB) return urgencyB - urgencyA
                
                const scoreA = scores[a.id] ?? 0
                const scoreB = scores[b.id] ?? 0
                if (scoreA !== scoreB) return scoreB - scoreA
                
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              })
              .map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "transition-all duration-200",
                    dragOverItem === item.id && "transform translate-y-1"
                  )}
                  onDragEnter={() => setDragOverItem(item.id)}
                  onDragLeave={() => setDragOverItem(null)}
                >
                  <KanbanCard
                    item={item}
                    score={scores[item.id]}
                    onDragStart={onDragStart}
                    onView={onViewItem}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                  />
                  
                  {/* Drop indicator */}
                  {dragOverItem === item.id && (
                    <div className="h-1 bg-primary dark:bg-primary-foreground rounded-full my-2 animate-pulse shadow-sm" />
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})