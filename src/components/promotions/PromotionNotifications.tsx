'use client'

import { useEffect, useState } from 'react'
import { Bell, X, Tag, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePromotions } from '@/hooks/use-promotions'
import { formatCurrency } from '@/lib/currency'
import { differenceInDays, parseISO } from 'date-fns'

interface PromotionNotification {
  id: string
  type: 'expiring' | 'new' | 'usage_limit'
  title: string
  message: string
  promotion: any
  priority: 'high' | 'medium' | 'low'
}

export function PromotionNotifications() {
  const { promotions } = usePromotions()
  const [notifications, setNotifications] = useState<PromotionNotification[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const generateNotifications = () => {
      const newNotifications: PromotionNotification[] = []
      const now = new Date()

      promotions.forEach(promo => {
        if (!promo.is_active) return

        // Promociones que expiran pronto
        if (promo.end_date) {
          const endDate = parseISO(promo.end_date)
          const daysRemaining = differenceInDays(endDate, now)
          
          if (daysRemaining <= 3 && daysRemaining > 0) {
            newNotifications.push({
              id: `expiring-${promo.id}`,
              type: 'expiring',
              title: 'Promoción por expirar',
              message: `"${promo.name}" expira en ${daysRemaining} día${daysRemaining > 1 ? 's' : ''}`,
              promotion: promo,
              priority: daysRemaining <= 1 ? 'high' : 'medium'
            })
          }
        }

        // Promociones cerca del límite de uso
        if (promo.usage_limit && promo.usage_count) {
          const usagePercentage = (promo.usage_count / promo.usage_limit) * 100
          
          if (usagePercentage >= 90) {
            newNotifications.push({
              id: `usage-${promo.id}`,
              type: 'usage_limit',
              title: 'Límite de uso casi alcanzado',
              message: `"${promo.name}" ha sido usada ${promo.usage_count}/${promo.usage_limit} veces`,
              promotion: promo,
              priority: usagePercentage >= 95 ? 'high' : 'medium'
            })
          }
        }
      })

      // Ordenar por prioridad
      newNotifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

      setNotifications(newNotifications)
      setIsVisible(newNotifications.length > 0)
    }

    generateNotifications()
  }, [promotions])

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const dismissAll = () => {
    setNotifications([])
    setIsVisible(false)
  }

  if (!isVisible || notifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.slice(0, 3).map((notification) => (
        <Card 
          key={notification.id} 
          className={`shadow-lg border-l-4 ${
            notification.priority === 'high' 
              ? 'border-l-red-500 bg-red-50 dark:bg-red-900/20' 
              : notification.priority === 'medium'
              ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
              : 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <div className={`p-1 rounded-full ${
                  notification.type === 'expiring' 
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' 
                    : notification.type === 'usage_limit'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                }`}>
                  {notification.type === 'expiring' ? (
                    <Clock className="h-3 w-3" />
                  ) : notification.type === 'usage_limit' ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Tag className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {notification.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {notification.message}
                  </p>
                  <Badge variant="outline" className="text-xs mt-2">
                    {notification.promotion.code}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                onClick={() => dismissNotification(notification.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {notifications.length > 3 && (
        <Card className="shadow-lg">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">
              +{notifications.length - 3} notificaciones más
            </p>
            <Button variant="ghost" size="sm" onClick={dismissAll} className="text-xs mt-1">
              Descartar todas
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}