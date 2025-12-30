"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, BellRing, AlertTriangle, CheckCircle, Info, X, 
  Users, ShoppingCart, Shield, Server, 
  Clock, Search, Trash2
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { format } from 'date-fns'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'security'
  title: string
  message: string
  timestamp: Date
  read: boolean
  category: 'system' | 'sales' | 'users' | 'security' | 'inventory'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

// Datos mock de notificaciones
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'error',
    title: 'Error de Sistema',
    message: 'Fallo en la conexión con la base de datos principal',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    read: false,
    category: 'system',
    priority: 'critical'
  },
  {
    id: '2',
    type: 'success',
    title: 'Venta Completada',
    message: 'Nueva venta por $1,250.00 - Cliente: Juan Pérez',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    read: false,
    category: 'sales',
    priority: 'medium'
  },
  {
    id: '3',
    type: 'warning',
    title: 'Stock Bajo',
    message: 'iPhone 15 Pro tiene solo 3 unidades en inventario',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: true,
    category: 'inventory',
    priority: 'high'
  },
  {
    id: '4',
    type: 'security',
    title: 'Intento de Acceso Sospechoso',
    message: 'Múltiples intentos de login desde IP: 192.168.1.100',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    read: false,
    category: 'security',
    priority: 'high'
  },
  {
    id: '5',
    type: 'info',
    title: 'Nuevo Usuario Registrado',
    message: 'María González se ha registrado en el sistema',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    read: true,
    category: 'users',
    priority: 'low'
  },
  {
    id: '6',
    type: 'success',
    title: 'Backup Completado',
    message: 'Respaldo automático completado exitosamente',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: true,
    category: 'system',
    priority: 'low'
  }
]

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const [activeTab, setActiveTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Simular notificaciones en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      const newNotification: Notification = {
        id: Date.now().toString(),
        type: ['info', 'success', 'warning', 'error'][Math.floor(Math.random() * 4)] as any,
        title: 'Nueva Notificación',
        message: `Notificación automática generada a las ${format(new Date(), 'HH:mm:ss')}`,
        timestamp: new Date(),
        read: false,
        category: ['system', 'sales', 'users', 'security', 'inventory'][Math.floor(Math.random() * 5)] as any,
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
      }
      
      setNotifications(prev => [newNotification, ...prev])
    }, 30000) // Nueva notificación cada 30 segundos

    return () => clearInterval(interval)
  }, [])

  const getNotificationIcon = (type: string, category: string) => {
    if (type === 'security') return Shield
    
    switch (category) {
      case 'sales': return ShoppingCart
      case 'users': return Users
      case 'system': return Server
      case 'inventory': return GSIcon
      default: return Bell
    }
  }

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'critical') return 'text-red-600 bg-red-50 border-red-200'
    
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'success': return 'text-green-600 bg-green-50 border-green-200'
      case 'security': return 'text-purple-600 bg-purple-50 border-purple-200'
      default: return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    }
    return colors[priority as keyof typeof colors] || colors.low
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    )
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const filteredNotifications = useMemo(() => notifications.filter(notif => {
    if (filter === 'unread' && notif.read) return false
    if (filter === 'critical' && notif.priority !== 'critical') return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const t = `${notif.title} ${notif.message}`.toLowerCase()
      return t.includes(q)
    }
    return true
  }), [notifications, filter, searchTerm])

  const notificationsByCategory = useMemo(() => ({
    all: filteredNotifications,
    system: filteredNotifications.filter(n => n.category === 'system'),
    sales: filteredNotifications.filter(n => n.category === 'sales'),
    users: filteredNotifications.filter(n => n.category === 'users'),
    security: filteredNotifications.filter(n => n.category === 'security'),
    inventory: filteredNotifications.filter(n => n.category === 'inventory')
  }), [filteredNotifications])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])
  const activeFiltersCount = (filter !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-primary">
              <BellRing className="h-6 w-6 mr-2 text-primary" />
              Centro de Notificaciones
              {unreadCount > 0 && (
                <Badge className="ml-3 bg-red-500 text-white">
                  {unreadCount}
                </Badge>
              )}
            </h2>
            <p className="text-indigo-600 mt-1">Gestiona todas las notificaciones del sistema</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-600" />
              <Input
                aria-label="Buscar notificaciones"
                placeholder="Buscar..."
                className="pl-9 pr-9 w-[220px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={markAllAsRead}
              aria-label="Marcar todas las notificaciones como leídas"
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar Todo Leído
            </Button>
            <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread' | 'critical')}>
              <SelectTrigger className="w-[160px]" aria-label="Filtro de estado">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">No Leídas</SelectItem>
                <SelectItem value="critical">Críticas</SelectItem>
              </SelectContent>
            </Select>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(notificationsByCategory).map(([category, notifs]) => {
          const unreadInCategory = notifs.filter(n => !n.read).length
          const categoryNames = {
            all: 'Total',
            system: 'Sistema',
            sales: 'Ventas',
            users: 'Usuarios',
            security: 'Seguridad',
            inventory: 'Inventario'
          }
          
          return (
            <Card key={category} className="border-gray-200 hover:shadow-md transition-all duration-300">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{notifs.length}</div>
                <div className="text-sm text-gray-600">{categoryNames[category as keyof typeof categoryNames]}</div>
                {unreadInCategory > 0 && (
                  <Badge variant="destructive" className="mt-1 text-xs">
                    {unreadInCategory} nuevas
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs de Notificaciones */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 bg-gradient-to-r from-indigo-100 to-purple-100 p-1">
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            <Bell className="h-4 w-4 mr-2" />
            Todas
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
          >
            <Server className="h-4 w-4 mr-2" />
            Sistema
          </TabsTrigger>
          <TabsTrigger 
            value="sales" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Ventas
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
          >
            <Shield className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
          >
            <GSIcon className="h-4 w-4" />
            Inventario
          </TabsTrigger>
        </TabsList>

        {Object.entries(notificationsByCategory).map(([category, categoryNotifications]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-3">
                {categoryNotifications.length === 0 ? (
                  <Card className="border-gray-200">
                    <CardContent className="p-8 text-center">
                      <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No hay notificaciones en esta categoría</p>
                    </CardContent>
                  </Card>
                ) : (
                  <AnimatePresence>
                  {categoryNotifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification.type, notification.category)
                    const colorClasses = getNotificationColor(notification.type, notification.priority)
                    
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <Card 
                          className={`border transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${
                            notification.read ? 'opacity-75' : 'shadow-lg'
                          } ${colorClasses}`}
                        >
                          <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className={`p-2 rounded-lg ${colorClasses}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className={`font-semibold ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                                    {notification.title}
                                  </h4>
                                  <Badge className={getPriorityBadge(notification.priority)}>
                                    {notification.priority}
                                  </Badge>
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                                
                                <p className={`text-sm ${notification.read ? 'text-gray-500' : 'text-gray-700'} mb-2`}>
                                  {notification.message}
                                </p>
                                
                                <div className="flex items-center text-xs text-gray-500">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {format(notification.timestamp, 'dd/MM/yyyy HH:mm')}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsRead(notification.id)}
                                  aria-label={`Marcar como leída: ${notification.title}`}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNotification(notification.id)}
                                aria-label={`Eliminar notificación: ${notification.title}`}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
