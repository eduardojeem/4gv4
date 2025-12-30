/**
 * RepairCard - Memoized card component for Kanban view
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 * Only re-renders when repair data or priority changes.
 */

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Image as ImageIcon, User, Wrench } from 'lucide-react'
import { Repair } from '@/types/repairs'
import { priorityConfig } from '@/data/mock-repairs'
import { cn } from '@/lib/utils'

interface RepairCardProps {
  repair: Repair
  onClick?: () => void
  className?: string
}

export const RepairCard = memo<RepairCardProps>(
  function RepairCard({ repair, onClick, className }) {
    return (
      <Card
        className={cn('hover:shadow-md dark:hover:shadow-xl transition-all cursor-pointer border-border dark:border-muted/50 bg-card dark:bg-card/95', className)}
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-medium text-sm truncate max-w-[150px] text-foreground dark:text-foreground">
              {repair.device}
            </span>
            <Badge
              className={cn(
                'text-[10px] px-1 py-0 h-5',
                priorityConfig[repair.priority].bgColor
              )}
            >
              {priorityConfig[repair.priority].label}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground dark:text-muted-foreground/80">
            <div className="flex items-center gap-1 truncate max-w-[60%]">
              <User className="h-3 w-3" />
              <span className="truncate">{repair.customer.name}</span>
            </div>
            <div className="flex items-center gap-1 truncate max-w-[35%]">
              <Wrench className="h-3 w-3" />
              <span className="truncate">{repair.technician?.name || 'Sin asignar'}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground dark:text-muted-foreground/80 line-clamp-2 min-h-[2.5em]">
            {repair.issue}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-muted-foreground/80 pt-2 border-t border-border dark:border-muted/40 mt-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(repair.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                <span>{Array.isArray(repair.images) ? repair.images.length : 0}</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-100 dark:bg-muted/60 text-slate-700 dark:text-muted-foreground px-1 rounded">
                {repair.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  },
  // Custom comparison - only re-render if these properties change
  (prevProps, nextProps) => {
    return (
      prevProps.repair.id === nextProps.repair.id &&
      prevProps.repair.device === nextProps.repair.device &&
      prevProps.repair.issue === nextProps.repair.issue &&
      prevProps.repair.priority === nextProps.repair.priority &&
      prevProps.repair.createdAt === nextProps.repair.createdAt
    )
  }
)

RepairCard.displayName = 'RepairCard'
