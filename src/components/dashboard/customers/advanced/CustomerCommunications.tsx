'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Calendar,
  Clock,
  Users,
  Target,
  Zap,
  Bell,
  Settings,
  Plus,
  Filter,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Customer } from '@/hooks/use-customer-state'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface CustomerCommunicationsProps {
  customers: Customer[]
}

interface CommunicationTemplate {
  id: string
  name: string
  subject: string
  content: string
  type: 'email' | 'sms' | 'whatsapp'
  category: 'marketing' | 'service' | 'notification' | 'reminder'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Campaign {
  id: string
  name: string
  description: string
  templateId: string
  targetSegment: string
  scheduledAt: string | null
  sentAt: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  recipientCount: number
  sentCount: number
  openRate: number
  clickRate: number
  createdAt: string
}

interface CommunicationHistory {
  id: string
  customerId: string
  customerName: string
  type: 'email' | 'sms' | 'whatsapp' | 'call'
  subject: string
  content: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  sentAt: string
  readAt?: string
}

export function CustomerCommunications({ customers }: CustomerCommunicationsProps) {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Templates predefinidos
  const templates: CommunicationTemplate[] = [
    {
      id: '1',
      name: 'Bienvenida Nuevos Clientes',
      subject: '¡Bienvenido a nuestra familia!',
      content: 'Hola {nombre}, gracias por confiar en nosotros. Estamos aquí para ayudarte en todo lo que necesites.',
      type: 'email',
      category: 'service',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Recordatorio de Pago',
      subject: 'Recordatorio: Cuota pendiente',
      content: 'Hola {nombre}, te recordamos que tienes una cuota pendiente por {monto}. Puedes pagarla en nuestras oficinas.',
      type: 'sms',
      category: 'reminder',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Promoción Especial',
      subject: '🎉 Oferta especial solo para ti',
      content: 'Hola {nombre}, tenemos una promoción especial en productos seleccionados. ¡No te la pierdas!',
      type: 'whatsapp',
      category: 'marketing',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Reparación Lista',
      subject: 'Tu dispositivo está listo',
      content: 'Hola {nombre}, tu {dispositivo} ya está reparado y listo para recoger. Horario: Lun-Vie 8-18hs.',
      type: 'sms',
      category: 'notification',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]

  // Campañas de ejemplo
  const campaigns: Campaign[] = [
    {
      id: '1',
      name: 'Campaña de Bienvenida Q4',
      description: 'Campaña automática para nuevos clientes del último trimestre',
      templateId: '1',
      targetSegment: 'new',
      scheduledAt: null,
      sentAt: new Date().toISOString(),
      status: 'sent',
      recipientCount: 45,
      sentCount: 45,
      openRate: 78.5,
      clickRate: 12.3,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Recordatorios de Pago Diciembre',
      description: 'Recordatorios automáticos para clientes con cuotas vencidas',
      templateId: '2',
      targetSegment: 'overdue',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sentAt: null,
      status: 'scheduled',
      recipientCount: 23,
      sentCount: 0,
      openRate: 0,
      clickRate: 0,
      createdAt: new Date().toISOString()
    }
  ]

  // Historial de comunicaciones
  const communicationHistory: CommunicationHistory[] = [
    {
      id: '1',
      customerId: 'cust1',
      customerName: 'Juan Pérez',
      type: 'email',
      subject: 'Bienvenida',
      content: 'Email de bienvenida enviado',
      status: 'read',
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      readAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      customerId: 'cust2',
      customerName: 'María González',
      type: 'sms',
      subject: 'Recordatorio de pago',
      content: 'SMS de recordatorio enviado',
      status: 'delivered',
      sentAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      customerId: 'cust3',
      customerName: 'Carlos López',
      type: 'whatsapp',
      subject: 'Promoción especial',
      content: 'Mensaje de WhatsApp enviado',
      status: 'sent',
      sentAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    }
  ]

  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length
    const activeCampaigns = campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length
    const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
    const avgOpenRate = campaigns.length > 0 
      ? campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length 
      : 0

    return {
      totalCampaigns,
      activeCampaigns,
      totalSent,
      avgOpenRate,
      totalTemplates: templates.length,
      activeTemplates: templates.filter(t => t.isActive).length
    }
  }, [campaigns, templates])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'read':
        return <Eye className="h-4 w-4 text-blue-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'scheduled':
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-600" />
      case 'call':
        return <Phone className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const sendCampaign = (campaignId: string) => {
    toast.info('Enviando campaña...', {
      description: 'Los mensajes se están enviando a los destinatarios'
    })
    
    setTimeout(() => {
      toast.success('Campaña enviada exitosamente', {
        description: 'Todos los mensajes han sido enviados'
      })
    }, 2000)
  }

