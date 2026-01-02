"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence  } from '../../ui/motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle,
  Info,
  Star,
  TrendingUp,
  Users,
  ShoppingCart,
  MessageSquare,
  Settings,
  Search,
  Filter,
  MoreHorizontal,
  X,
  Eye,
  EyeOff,
  Archive,
  Trash2,
  Clock,
  Zap,
  Target,
  DollarSign,
  UserPlus,
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  Send,
  Bookmark,
  BookmarkCheck,
  Share2,
  Download,
  Upload,
  RefreshCw,
  Lightbulb,
  TrendingDown,
  Heart,
  Gift,
  CreditCard,
  MapPin,
  Smartphone,
  Globe,
  BarChart3,
  PieChart,
  Activity,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Palette,
  Sliders,
  Database,
  Shield,
  Lock,
  Unlock,
  Key,
  FileText,
  Image,
  Video,
  Music,
  Headphones,
  Mic,
  Camera,
  Monitor,
  Printer,
  HardDrive,
  Cpu,
  MemoryStick,
  Battery,
  BatteryLow,
  Plug,
  Power,
  PowerOff,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Customer } from '@/hooks/use-customer-state'
import { NotificationItem } from './NotificationItem'

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'opportunity' | 'urgent' | 'celebration' | 'reminder'
  category: 'sales' | 'support' | 'marketing' | 'system' | 'customer' | 'finance' | 'inventory' | 'analytics' | 'security'
  title: string
  message: string
  description?: string
  timestamp: string
  isRead: boolean
  isArchived: boolean
  isBookmarked: boolean
  isStarred: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  actionRequired: boolean
  autoArchiveAfter?: number // días
  relatedCustomerId?: string
  relatedCustomerName?: string
  relatedCustomerSegment?: string
  tags?: string[]
  source?: 'system' | 'manual' | 'ai' | 'integration'
  confidence?: number // para notificaciones generadas por IA
  metadata?: {
    amount?: number
    orderId?: string
    productId?: string
    campaignId?: string
    location?: string
    deviceInfo?: string
    ipAddress?: string
    userAgent?: string
    referrer?: string
    sessionId?: string
    [key: string]: any
  }
  actions?: NotificationAction[]
  attachments?: NotificationAttachment[]
  relatedNotifications?: string[] // IDs de notificaciones relacionadas
  escalationLevel?: number
  assignedTo?: string
  dueDate?: string
  completedAt?: string
  snoozeUntil?: string
}

export interface NotificationAction {
  id: string
  label: string
  type: 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
  icon?: React.ReactNode
  onClick: () => void
  requiresConfirmation?: boolean
  confirmationMessage?: string
  disabled?: boolean
  loading?: boolean
  shortcut?: string
}

export interface NotificationAttachment {
  id: string
  name: string
  type: 'image' | 'document' | 'video' | 'audio' | 'link'
  url: string
  size?: number
  thumbnail?: string
}

export interface NotificationTemplate {
  id: string
  name: string
  category: Notification['category']
  type: Notification['type']
  priority: Notification['priority']
  titleTemplate: string
  messageTemplate: string
  actionRequired: boolean
  autoArchiveAfter?: number
  tags: string[]
  conditions: {
    customerSegment?: string[]
    customerStatus?: string[]
    timeRange?: { start: string; end: string }
    minAmount?: number
    maxAmount?: number
    [key: string]: any
  }
}

export interface NotificationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: {
    event: string
    conditions: Record<string, any>
  }
  template: NotificationTemplate
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  lastTriggered?: string
  triggerCount: number
}

interface NotificationCenterProps {
  customers: Customer[]
}

// Configuración avanzada de notificaciones por categoría
const notificationConfig = {
  sales: {
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-green-500 to-emerald-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    label: 'Ventas',
    description: 'Oportunidades de venta y seguimiento de clientes'
  },
  support: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    label: 'Soporte',
    description: 'Tickets de soporte y consultas de clientes'
  },
  marketing: {
    icon: <Target className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-purple-500 to-violet-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    label: 'Marketing',
    description: 'Campañas y estrategias de marketing'
  },
  system: {
    icon: <Settings className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-gray-500 to-slate-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    borderColor: 'border-gray-200 dark:border-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    label: 'Sistema',
    description: 'Actualizaciones y mantenimiento del sistema'
  },
  customer: {
    icon: <Users className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-indigo-500 to-blue-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    label: 'Clientes',
    description: 'Actividad y comportamiento de clientes'
  },
  finance: {
    icon: <DollarSign className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-yellow-500 to-orange-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    label: 'Finanzas',
    description: 'Pagos, facturas y transacciones'
  },
  inventory: {
    icon: <Database className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-teal-500 to-cyan-600',
    bgColor: 'bg-teal-50 dark:bg-teal-950',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
    label: 'Inventario',
    description: 'Stock y gestión de productos'
  },
  analytics: {
    icon: <BarChart3 className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-rose-500 to-pink-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950',
    borderColor: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-300',
    label: 'Analíticas',
    description: 'Reportes y análisis de datos'
  },
  security: {
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-gradient-to-r from-red-500 to-rose-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    label: 'Seguridad',
    description: 'Alertas de seguridad y accesos'
  }
}

