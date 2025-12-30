'use client'

import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Clock, 
  AlertTriangle, 
  User, 
  Smartphone, 
  Laptop, 
  Tablet,
  Monitor,
  Headphones,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RepairOrder } from '@/types/repairs'
import { predictRepairTime } from '@/lib/repair-predictive'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface KanbanCardProps {
  item: RepairOrder
  score?: number
  isDragging?: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

const deviceIcons = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
  accessory: Headphones,
  other: Monitor
}

const urgencyConfig = {
  1: { 
    label: 'Muy Baja', 
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' 
  },
  2: { 
    label: 'Baja', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700' 
  },
  3: { 
    label: 'Media', 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700' 
  },
  4: { 
    label: 'Alta', 
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-700' 
  },
  5: { 
    label: 'Crítica', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700' 
  }
}

export const KanbanCard = memo(function KanbanCard({
  item,
  score,
  isDragging = false,
  onDragStart,
  onView,
  onEdit,
  onDelete
}: KanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const prediction = predictRepairTime(item)
  const urgency = item.urgency ?? 3
  const urgencyInfo = urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig[3]
  
  const daysSinceCreated = differenceInDays(new Date(), new Date(item.createdAt))
  const isOverdue = daysSinceCreated > 7
  const isUrgent = urgency >= 4
  
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
    locale: es
  })

  const DeviceIcon = deviceIcons[item.deviceType as keyof typeof deviceIcons] || deviceIcons.other

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md dark:hover:shadow-xl border-border dark:border-muted/60 bg-card dark:bg-card/95",
        isDragging && "opacity-50 rotate-2 scale-105",
        isOverdue && "border-orange-300 bg-orange-50/50 dark:border-orange-500/70 dark:bg-orange-950/40",
        isUrgent && "border-red-300 bg-red-50/50 dark:border-red-500/70 dark:bg-red-950/40",
        isHovered && "scale-[1.02] shadow-lg dark:shadow-2xl"
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with device and urgency */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-1.5 bg-primary/15 dark:bg-primary/25 rounded-lg flex-shrink-0 border border-primary/20 dark:border-primary/30">
              <DeviceIcon className="h-4 w-4 text-primary dark:text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm truncate text-foreground dark:text-foreground">{item.deviceModel}</h4>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground/80 truncate">{item.customerName}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/60 dark:hover:bg-muted/40">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-popover/95 dark:border-muted/60 backdrop-blur-sm">
              <DropdownMenuItem onClick={() => onView?.(item.id)} className="dark:hover:bg-muted/50">
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(item.id)} className="dark:hover:bg-muted/50">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(item.id)} className="text-destructive dark:text-red-400 dark:hover:bg-red-950/40">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Issue description */}
        <div className="bg-muted/60 dark:bg-muted/40 rounded-lg p-2 border border-muted/60 dark:border-muted/60">
          <p className="text-xs text-muted-foreground dark:text-muted-foreground/90 line-clamp-2">
            {item.issueDescription}
          </p>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className={urgencyInfo.color} size="sm">
            {urgencyInfo.label}
          </Badge>
          
          {isUrgent && (
            <Badge variant="destructive" size="sm" className="animate-pulse bg-red-600 dark:bg-red-500 text-white border-red-700 dark:border-red-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Urgente
            </Badge>
          )}
          
          {isOverdue && (
            <Badge variant="outline" size="sm" className="border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/60">
              <Clock className="h-3 w-3 mr-1" />
              Atrasado
            </Badge>
          )}
          
          <Badge variant="secondary" size="sm" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
            {prediction.predictedHours}h
          </Badge>
        </div>

        {/* Technician info */}
        {item.technician && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 border border-muted/40 dark:border-muted/60">
              <AvatarImage src={item.technician.avatar} />
              <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {item.technician.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground dark:text-muted-foreground/90 truncate">
              {item.technician.name}
            </span>
          </div>
        )}

        {/* Footer with time and score */}
        <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-muted-foreground/80 pt-2 border-t border-muted/40 dark:border-muted/50">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </div>
          
          {score !== undefined && (
            <div className="font-medium text-primary dark:text-primary-foreground">
              Score: {score.toFixed(1)}
            </div>
          )}
          
          {item.historicalValue && item.historicalValue > 0 && (
            <div className="font-medium text-green-600 dark:text-green-400">
              ${item.historicalValue.toLocaleString()}
            </div>
          )}
        </div>

        {/* Progress indicator for overdue items */}
        {isOverdue && (
          <div className="w-full bg-orange-200 dark:bg-orange-900/60 rounded-full h-1.5 border border-orange-300 dark:border-orange-700/70">
            <div 
              className="bg-orange-500 dark:bg-orange-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (daysSinceCreated / 14) * 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
})