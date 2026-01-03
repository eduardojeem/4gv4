/**
 * RepairRow - Memoized table row component for repair list
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 * Only re-renders when repair data, status, or lastUpdate changes.
 */

import React, { memo } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, Phone, Clock, Image as ImageIcon, Eye } from 'lucide-react'
import { Repair, RepairStatus } from '@/types/repairs'
import { statusConfig, priorityConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface RepairRowProps {
  repair: Repair
  onStatusChange?: (id: string, status: RepairStatus) => void
  onEdit: (repair: Repair) => void
  onView?: (repair: Repair) => void
  onDelete?: (id: string) => void
}

export const RepairRow = memo<RepairRowProps>(
  function RepairRow({ repair, onStatusChange, onEdit, onView, onDelete }) {
    const StatusIcon = statusConfig[repair.status].icon
    const priority = priorityConfig[repair.priority]
    
    // Safely handle date formatting with validation
    const timeAgo = (() => {
      try {
        if (!repair.createdAt) return 'Fecha no disponible'
        const date = new Date(repair.createdAt)
        if (isNaN(date.getTime())) return 'Fecha inválida'
        return formatDistanceToNow(date, {
          addSuffix: true,
          locale: es
        })
      } catch (error) {
        console.warn('Error formatting date for repair:', repair.id, error)
        return 'Fecha no disponible'
      }
    })()

    return (
      <TableRow
        className="group hover:bg-muted/60 dark:hover:bg-muted/40 transition-colors cursor-pointer border-b border-border dark:border-muted/30"
        onClick={() => onView ? onView(repair) : onEdit(repair)}
      >
        <TableCell className="font-mono text-xs font-medium">
          <span className="text-muted-foreground dark:text-muted-foreground/80">#</span>
          {repair.id.slice(0, 8)}
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground">
                {repair.customer.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-sm text-foreground dark:text-foreground">{repair.customer.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground/80">
                {repair.customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {repair.customer.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </TableCell>

        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-foreground dark:text-foreground">{repair.device}</span>
            <span className="text-xs text-muted-foreground dark:text-muted-foreground/80">
              {repair.brand} {repair.model}
            </span>
          </div>
        </TableCell>

        <TableCell className="hidden md:table-cell max-w-[250px]">
          <p className="text-sm truncate text-foreground dark:text-foreground/90" title={repair.issue}>
            {repair.issue}
          </p>
        </TableCell>

        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              'flex w-fit items-center gap-1.5 font-medium',
              statusConfig[repair.status].color
            )}
          >
            <StatusIcon className="h-3 w-3" />
            <span className="hidden sm:inline">
              {statusConfig[repair.status].label}
            </span>
          </Badge>
        </TableCell>

        <TableCell className="hidden lg:table-cell">
          <Badge
            variant="secondary"
            className={cn('flex w-fit items-center gap-1', priority.color)}
          >
            <span>{priority.icon}</span>
            <span className="text-xs">{priority.label}</span>
          </Badge>
        </TableCell>

        <TableCell className="hidden xl:table-cell">
          {repair.technician ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {repair.technician.name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'T'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground dark:text-foreground/90">
                {repair.technician.name || repair.technician.id}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground dark:text-muted-foreground/70">Sin asignar</span>
          )}
        </TableCell>

        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-muted-foreground/80">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </div>
        </TableCell>
        
        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-muted-foreground/80">
            <ImageIcon className="h-3 w-3" />
            {(repair.images && Array.isArray(repair.images)) ? repair.images.length : 0}
          </div>
        </TableCell>

        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 dark:bg-popover/95 dark:border-muted/50 backdrop-blur-sm">
              <DropdownMenuLabel className="text-foreground dark:text-foreground">Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-muted/50" />
              <DropdownMenuItem onClick={() => onView ? onView(repair) : onEdit(repair)} className="dark:hover:bg-muted/50">
                <Eye className="mr-2 h-4 w-4" />
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(repair)} className="dark:hover:bg-muted/50">
                <Edit className="mr-2 h-4 w-4" />
                Editar reparación
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-muted/50" />
              <DropdownMenuLabel className="text-xs text-muted-foreground dark:text-muted-foreground/80">
                Cambiar estado
              </DropdownMenuLabel>
              {Object.entries(statusConfig).map(([key, config]) => {
                const Icon = config.icon
                if (key === repair.status) return null
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() =>
                      onStatusChange?.(repair.id, key as RepairStatus)
                    }
                    className="dark:hover:bg-muted/50"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {config.label}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator className="dark:bg-muted/50" />
              <DropdownMenuItem
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/40"
                onClick={() => onDelete?.(repair.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    )
  },
  // Optimized comparison function - check most likely to change properties first
  (prevProps, nextProps) => {
    const prev = prevProps.repair
    const next = nextProps.repair
    
    // Fast path: if it's the same object reference, no need to re-render
    if (prev === next) return true
    
    // Check most frequently changing properties first
    if (prev.status !== next.status) return false
    if (prev.priority !== next.priority) return false
    if (prev.lastUpdate !== next.lastUpdate) return false
    
    // Check less frequently changing properties
    if (prev.id !== next.id) return false
    if (prev.customer.name !== next.customer.name) return false
    if (prev.technician?.id !== next.technician?.id) return false
    
    // Check image count (if images array changed)
    const prevImageCount = (prev.images && Array.isArray(prev.images)) ? prev.images.length : 0
    const nextImageCount = (next.images && Array.isArray(next.images)) ? next.images.length : 0
    if (prevImageCount !== nextImageCount) return false
    
    return true
  }
)

RepairRow.displayName = 'RepairRow'
