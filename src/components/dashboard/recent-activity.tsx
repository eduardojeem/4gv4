'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Mock data - In real app, this would come from Supabase
const activities = [
  {
    id: 1,
    type: 'sale',
    description: 'Venta completada por $250.00',
    user: 'Juan Pérez',
    userAvatar: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    status: 'completed'
  },
  {
    id: 2,
    type: 'repair',
    description: 'Nueva reparación registrada - iPhone 12',
    user: 'María García',
    userAvatar: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    status: 'pending'
  },
  {
    id: 3,
    type: 'customer',
    description: 'Nuevo cliente registrado',
    user: 'Carlos López',
    userAvatar: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    status: 'new'
  },
  {
    id: 4,
    type: 'repair',
    description: 'Reparación completada - Samsung Galaxy S21',
    user: 'Ana Martínez',
    userAvatar: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    status: 'completed'
  },
  {
    id: 5,
    type: 'product',
    description: 'Stock actualizado - Pantalla iPhone 13',
    user: 'Sistema',
    userAvatar: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    status: 'info'
  }
]

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'sale':
      return '💰'
    case 'repair':
      return '🔧'
    case 'customer':
      return '👤'
    case 'product':
      return '📦'
    default:
      return '📋'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'new':
      return 'bg-blue-100 text-blue-800'
    case 'info':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function RecentActivity() {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
              {getActivityIcon(activity.type)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{activity.description}</p>
            <div className="flex items-center space-x-2 mt-1">
              <p className="text-xs text-gray-500">por {activity.user}</p>
              <Badge variant="secondary" className={getStatusColor(activity.status)}>
                {activity.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {(() => {
                try {
                  if (!activity.timestamp) return 'Fecha no disponible'
                  const date = new Date(activity.timestamp)
                  if (isNaN(date.getTime())) return 'Fecha inválida'
                  return formatDistanceToNow(date, { 
                    addSuffix: true, 
                    locale: es 
                  })
                } catch (error) {
                  return 'Fecha no disponible'
                }
              })()}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}export default RecentActivity
