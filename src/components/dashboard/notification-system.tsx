'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Package,
  Settings,
  Trash2,
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type NotificationType = 'success' | 'warning' | 'error' | 'info'
export type NotificationCategory = 'stock' | 'sales' | 'system' | 'product' | 'general'

export interface Notification {
  id: string
  type: NotificationType
  category: NotificationCategory
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionable?: boolean
  action?: {
    label: string
    onClick: () => void
  }
  data?: unknown
}

interface NotificationSystemProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDeleteNotification: (id: string) => void
  onClearAll: () => void
  className?: string
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  compact?: boolean
}

const notificationIcons = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
}

// Acento por tipo: se aplica al chip del ícono y a la barra lateral de "no
// leído", en vez de teñir toda la tarjeta (más limpio y legible en ambos temas).
const typeAccent: Record<NotificationType, { chip: string; bar: string }> = {
  success: {
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  warning: {
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  error: {
    chip: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    bar: 'bg-red-500',
  },
  info: {
    chip: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
}

const categoryIcons = {
  stock: Package,
  sales: GSIcon,
  system: Settings,
  product: Package,
  general: Info,
}

function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDelete, 
  compact = false 
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type]
  const accent = typeAccent[notification.type]
  const unread = !notification.read

  const handleMarkAsRead = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
  }

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (notification.action) {
      notification.action.onClick()
      handleMarkAsRead()
    }
  }

  const timeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Ahora'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return `${Math.floor(diffInMinutes / 1440)}d`
  }

  return (
    <div
      onClick={handleMarkAsRead}
      className={cn(
        "group relative flex gap-3 overflow-hidden rounded-xl border border-border/60 bg-card transition-colors",
        unread ? "bg-accent/40 hover:bg-accent/60 cursor-pointer" : "hover:bg-accent/30",
        compact ? "p-2.5 pl-3.5" : "p-3 pl-4"
      )}
    >
      {/* Barra de acento para no leídas */}
      {unread && (
        <span className={cn("absolute inset-y-2 left-0 w-1 rounded-full", accent.bar)} />
      )}

      {/* Chip del ícono */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          accent.chip,
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        <Icon className={cn(compact ? "h-4 w-4" : "h-[18px] w-[18px]")} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn("min-w-0 font-semibold leading-tight text-foreground", compact ? "text-xs" : "text-sm")}>
            {notification.title}
          </h4>
          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {timeAgo(notification.timestamp)}
            {unread && <span className={cn("h-1.5 w-1.5 rounded-full", accent.bar)} />}
          </span>
        </div>

        <p className={cn("mt-0.5 line-clamp-2 text-muted-foreground", compact ? "text-xs" : "text-[13px] leading-relaxed")}>
          {notification.message}
        </p>

        {notification.actionable && notification.action && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAction}
            className="mt-2 h-7 rounded-full px-3 text-xs"
          >
            {notification.action.label}
          </Button>
        )}
      </div>

      {/* Descartar: aparece al hover en desktop, siempre visible en touch */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDelete(notification.id) }}
        className="h-6 w-6 shrink-0 self-start rounded-md text-muted-foreground/60 opacity-100 transition hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
        title="Descartar"
        aria-label="Descartar notificación"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function NotificationSystem({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  className
}: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const unreadCount = notifications.filter(n => !n.read).length
  // Copia antes de ordenar: `.sort()` muta en sitio y esto es el array de props.
  const recentNotifications = [...notifications]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5)

  const groupedNotifications = notifications.reduce((acc, notification) => {
    const category = notification.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(notification)
    return acc
  }, {} as Record<NotificationCategory, Notification[]>)

  const handleMarkAllAsRead = () => {
    onMarkAllAsRead()
    toast.success('Todas las notificaciones marcadas como leídas')
  }

  const handleClearAll = () => {
    onClearAll()
    toast.success('Todas las notificaciones eliminadas')
    setIsOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      {/* Notification Bell Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
                aria-label={`${unreadCount} sin leer`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[22rem] p-0" sideOffset={8}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Marcar leídas
              </button>
            )}
          </div>
          <DropdownMenuSeparator className="my-0" />

          {recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Bell className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">Todo al día</p>
              <p className="mt-0.5 text-xs text-muted-foreground">No tenés notificaciones nuevas</p>
            </div>
          ) : (
            <div className="max-h-[22rem] space-y-1.5 overflow-y-auto p-2">
              {recentNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={onMarkAsRead}
                  onDelete={onDeleteNotification}
                  compact
                />
              ))}
            </div>
          )}

          <DropdownMenuSeparator className="my-0" />
          <div className="flex items-center justify-between gap-2 p-2">
            <DropdownMenuItem
              onClick={() => setIsOpen(true)}
              className="flex-1 justify-center rounded-md text-xs font-medium"
            >
              Ver todas
            </DropdownMenuItem>
            {notifications.length > 0 && (
              <DropdownMenuItem
                onClick={handleClearAll}
                className="justify-center rounded-md text-xs font-medium text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Limpiar
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Full Notifications Panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="space-y-1 border-b px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              Centro de notificaciones
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                  {unreadCount}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Alertas de inventario, ventas y avisos del sistema
            </SheetDescription>
          </SheetHeader>

          {/* Acciones rápidas */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2 border-b px-5 py-2.5">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="h-8 flex-1 rounded-full text-xs"
                >
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  Marcar todas como leídas
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-8 rounded-full px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Limpiar
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-base font-semibold">Todo al día</h3>
                <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground">
                  Te avisamos apenas haya un cambio importante
                </p>
              </div>
            ) : (
              <div className="space-y-5 px-5 py-4">
                {Object.entries(groupedNotifications).map(([category, categoryNotifications]) => {
                  const CategoryIcon = categoryIcons[category as NotificationCategory]
                  const categoryLabels = {
                    stock: 'Inventario',
                    sales: 'Ventas',
                    system: 'Sistema',
                    product: 'Productos',
                    general: 'General'
                  }

                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center gap-2">
                        <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {categoryLabels[category as NotificationCategory]}
                        </h3>
                        <span className="text-[11px] font-medium text-muted-foreground/70">
                          {categoryNotifications.length}
                        </span>
                        <div className="h-px flex-1 bg-border/60" />
                      </div>

                      <div className="space-y-2">
                        {[...categoryNotifications]
                          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                          .map(notification => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                              onMarkAsRead={onMarkAsRead}
                              onDelete={onDeleteNotification}
                            />
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Hook for managing notifications
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const lastStockSignatureRef = useRef<string | null>(null)

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `n-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date(),
      read: false
    }
    
    setNotifications(prev => [newNotification, ...prev])
    
    // Show toast for important notifications
    if (notification.type === 'error' || notification.type === 'warning') {
      toast[notification.type](notification.title, {
        description: notification.message
      })
    }
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    )
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Auto-generate notifications based on product data
  const generateStockNotifications = useCallback((products: Array<{ stock_quantity: number; min_stock: number }>) => {
    const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0)
    const outOfStockProducts = products.filter(p => p.stock_quantity === 0)

    const signature = `${lowStockProducts.length}-${outOfStockProducts.length}`
    if (lastStockSignatureRef.current === signature) {
      // No cambios en el estado de stock relevante; evita actualizaciones redundantes
      return
    }
    lastStockSignatureRef.current = signature

    // Clear existing stock notifications
    setNotifications(prev => prev.filter(n => n.category !== 'stock'))

    // Add low stock notifications
    if (lowStockProducts.length > 0) {
      addNotification({
        type: 'warning',
        category: 'stock',
        title: 'Stock Bajo Detectado',
        message: `${lowStockProducts.length} producto${lowStockProducts.length > 1 ? 's' : ''} con stock bajo`,
        actionable: true,
        action: {
          label: 'Ver productos',
          onClick: () => console.log('Navigate to low stock products')
        },
        data: { products: lowStockProducts }
      })
    }

    // Add out of stock notifications
    if (outOfStockProducts.length > 0) {
      addNotification({
        type: 'error',
        category: 'stock',
        title: 'Productos Agotados',
        message: `${outOfStockProducts.length} producto${outOfStockProducts.length > 1 ? 's' : ''} sin stock`,
        actionable: true,
        action: {
          label: 'Reabastecer',
          onClick: () => console.log('Navigate to restock products')
        },
        data: { products: outOfStockProducts }
      })
    }
  }, [addNotification])

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    generateStockNotifications
  }
}

// Componente wrapper por defecto que usa el hook
export default function NotificationSystemWrapper() {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotifications()

  return (
    <NotificationSystem
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDeleteNotification={deleteNotification}
      onClearAll={clearAll}
    />
  )
}