  const TemplateCard = ({ template }: { template: CommunicationTemplate }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(template.type)}
            <CardTitle className="text-base">{template.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={template.isActive ? 'default' : 'secondary'}>
              {template.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium text-sm">{template.subject}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{template.content}</p>
        </div>
        
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
          <div className="flex gap-1">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const CampaignCard = ({ campaign }: { campaign: Campaign }) => {
    const template = templates.find(t => t.id === campaign.templateId)
    
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge variant={
              campaign.status === 'sent' ? 'default' :
              campaign.status === 'scheduled' ? 'secondary' :
              campaign.status === 'sending' ? 'outline' :
              campaign.status === 'failed' ? 'destructive' : 'outline'
            }>
              {campaign.status === 'sent' ? 'Enviada' :
               campaign.status === 'scheduled' ? 'Programada' :
               campaign.status === 'sending' ? 'Enviando' :
               campaign.status === 'failed' ? 'Fallida' : 'Borrador'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{campaign.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Destinatarios</p>
              <p className="font-semibold">{campaign.recipientCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enviados</p>
              <p className="font-semibold">{campaign.sentCount}</p>
            </div>
          </div>

          {campaign.status === 'sent' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Apertura</p>
                <p className="font-semibold text-green-600">{campaign.openRate}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Clic</p>
                <p className="font-semibold text-blue-600">{campaign.clickRate}%</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {campaign.status === 'scheduled' && (
              <Button size="sm" onClick={() => sendCampaign(campaign.id)}>
                <Send className="h-4 w-4 mr-1" />
                Enviar Ahora
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Ver Detalles
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Comunicaciones con Clientes
          </h2>
          <p className="text-muted-foreground">
            Gestiona campañas, templates y comunicaciones automatizadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar Contactos
          </Button>
          <Button onClick={() => setIsCreatingCampaign(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Campañas Totales</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalCampaigns}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Campañas Activas</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeCampaigns}</p>
              </div>
              <Zap className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Mensajes Enviados</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalSent}</p>
              </div>
              <Send className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Tasa de Apertura</p>
                <p className="text-2xl font-bold text-orange-900">{stats.avgOpenRate.toFixed(1)}%</p>
              </div>
              <Eye className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-700">Templates</p>
                <p className="text-2xl font-bold text-pink-900">{stats.totalTemplates}</p>
              </div>
              <Mail className="h-8 w-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700">Templates Activos</p>
                <p className="text-2xl font-bold text-cyan-900">{stats.activeTemplates}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Campañas
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automatización
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar campañas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sent">Enviadas</SelectItem>
                <SelectItem value="scheduled">Programadas</SelectItem>
                <SelectItem value="draft">Borradores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                className="pl-10"
              />
            </div>
            <Button onClick={() => setIsCreatingTemplate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Template
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Comunicaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {communicationHistory.map(comm => (
                  <div key={comm.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {comm.customerName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{comm.customerName}</p>
                        <p className="text-sm text-muted-foreground">{comm.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(comm.type)}
                        <span className="text-sm capitalize">{comm.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(comm.status)}
                        <span className="text-sm capitalize">{comm.status}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(comm.sentAt), 'dd/MM HH:mm', { locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Automatización de Comunicaciones</h3>
            <p className="text-muted-foreground mb-4">
              Configura reglas automáticas para enviar mensajes basados en eventos
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Crear Automatización
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}