// Configuración de tipos de notificación
const notificationTypes = {
  success: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900',
    label: 'Éxito'
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    label: 'Advertencia'
  },
  error: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900',
    label: 'Error'
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    label: 'Información'
  },
  opportunity: {
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900',
    label: 'Oportunidad'
  },
  urgent: {
    icon: <Zap className="h-4 w-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900',
    label: 'Urgente'
  },
  celebration: {
    icon: <Star className="h-4 w-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    label: 'Celebración'
  },
  reminder: {
    icon: <Clock className="h-4 w-4" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900',
    label: 'Recordatorio'
  }
}

// Generar notificaciones inteligentes avanzadas basadas en datos de clientes
function generateSmartNotifications(customers: Customer[]): Notification[] {
  const notifications: Notification[] = []
  const now = new Date()

  // 1. Clientes VIP inactivos con análisis predictivo
  const vipInactive = customers.filter(c => 
    c.segment === 'vip' && 
    new Date(c.last_visit) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )

  if (vipInactive.length > 0) {
    const totalLostRevenue = vipInactive.reduce((sum, c) => sum + c.avg_order_value, 0)
    notifications.push({
      id: 'vip-inactive-' + Date.now(),
      type: 'warning',
      category: 'customer',
      title: 'Clientes VIP en Riesgo de Pérdida',
      message: `${vipInactive.length} clientes VIP inactivos por más de 30 días`,
      description: `Riesgo de pérdida de ingresos: Gs ${totalLostRevenue.toLocaleString()}`,
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'high',
      actionRequired: true,
      autoArchiveAfter: 7,
      source: 'ai',
      confidence: 0.85,
      tags: ['vip', 'churn-risk', 'revenue-impact'],
      metadata: { 
        count: vipInactive.length,
        estimatedLoss: totalLostRevenue,
        avgDaysInactive: Math.round(vipInactive.reduce((sum, c) => 
          sum + (Date.now() - new Date(c.last_visit).getTime()) / (1000 * 60 * 60 * 24), 0
        ) / vipInactive.length)
      },
      actions: [
        {
          id: 'view-vip',
          label: 'Ver Clientes',
          type: 'primary',
          icon: <Eye className="h-4 w-4" />,
          onClick: () => toast.info('Mostrando clientes VIP inactivos'),
          shortcut: 'V'
        },
        {
          id: 'create-campaign',
          label: 'Campaña de Reactivación',
          type: 'secondary',
          icon: <Target className="h-4 w-4" />,
          onClick: () => toast.info('Creando campaña de reactivación personalizada'),
          shortcut: 'C'
        },
        {
          id: 'schedule-calls',
          label: 'Programar Llamadas',
          type: 'warning',
          icon: <Phone className="h-4 w-4" />,
          onClick: () => toast.info('Programando llamadas personalizadas'),
          requiresConfirmation: true,
          confirmationMessage: '¿Programar llamadas para todos los clientes VIP inactivos?'
        }
      ]
    })
  }

  // 2. Nuevos clientes registrados con análisis de calidad
  const newToday = customers.filter(c => {
    const created = new Date(c.registration_date)
    const today = new Date()
    return created.toDateString() === today.toDateString()
  })

  if (newToday.length > 0) {
    const highValueNewCustomers = newToday.filter(c => c.credit_limit > 1000000)
    notifications.push({
      id: 'new-customers-' + Date.now(),
      type: 'celebration',
      category: 'customer',
      title: '🎉 Nuevos Clientes Registrados',
      message: `${newToday.length} nuevos clientes se registraron hoy`,
      description: highValueNewCustomers.length > 0 ? 
        `${highValueNewCustomers.length} con alto potencial de valor` : 
        'Oportunidad para campañas de bienvenida personalizadas',
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'medium',
      actionRequired: false,
      autoArchiveAfter: 3,
      source: 'system',
      tags: ['new-customers', 'onboarding', 'growth'],
      metadata: { 
        count: newToday.length,
        highValueCount: highValueNewCustomers.length,
        avgCreditLimit: newToday.reduce((sum, c) => sum + c.credit_limit, 0) / newToday.length
      },
      actions: [
        {
          id: 'welcome-campaign',
          label: 'Campaña de Bienvenida',
          type: 'success',
          icon: <Mail className="h-4 w-4" />,
          onClick: () => toast.success('Enviando emails de bienvenida personalizados'),
          shortcut: 'W'
        },
        {
          id: 'assign-rep',
          label: 'Asignar Representante',
          type: 'secondary',
          icon: <UserPlus className="h-4 w-4" />,
          onClick: () => toast.info('Asignando representantes de ventas')
        },
        {
          id: 'setup-onboarding',
          label: 'Configurar Onboarding',
          type: 'primary',
          icon: <Settings className="h-4 w-4" />,
          onClick: () => toast.info('Configurando proceso de onboarding')
        }
      ]
    })
  }

  // 3. Análisis de comportamiento de compra
  const frequentBuyers = customers.filter(c => c.purchase_frequency === 'high')
  const recentBigSpenders = customers.filter(c => 
    c.last_purchase_amount > 1000000 && 
    new Date(c.last_visit) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  )

  if (recentBigSpenders.length > 0) {
    notifications.push({
      id: 'big-spenders-' + Date.now(),
      type: 'opportunity',
      category: 'sales',
      title: '💰 Clientes de Alto Valor Activos',
      message: `${recentBigSpenders.length} clientes realizaron compras grandes esta semana`,
      description: `Oportunidad para ofertas premium y productos complementarios`,
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'high',
      actionRequired: true,
      source: 'ai',
      confidence: 0.92,
      tags: ['high-value', 'upsell', 'cross-sell'],
      metadata: {
        count: recentBigSpenders.length,
        totalSpent: recentBigSpenders.reduce((sum, c) => sum + c.last_purchase_amount, 0),
        avgSpent: recentBigSpenders.reduce((sum, c) => sum + c.last_purchase_amount, 0) / recentBigSpenders.length
      },
      actions: [
        {
          id: 'create-upsell',
          label: 'Crear Oferta Premium',
          type: 'primary',
          icon: <TrendingUp className="h-4 w-4" />,
          onClick: () => toast.success('Creando ofertas premium personalizadas')
        },
        {
          id: 'loyalty-program',
          label: 'Invitar a Programa VIP',
          type: 'secondary',
          icon: <Star className="h-4 w-4" />,
          onClick: () => toast.info('Enviando invitaciones al programa VIP')
        }
      ]
    })
  }

  // 4. Clientes con alta satisfacción - Oportunidad de marketing
  const highSatisfaction = customers.filter(c => c.satisfaction_score >= 4.5)
  const superSatisfied = customers.filter(c => c.satisfaction_score >= 4.8)
  
  if (highSatisfaction.length > 10) {
    notifications.push({
      id: 'high-satisfaction-' + Date.now(),
      type: 'opportunity',
      category: 'marketing',
      title: '⭐ Oportunidad de Testimonios y Referencias',
      message: `${highSatisfaction.length} clientes altamente satisfechos disponibles`,
      description: superSatisfied.length > 0 ? 
        `${superSatisfied.length} clientes con satisfacción excepcional (≥4.8)` :
        'Ideal para campañas de testimonios y programa de referidos',
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'medium',
      actionRequired: false,
      source: 'ai',
      confidence: 0.88,
      tags: ['testimonials', 'referrals', 'satisfaction', 'marketing'],
      metadata: { 
        count: highSatisfaction.length,
        superSatisfiedCount: superSatisfied.length,
        avgSatisfaction: highSatisfaction.reduce((sum, c) => sum + c.satisfaction_score, 0) / highSatisfaction.length
      },
      actions: [
        {
          id: 'request-reviews',
          label: 'Solicitar Reseñas',
          type: 'primary',
          icon: <Star className="h-4 w-4" />,
          onClick: () => toast.info('Solicitando reseñas a clientes satisfechos'),
          shortcut: 'R'
        },
        {
          id: 'referral-program',
          label: 'Programa de Referidos',
          type: 'secondary',
          icon: <Share2 className="h-4 w-4" />,
          onClick: () => toast.info('Invitando al programa de referidos')
        },
        {
          id: 'case-studies',
          label: 'Crear Casos de Estudio',
          type: 'secondary',
          icon: <FileText className="h-4 w-4" />,
          onClick: () => toast.info('Preparando casos de estudio')
        }
      ]
    })
  }

  // 5. Gestión avanzada de saldos pendientes
  const highPendingBalance = customers.filter(c => c.pending_amount > 500000)
  const criticalPendingBalance = customers.filter(c => c.pending_amount > 2000000)
  const overdueDays = highPendingBalance.map(c => {
    // Simulamos días de atraso basado en el saldo
    return Math.floor(c.pending_amount / 100000)
  })
  
  if (highPendingBalance.length > 0) {
    const totalPending = highPendingBalance.reduce((sum, c) => sum + c.pending_amount, 0)
    const avgOverdue = overdueDays.reduce((sum, days) => sum + days, 0) / overdueDays.length
    
    notifications.push({
      id: 'pending-balance-' + Date.now(),
      type: criticalPendingBalance.length > 0 ? 'urgent' : 'warning',
      category: 'finance',
      title: '💳 Gestión de Cobranzas Requerida',
      message: `${highPendingBalance.length} clientes con saldos pendientes significativos`,
      description: `Total pendiente: Gs ${totalPending.toLocaleString()} | Promedio de atraso: ${Math.round(avgOverdue)} días`,
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: criticalPendingBalance.length > 0 ? 'critical' : 'high',
      actionRequired: true,
      escalationLevel: criticalPendingBalance.length > 0 ? 2 : 1,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'system',
      tags: ['collections', 'finance', 'overdue', 'cash-flow'],
      metadata: { 
        count: highPendingBalance.length,
        criticalCount: criticalPendingBalance.length,
        totalAmount: totalPending,
        avgOverdueDays: Math.round(avgOverdue),
        riskLevel: criticalPendingBalance.length > 0 ? 'high' : 'medium'
      },
      actions: [
        {
          id: 'send-reminders',
          label: 'Recordatorios Automáticos',
          type: 'primary',
          icon: <Bell className="h-4 w-4" />,
          onClick: () => toast.info('Enviando recordatorios de pago personalizados'),
          shortcut: 'R'
        },
        {
          id: 'schedule-calls',
          label: 'Programar Llamadas',
          type: 'warning',
          icon: <Phone className="h-4 w-4" />,
          onClick: () => toast.info('Programando llamadas de seguimiento'),
          requiresConfirmation: true,
          confirmationMessage: '¿Programar llamadas para todos los clientes con saldos pendientes?'
        },
        {
          id: 'payment-plans',
          label: 'Planes de Pago',
          type: 'secondary',
          icon: <Calendar className="h-4 w-4" />,
          onClick: () => toast.info('Creando planes de pago flexibles')
        },
        {
          id: 'credit-analysis',
          label: 'Análisis de Crédito',
          type: 'secondary',
          icon: <BarChart3 className="h-4 w-4" />,
          onClick: () => toast.info('Generando análisis de riesgo crediticio')
        }
      ]
    })
  }

  // 6. Detección de patrones de comportamiento anómalos
  const anomalousCustomers = customers.filter(c => {
    const recentActivity = new Date(c.last_visit) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const highSpending = c.last_purchase_amount > c.avg_order_value * 3
    const lowSatisfaction = c.satisfaction_score < 3
    return recentActivity && (highSpending || lowSatisfaction)
  })

  if (anomalousCustomers.length > 0) {
    notifications.push({
      id: 'anomalous-behavior-' + Date.now(),
      type: 'info',
      category: 'analytics',
      title: '🔍 Patrones de Comportamiento Detectados',
      message: `${anomalousCustomers.length} clientes muestran comportamiento inusual`,
      description: 'Análisis de IA detectó cambios significativos en patrones de compra',
      timestamp: now.toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'medium',
      actionRequired: false,
      source: 'ai',
      confidence: 0.76,
      tags: ['behavior-analysis', 'ai-insights', 'customer-intelligence'],
      metadata: {
        count: anomalousCustomers.length,
        analysisType: 'behavioral-anomaly',
        confidenceScore: 0.76
      },
      actions: [
        {
          id: 'detailed-analysis',
          label: 'Análisis Detallado',
          type: 'primary',
          icon: <Activity className="h-4 w-4" />,
          onClick: () => toast.info('Generando análisis detallado de comportamiento')
        },
        {
          id: 'create-segments',
          label: 'Crear Segmentos',
          type: 'secondary',
          icon: <PieChart className="h-4 w-4" />,
          onClick: () => toast.info('Creando segmentos basados en comportamiento')
        }
      ]
    })
  }

  // 5. Notificaciones del sistema (simuladas)
  notifications.push(
    {
      id: 'system-backup-' + Date.now(),
      type: 'info',
      category: 'system',
      title: 'Respaldo Completado',
      message: 'El respaldo automático de datos se completó exitosamente',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'low',
      actionRequired: false
    },
    {
      id: 'performance-alert-' + Date.now(),
      type: 'warning',
      category: 'system',
      title: 'Rendimiento del Sistema',
      message: 'El tiempo de respuesta promedio ha aumentado en un 15%',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isArchived: false,
      isBookmarked: false,
      isStarred: false,
      priority: 'medium',
      actionRequired: true,
      actions: [
        {
          id: 'view-metrics',
          label: 'Ver Métricas',
          type: 'primary',
          icon: <TrendingUp className="h-4 w-4" />,
          onClick: () => toast.info('Mostrando métricas de rendimiento')
        }
      ]
    }
  )

  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function NotificationCenter({ customers }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [showOnlyUnread, setShowOnlyUnread] = useState(false)
  const [showOnlyStarred, setShowOnlyStarred] = useState(false)
  const [showOnlyActionRequired, setShowOnlyActionRequired] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'timestamp' | 'priority' | 'category'>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'timeline'>('list')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 segundos
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Configuración avanzada de notificaciones
  const [notificationSettings, setNotificationSettings] = useState({
    enablePush: true,
    enableEmail: false,
    enableSounds: true,
    enableDesktop: true,
    enableInApp: true,
    soundVolume: 0.7,
    theme: 'auto' as 'light' | 'dark' | 'auto',
    compactMode: false,
    showPreviews: true,
    groupSimilar: true,
    autoArchive: true,
    autoArchiveDays: 30,
    categories: {
      sales: true,
      support: true,
      marketing: true,
      system: false,
      customer: true,
      finance: true,
      inventory: true,
      analytics: false,
      security: true
    },
    priorities: {
      low: true,
      medium: true,
      high: true,
      critical: true
    },
    types: {
      success: true,
      warning: true,
      error: true,
      info: true,
      opportunity: true,
      urgent: true,
      celebration: true,
      reminder: true
    }
  })

  // Auto-refresh de notificaciones
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        const smartNotifications = generateSmartNotifications(customers)
        setNotifications(prev => {
          // Merge new notifications with existing ones, avoiding duplicates
          const existingIds = new Set(prev.map(n => n.id))
          const newNotifications = smartNotifications.filter(n => !existingIds.has(n.id))
          return [...newNotifications, ...prev]
        })
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, customers])

  // Generar notificaciones inteligentes iniciales
  useEffect(() => {
    const smartNotifications = generateSmartNotifications(customers)
    setNotifications(smartNotifications)
  }, [customers])

  // Auto-archivo de notificaciones antiguas
  useEffect(() => {
    if (notificationSettings.autoArchive) {
      const cutoffDate = new Date(Date.now() - notificationSettings.autoArchiveDays * 24 * 60 * 60 * 1000)
      setNotifications(prev => prev.map(n => ({
        ...n,
        isArchived: n.isArchived || (new Date(n.timestamp) < cutoffDate && n.isRead)
      })))
    }
  }, [notificationSettings.autoArchive, notificationSettings.autoArchiveDays])

  // Filtrado avanzado de notificaciones
  const filteredNotifications = useMemo(() => {
    const filtered = notifications.filter(notification => {
      // Filtro por búsqueda avanzada
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesTitle = notification.title.toLowerCase().includes(searchLower)
        const matchesMessage = notification.message.toLowerCase().includes(searchLower)
        const matchesDescription = notification.description?.toLowerCase().includes(searchLower)
        const matchesTags = notification.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        const matchesCustomer = notification.relatedCustomerName?.toLowerCase().includes(searchLower)
        
        if (!matchesTitle && !matchesMessage && !matchesDescription && !matchesTags && !matchesCustomer) {
          return false
        }
      }

      // Filtros por categoría, tipo y prioridad
      if (selectedCategory !== 'all' && notification.category !== selectedCategory) return false
      if (selectedType !== 'all' && notification.type !== selectedType) return false
      if (selectedPriority !== 'all' && notification.priority !== selectedPriority) return false

      // Filtros de estado
      if (showOnlyUnread && notification.isRead) return false
      if (showOnlyStarred && !notification.isStarred) return false
      if (showOnlyActionRequired && !notification.actionRequired) return false

      // Filtros de configuración
      if (!notificationSettings.categories[notification.category]) return false
      if (!notificationSettings.priorities[notification.priority]) return false
      if (!notificationSettings.types[notification.type]) return false

      // Filtro de archivadas
      return !notification.isArchived
    })

    // Ordenamiento
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [
    notifications, 
    searchTerm, 
    selectedCategory, 
    selectedType, 
    selectedPriority,
    showOnlyUnread, 
    showOnlyStarred, 
    showOnlyActionRequired,
    notificationSettings,
    sortBy,
    sortOrder
  ])

  // Métricas avanzadas de notificaciones
  const metrics = useMemo(() => {
    const activeNotifications = notifications.filter(n => !n.isArchived)
    const unreadCount = activeNotifications.filter(n => !n.isRead).length
    const urgentCount = activeNotifications.filter(n => n.priority === 'critical' && !n.isRead).length
    const actionRequiredCount = activeNotifications.filter(n => n.actionRequired && !n.isRead).length
    const starredCount = activeNotifications.filter(n => n.isStarred).length
    const overdueCount = activeNotifications.filter(n => 
      n.dueDate && new Date(n.dueDate) < new Date() && !n.isRead
    ).length
    
    // Métricas por categoría
    const categoryMetrics = Object.keys(notificationConfig).reduce((acc, category) => {
      acc[category] = activeNotifications.filter(n => n.category === category && !n.isRead).length
      return acc
    }, {} as Record<string, number>)

    // Métricas por prioridad
    const priorityMetrics = {
      critical: activeNotifications.filter(n => n.priority === 'critical' && !n.isRead).length,
      high: activeNotifications.filter(n => n.priority === 'high' && !n.isRead).length,
      medium: activeNotifications.filter(n => n.priority === 'medium' && !n.isRead).length,
      low: activeNotifications.filter(n => n.priority === 'low' && !n.isRead).length
    }

    return { 
      unreadCount, 
      urgentCount, 
      actionRequiredCount, 
      starredCount, 
      overdueCount,
      categoryMetrics,
      priorityMetrics,
      totalActive: activeNotifications.length
    }
  }, [notifications])

  // Funciones de gestión de notificaciones
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isRead: true, completedAt: new Date().toISOString() } : n
    ))
  }, [])

  const markAsUnread = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isRead: false, completedAt: undefined } : n
    ))
  }, [])

  const toggleStar = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isStarred: !n.isStarred } : n
    ))
  }, [])

  const toggleBookmark = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isBookmarked: !n.isBookmarked } : n
    ))
  }, [])

  const snoozeNotification = useCallback((notificationId: string, hours: number) => {
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, snoozeUntil, isRead: true } : n
    ))
    toast.success(`Notificación pospuesta por ${hours} horas`)
  }, [])

  const markAllAsRead = useCallback(() => {
    const unreadCount = notifications.filter(n => !n.isRead && !n.isArchived).length
    setNotifications(prev => prev.map(n => ({ 
      ...n, 
      isRead: true, 
      completedAt: !n.isRead ? new Date().toISOString() : n.completedAt 
    })))
    toast.success(`${unreadCount} notificaciones marcadas como leídas`)
  }, [notifications])

  const archiveNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isArchived: true, isRead: true } : n
    ))
    toast.success('Notificación archivada')
  }, [])

  const archiveSelected = useCallback(() => {
    setNotifications(prev => prev.map(n => 
      selectedNotifications.includes(n.id) ? { ...n, isArchived: true, isRead: true } : n
    ))
    toast.success(`${selectedNotifications.length} notificaciones archivadas`)
    setSelectedNotifications([])
  }, [selectedNotifications])

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    toast.success('Notificación eliminada')
  }, [])

  const deleteSelected = useCallback(() => {
    setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)))
    toast.success(`${selectedNotifications.length} notificaciones eliminadas`)
    setSelectedNotifications([])
  }, [selectedNotifications])

  const clearAllRead = useCallback(() => {
    const readCount = notifications.filter(n => n.isRead && !n.isArchived).length
    setNotifications(prev => prev.filter(n => !n.isRead || n.isArchived))
    toast.success(`${readCount} notificaciones leídas eliminadas`)
  }, [notifications])

  // Gestión de selección múltiple
  const toggleSelectNotification = useCallback((notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    )
  }, [])

  const selectAllVisible = useCallback(() => {
    const visibleIds = filteredNotifications.map(n => n.id)
    setSelectedNotifications(visibleIds)
  }, [filteredNotifications])

  const clearSelection = useCallback(() => {
    setSelectedNotifications([])
  }, [])

  // Funciones de utilidad mejoradas
  const getTypeIcon = (type: Notification['type'], size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    const config = notificationTypes[type]
    return config ? React.cloneElement(config.icon, { className: `${sizeClass} ${config.color}` }) : 
           <Bell className={`${sizeClass} text-gray-500`} />
  }

  const getCategoryIcon = (category: Notification['category'], size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    const config = notificationConfig[category]
    return config ? React.cloneElement(config.icon, { className: `${sizeClass} text-white` }) : 
           <Bell className={`${sizeClass} text-white`} />
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

  const getNotificationAge = (timestamp: string) => {
    const hours = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60)
    if (hours < 1) return 'new'
    if (hours < 24) return 'recent'
    if (hours < 168) return 'week'
    return 'old'
  }

  const isOverdue = (notification: Notification) => {
    return notification.dueDate && new Date(notification.dueDate) < new Date()
  }

  const isSnoozed = (notification: Notification) => {
    return notification.snoozeUntil && new Date(notification.snoozeUntil) > new Date()
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header mejorado con métricas avanzadas */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-xl shadow-lg">
                <Bell className="h-7 w-7 text-white" />
              </div>
              {metrics.unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2"
                >
                  <Badge className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs font-bold shadow-lg">
                    {metrics.unreadCount > 99 ? '99+' : metrics.unreadCount}
                  </Badge>
                </motion.div>
              )}
              {autoRefresh && (
                <div className="absolute -bottom-1 -right-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                Centro de Notificaciones
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Sistema inteligente de alertas y notificaciones en tiempo real
              </p>
            </div>
          </div>

          {/* Métricas rápidas mejoradas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 text-sm bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border">
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">{metrics.urgentCount}</span>
                    <span className="text-gray-500">urgentes</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Notificaciones críticas que requieren atención inmediata</TooltipContent>
              </Tooltip>
              
              <Separator orientation="vertical" className="h-4" />
              
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium">{metrics.actionRequiredCount}</span>
                    <span className="text-gray-500">acciones</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Notificaciones que requieren una acción específica</TooltipContent>
              </Tooltip>
              
              <Separator orientation="vertical" className="h-4" />
              
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span className="font-medium">{metrics.starredCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Notificaciones marcadas como importantes</TooltipContent>
              </Tooltip>
            </div>

            {/* Controles principales */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={metrics.unreadCount === 0}
                    className="gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Marcar Todas</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar todas las notificaciones como leídas</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={cn("gap-2", autoRefresh && "bg-green-50 border-green-200 text-green-700")}
                  >
                    <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
                    <span className="hidden sm:inline">Auto</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {autoRefresh ? 'Desactivar actualización automática' : 'Activar actualización automática'}
                </TooltipContent>
              </Tooltip>

              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Configuración de notificaciones</TooltipContent>
                  </Tooltip>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Panel de filtros y controles avanzados */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <CardContent className="p-6">
            {/* Barra de búsqueda principal */}
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por título, mensaje, cliente o etiquetas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 h-11 text-base"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Controles de vista */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8 px-3"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 px-3"
                  >
                    <PieChart className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('timeline')}
                    className="h-8 px-3"
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Filtros avanzados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {Object.entries(notificationConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.entries(notificationTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las prioridades</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timestamp">Fecha</SelectItem>
                  <SelectItem value="priority">Prioridad</SelectItem>
                  <SelectItem value="category">Categoría</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="gap-2"
              >
                {sortOrder === 'asc' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setSelectedType('all')
                  setSelectedPriority('all')
                  setShowOnlyUnread(false)
                  setShowOnlyStarred(false)
                  setShowOnlyActionRequired(false)
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            </div>

            {/* Filtros de estado */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="unread-only"
                  checked={showOnlyUnread}
                  onCheckedChange={setShowOnlyUnread}
                />
                <Label htmlFor="unread-only" className="text-sm font-medium">Solo no leídas</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="starred-only"
                  checked={showOnlyStarred}
                  onCheckedChange={setShowOnlyStarred}
                />
                <Label htmlFor="starred-only" className="text-sm font-medium">Solo favoritas</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="action-required"
                  checked={showOnlyActionRequired}
                  onCheckedChange={setShowOnlyActionRequired}
                />
                <Label htmlFor="action-required" className="text-sm font-medium">Requieren acción</Label>
              </div>

              {/* Selección múltiple */}
              {selectedNotifications.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {selectedNotifications.length} seleccionadas
                  </Badge>
                  <Button size="sm" variant="outline" onClick={archiveSelected} className="gap-1">
                    <Archive className="h-3 w-3" />
                    Archivar
                  </Button>
                  <Button size="sm" variant="outline" onClick={deleteSelected} className="gap-1">
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Estadísticas de filtros */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {filteredNotifications.length} de {metrics.totalActive} notificaciones activas
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllVisible}
                  disabled={filteredNotifications.length === 0}
                  className="text-xs"
                >
                  Seleccionar todas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllRead}
                  disabled={notifications.filter(n => n.isRead && !n.isArchived).length === 0}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Limpiar leídas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de notificaciones mejorada */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredNotifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="relative mb-6">
                      <div className="p-4 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full">
                        <Bell className="h-12 w-12 text-blue-500 dark:text-blue-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {searchTerm || selectedCategory !== 'all' || showOnlyUnread || showOnlyStarred || showOnlyActionRequired
                        ? 'No se encontraron notificaciones'
                        : '¡Todo al día!'}
                    </h3>
                    
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                      {searchTerm || selectedCategory !== 'all' || showOnlyUnread || showOnlyStarred || showOnlyActionRequired
                        ? 'Intenta ajustar los filtros para ver más notificaciones'
                        : 'No hay notificaciones pendientes. Te mantendremos informado cuando haya algo nuevo.'}
                    </p>

                    {(searchTerm || selectedCategory !== 'all' || showOnlyUnread || showOnlyStarred || showOnlyActionRequired) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm('')
                          setSelectedCategory('all')
                          setSelectedType('all')
                          setSelectedPriority('all')
                          setShowOnlyUnread(false)
                          setShowOnlyStarred(false)
                          setShowOnlyActionRequired(false)
                        }}
                        className="mt-4 gap-2"
                      >
                        <X className="h-4 w-4" />
                        Limpiar filtros
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
              )}>
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    isSelected={selectedNotifications.includes(notification.id)}
                    onToggleSelect={toggleSelectNotification}
                    onMarkAsRead={markAsRead}
                    onMarkAsUnread={markAsUnread}
                    onToggleStar={toggleStar}
                    onToggleBookmark={toggleBookmark}
                    onArchive={archiveNotification}
                    onDelete={deleteNotification}
                    onSnooze={snoozeNotification}
                    viewMode={viewMode}
                    compact={notificationSettings.compactMode}
                    showSelection={selectedNotifications.length > 0 || filteredNotifications.length > 5}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Paginación si hay muchas notificaciones */}
          {filteredNotifications.length > 20 && (
            <div className="flex justify-center pt-6">
              <div className="text-sm text-gray-500">
                Mostrando las primeras 20 notificaciones. Usa los filtros para refinar los resultados.
              </div>
            </div>
          )}
        </div>

        {/* Diálogo de configuración avanzada */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración Avanzada de Notificaciones
              </DialogTitle>
              <DialogDescription>
                Personaliza cómo y cuándo recibes notificaciones del sistema
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="categories">Categorías</TabsTrigger>
                <TabsTrigger value="advanced">Avanzado</TabsTrigger>
                <TabsTrigger value="rules">Reglas</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Preferencias Generales
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="enable-push" className="font-medium">Notificaciones Push</Label>
                        <p className="text-sm text-gray-500">Recibir notificaciones en tiempo real</p>
                      </div>
                      <Switch
                        id="enable-push"
                        checked={notificationSettings.enablePush}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, enablePush: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="enable-email" className="font-medium">Notificaciones por Email</Label>
                        <p className="text-sm text-gray-500">Resumen diario por correo</p>
                      </div>
                      <Switch
                        id="enable-email"
                        checked={notificationSettings.enableEmail}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, enableEmail: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="enable-sounds" className="font-medium">Sonidos</Label>
                        <p className="text-sm text-gray-500">Alertas sonoras</p>
                      </div>
                      <Switch
                        id="enable-sounds"
                        checked={notificationSettings.enableSounds}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, enableSounds: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="enable-desktop" className="font-medium">Notificaciones de Escritorio</Label>
                        <p className="text-sm text-gray-500">Mostrar en el sistema operativo</p>
                      </div>
                      <Switch
                        id="enable-desktop"
                        checked={notificationSettings.enableDesktop}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, enableDesktop: checked }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Volumen de Sonido</Label>
                    <div className="flex items-center gap-3">
                      <VolumeX className="h-4 w-4" />
                      <div className="flex-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={notificationSettings.soundVolume}
                          onChange={(e) => 
                            setNotificationSettings(prev => ({ 
                              ...prev, 
                              soundVolume: parseFloat(e.target.value) 
                            }))
                          }
                          className="w-full"
                        />
                      </div>
                      <Volume2 className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Intervalo de Actualización Automática</Label>
                    <Select 
                      value={refreshInterval.toString()} 
                      onValueChange={(value) => setRefreshInterval(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10000">10 segundos</SelectItem>
                        <SelectItem value="30000">30 segundos</SelectItem>
                        <SelectItem value="60000">1 minuto</SelectItem>
                        <SelectItem value="300000">5 minutos</SelectItem>
                        <SelectItem value="600000">10 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="categories" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Categorías de Notificaciones
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(notificationConfig).map(([key, config]) => (
                      <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", config.color)}>
                            {config.icon}
                          </div>
                          <div>
                            <Label className="font-medium">{config.label}</Label>
                            <p className="text-sm text-gray-500">{config.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationSettings.categories[key as keyof typeof notificationSettings.categories]}
                          onCheckedChange={(checked) => 
                            setNotificationSettings(prev => ({
                              ...prev,
                              categories: { ...prev.categories, [key]: checked }
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Configuración Avanzada
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="compact-mode" className="font-medium">Modo Compacto</Label>
                        <p className="text-sm text-gray-500">Interfaz más densa</p>
                      </div>
                      <Switch
                        id="compact-mode"
                        checked={notificationSettings.compactMode}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, compactMode: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="show-previews" className="font-medium">Mostrar Vistas Previas</Label>
                        <p className="text-sm text-gray-500">Contenido completo en notificaciones</p>
                      </div>
                      <Switch
                        id="show-previews"
                        checked={notificationSettings.showPreviews}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, showPreviews: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="group-similar" className="font-medium">Agrupar Similares</Label>
                        <p className="text-sm text-gray-500">Combinar notificaciones relacionadas</p>
                      </div>
                      <Switch
                        id="group-similar"
                        checked={notificationSettings.groupSimilar}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, groupSimilar: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label htmlFor="auto-archive" className="font-medium">Auto-Archivo</Label>
                        <p className="text-sm text-gray-500">Archivar automáticamente notificaciones antiguas</p>
                      </div>
                      <Switch
                        id="auto-archive"
                        checked={notificationSettings.autoArchive}
                        onCheckedChange={(checked) => 
                          setNotificationSettings(prev => ({ ...prev, autoArchive: checked }))
                        }
                      />
                    </div>
                  </div>

                  {notificationSettings.autoArchive && (
                    <div className="space-y-3">
                      <Label>Días para Auto-Archivo</Label>
                      <Select 
                        value={notificationSettings.autoArchiveDays.toString()} 
                        onValueChange={(value) => 
                          setNotificationSettings(prev => ({ 
                            ...prev, 
                            autoArchiveDays: parseInt(value) 
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 días</SelectItem>
                          <SelectItem value="14">14 días</SelectItem>
                          <SelectItem value="30">30 días</SelectItem>
                          <SelectItem value="60">60 días</SelectItem>
                          <SelectItem value="90">90 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="rules" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Reglas de Notificación
                    </h4>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Nueva Regla
                    </Button>
                  </div>
                  
                  <div className="text-center py-8 text-gray-500">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Las reglas personalizadas estarán disponibles próximamente</p>
                    <p className="text-sm">Podrás crear reglas automáticas basadas en condiciones específicas</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  // Reset to defaults
                  setNotificationSettings({
                    enablePush: true,
                    enableEmail: false,
                    enableSounds: true,
                    enableDesktop: true,
                    enableInApp: true,
                    soundVolume: 0.7,
                    theme: 'auto',
                    compactMode: false,
                    showPreviews: true,
                    groupSimilar: true,
                    autoArchive: true,
                    autoArchiveDays: 30,
                    categories: {
                      sales: true,
                      support: true,
                      marketing: true,
                      system: false,
                      customer: true,
                      finance: true,
                      inventory: true,
                      analytics: false,
                      security: true
                    },
                    priorities: {
                      low: true,
                      medium: true,
                      high: true,
                      critical: true
                    },
                    types: {
                      success: true,
                      warning: true,
                      error: true,
                      info: true,
                      opportunity: true,
                      urgent: true,
                      celebration: true,
                      reminder: true
                    }
                  })
                  toast.success('Configuración restaurada a valores por defecto')
                }}
              >
                Restaurar Defaults
              </Button>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  setShowSettings(false)
                  toast.success('Configuración guardada exitosamente')
                }}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}