"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Star,
  Bookmark,
  Clock,
  MoreHorizontal,
  Eye,
  EyeOff,
  Archive,
  Trash2,
  Share2,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Users,
  MapPin,
  Calendar,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Notification, NotificationAction } from './NotificationCenter'

interface NotificationItemProps {
  notification: Notification
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onMarkAsRead: (id: string) => void
  onMarkAsUnread: (id: string) => void
  onToggleStar: (id: string) => void
  onToggleBookmark: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onSnooze: (id: string, hours: number) => void
  viewMode: 'list' | 'grid' | 'timeline'
  compact?: boolean
  showSelection?: boolean
}

export function NotificationItem({
  notification,
  isSelected,
  onToggleSelect,
  onMarkAsRead,
  onMarkAsUnread,
  onToggleStar,
  onToggleBookmark,
  onArchive,
  onDelete,
  onSnooze,
  viewMode,
  compact = false,
  showSelection = false
}: NotificationItemProps) {
  
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`
    return time.toLocaleDateString('es-PY', { month: 'short', day: 'numeric' })
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50 dark:bg-red-950 ring-2 ring-red-200 dark:ring-red-800'
      case 'high': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950 ring-1 ring-orange-200 dark:ring-orange-800'
      case 'medium': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950'
      case 'low': return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950'
      default: return 'border-l-gray-300'
    }
  }

  const getPriorityBadge = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return <Badge variant="destructive" className="text-xs">Crítica</Badge>
      case 'high': return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">Alta</Badge>
      case 'medium': return <Badge variant="outline" className="text-xs">Media</Badge>
      case 'low': return <Badge variant="outline" className="text-xs text-gray-500">Baja</Badge>
      default: return null
    }
  }

  const isOverdue = notification.dueDate && new Date(notification.dueDate) < new Date()
  const isSnoozed = notification.snoozeUntil && new Date(notification.snoozeUntil) > new Date()

  const handleActionClick = (action: NotificationAction, e: React.MouseEvent) => {
    e.stopPropagation()
    if (action.requiresConfirmation) {
      if (confirm(action.confirmationMessage || '¿Estás seguro?')) {
        action.onClick()
      }
    } else {
      action.onClick()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  if (viewMode === 'grid') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="group"
      >
        <Card className={cn(
          "border-l-4 transition-all duration-200 hover:shadow-lg cursor-pointer h-full",
          getPriorityColor(notification.priority),
          !notification.isRead && "ring-2 ring-blue-200 dark:ring-blue-800",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
        )}
        onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
        >
          <CardContent className="p-4 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {showSelection && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(notification.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex items-center gap-1">
                  {notification.isStarred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
                  {notification.isBookmarked && <Bookmark className="h-3 w-3 text-blue-500 fill-current" />}
                  {isOverdue && <AlertCircle className="h-3 w-3 text-red-500" />}
                  {isSnoozed && <Clock className="h-3 w-3 text-orange-500" />}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => notification.isRead ? onMarkAsUnread(notification.id) : onMarkAsRead(notification.id)}>
                    {notification.isRead ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {notification.isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleStar(notification.id)}>
                    <Star className={cn("mr-2 h-4 w-4", notification.isStarred && "fill-current text-yellow-500")} />
                    {notification.isStarred ? 'Quitar estrella' : 'Marcar con estrella'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleBookmark(notification.id)}>
                    <Bookmark className={cn("mr-2 h-4 w-4", notification.isBookmarked && "fill-current text-blue-500")} />
                    {notification.isBookmarked ? 'Quitar marcador' : 'Agregar marcador'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onSnooze(notification.id, 1)}>
                    <Clock className="mr-2 h-4 w-4" />
                    Posponer 1 hora
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSnooze(notification.id, 24)}>
                    <Clock className="mr-2 h-4 w-4" />
                    Posponer 1 día
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => copyToClipboard(notification.title + '\n' + notification.message)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar contenido
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive(notification.id)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(notification.id)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className={cn(
                  "font-semibold text-sm line-clamp-2",
                  !notification.isRead && "text-blue-900 dark:text-blue-100"
                )}>
                  {notification.title}
                </h4>
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-xs mb-3 line-clamp-3">
                {notification.message}
              </p>

              {notification.description && (
                <p className="text-gray-500 dark:text-gray-500 text-xs mb-3 line-clamp-2">
                  {notification.description}
                </p>
              )}

              {/* Tags */}
              {notification.tags && notification.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {notification.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {notification.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      +{notification.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">{formatTimeAgo(notification.timestamp)}</span>
                </div>
                {getPriorityBadge(notification.priority)}
              </div>

              {notification.relatedCustomerName && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="h-3 w-3" />
                  <span className="truncate">{notification.relatedCustomerName}</span>
                </div>
              )}

              {/* Actions */}
              {notification.actions && notification.actions.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {notification.actions.slice(0, 2).map((action) => (
                    <Button
                      key={action.id}
                      size="sm"
                      variant={action.type === 'primary' ? 'default' : 'outline'}
                      onClick={(e) => handleActionClick(action, e)}
                      className="text-xs h-6 px-2 gap-1"
                      disabled={action.disabled}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                  {notification.actions.length > 2 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2">
                          +{notification.actions.length - 2}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {notification.actions.slice(2).map((action) => (
                          <DropdownMenuItem key={action.id} onClick={() => action.onClick()}>
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Vista de lista (por defecto)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="group"
    >
      <Card className={cn(
        "border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer",
        getPriorityColor(notification.priority),
        !notification.isRead && "ring-2 ring-blue-200 dark:ring-blue-800",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400"
      )}
      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
      >
        <CardContent className={cn("p-4", compact && "p-3")}>
          <div className="flex items-start gap-3">
            {/* Selection checkbox */}
            {showSelection && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(notification.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      "font-semibold",
                      !notification.isRead && "text-blue-900 dark:text-blue-100",
                      compact ? "text-sm" : "text-base"
                    )}>
                      {notification.title}
                    </h4>
                    
                    <div className="flex items-center gap-1">
                      {notification.isStarred && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
                      {notification.isBookmarked && <Bookmark className="h-3 w-3 text-blue-500 fill-current" />}
                      {isOverdue && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>Vencida</TooltipContent>
                        </Tooltip>
                      )}
                      {isSnoozed && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Clock className="h-3 w-3 text-orange-500" />
                          </TooltipTrigger>
                          <TooltipContent>Pospuesta</TooltipContent>
                        </Tooltip>
                      )}
                      {notification.actionRequired && (
                        <Badge variant="destructive" className="text-xs">
                          Acción Requerida
                        </Badge>
                      )}
                      {notification.source === 'ai' && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Zap className="h-2 w-2" />
                              IA
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Generada por IA (Confianza: {Math.round((notification.confidence || 0) * 100)}%)
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <p className={cn(
                    "text-gray-600 dark:text-gray-400 mb-2",
                    compact ? "text-sm" : "text-base"
                  )}>
                    {notification.message}
                  </p>

                  {notification.description && (
                    <p className="text-gray-500 dark:text-gray-500 text-sm mb-2">
                      {notification.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(notification.timestamp)}
                    </div>
                    
                    {notification.relatedCustomerName && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {notification.relatedCustomerName}
                      </div>
                    )}
                    
                    {getPriorityBadge(notification.priority)}
                  </div>

                  {/* Tags */}
                  {notification.tags && notification.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {notification.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {notification.actions && notification.actions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {notification.actions.map((action) => (
                        <Button
                          key={action.id}
                          size="sm"
                          variant={action.type === 'primary' ? 'default' : 'outline'}
                          onClick={(e) => handleActionClick(action, e)}
                          className="gap-1"
                          disabled={action.disabled}
                        >
                          {action.icon}
                          {action.label}
                          {action.shortcut && (
                            <Badge variant="secondary" className="ml-1 text-xs px-1">
                              {action.shortcut}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => notification.isRead ? onMarkAsUnread(notification.id) : onMarkAsRead(notification.id)}>
                      {notification.isRead ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {notification.isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleStar(notification.id)}>
                      <Star className={cn("mr-2 h-4 w-4", notification.isStarred && "fill-current text-yellow-500")} />
                      {notification.isStarred ? 'Quitar estrella' : 'Marcar con estrella'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleBookmark(notification.id)}>
                      <Bookmark className={cn("mr-2 h-4 w-4", notification.isBookmarked && "fill-current text-blue-500")} />
                      {notification.isBookmarked ? 'Quitar marcador' : 'Agregar marcador'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSnooze(notification.id, 1)}>
                      <Clock className="mr-2 h-4 w-4" />
                      Posponer 1 hora
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(notification.id, 24)}>
                      <Clock className="mr-2 h-4 w-4" />
                      Posponer 1 día
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => copyToClipboard(notification.title + '\n' + notification.message)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar contenido
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive(notification.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archivar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(notification.id)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}