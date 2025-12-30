'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X, 
  Package, 
  TrendingDown, 
  TrendingUp,
  Clock,
  Star,
  Users,
  Settings,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
  data?: any
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

const notificationColors = {
  success: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-orange-600 bg-orange-50 border-orange-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
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
  const CategoryIcon = categoryIcons[notification.category]
  
  const handleMarkAsRead = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id)
    }
  }

  const handleAction = () => {
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
      className={cn(
        "border rounded-lg p-3 transition-all duration-200 hover:shadow-sm",
        notificationColors[notification.type],
        !notification.read && "ring-2 ring-blue-200",
        compact && "p-2"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={cn("h-5 w-5", compact && "h-4 w-4")} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CategoryIcon className="h-3 w-3 opacity-60" />
                <h4 className={cn(
                  "font-medium text-sm",
                  compact && "text-xs"
                )}>
                  {notification.title}
                </h4>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              
              <p className={cn(
                "text-sm opacity-80 leading-relaxed",
                compact && "text-xs"
              )}>
                {notification.message}
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <span className={cn(
                  "text-xs opacity-60 flex items-center gap-1",
                  compact && "text-xs"
                )}>
                  <Clock className="h-3 w-3" />
                  {timeAgo(notification.timestamp)}
                </span>
                
                {notification.actionable && notification.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAction}
                    className={cn(
                      "text-xs h-6 px-2",
                      compact && "h-5 px-1 text-xs"
                    )}
                  >
                    {notification.action.label}
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMarkAsRead}
                  className={cn(
                    "h-6 w-6 opacity-60 hover:opacity-100",
                    compact && "h-5 w-5"
                  )}
                  title="Marcar como leído"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(notification.id)}
                className={cn(
                  "h-6 w-6 opacity-60 hover:opacity-100 hover:text-red-600",
                  compact && "h-5 w-5"
                )}
                title="Eliminar notificación"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
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
  const recentNotifications = notifications
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
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} nuevas</Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-2 p-2">
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
            </div>
          )}
          
          <DropdownMenuSeparator />
          <div className="p-2 space-y-1">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver todas
                </DropdownMenuItem>
              </SheetTrigger>
            </Sheet>
            
            {unreadCount > 0 && (
              <DropdownMenuItem onClick={handleMarkAllAsRead}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Marcar todas como leídas
              </DropdownMenuItem>
            )}
            
            {notifications.length > 0 && (
              <DropdownMenuItem onClick={handleClearAll} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Limpiar todas
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Full Notifications Panel */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Centro de Notificaciones</span>
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} sin leer</Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Mantente al día con los cambios importantes en tu inventario
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {/* Quick Actions */}
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Marcar todas como leídas
                </Button>
              )}
              
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpiar todas
                </Button>
              )}
            </div>

            {/* Notifications by Category */}
            <ScrollArea className="h-[calc(100vh-200px)]">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No hay notificaciones</h3>
                  <p className="text-muted-foreground">
                    Te notificaremos cuando haya cambios importantes
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
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
                        <div className="flex items-center gap-2 mb-3">
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                            {categoryLabels[category as NotificationCategory]}
                          </h3>
                          <div className="flex-1 h-px bg-border" />
                          <Badge variant="secondary" className="text-xs">
                            {categoryNotifications.length}
                          </Badge>
                        </div>
                        
                        <div className="space-y-3">
                          {categoryNotifications
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
          </div>
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
      id: Math.random().toString(36).substr(2, 9),
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
  const generateStockNotifications = useCallback((products: any[]) => {
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
