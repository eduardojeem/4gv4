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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { useCustomerCommunications } from '@/hooks/use-customer-communications'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface CustomerCommunicationsProps {
  customers: Customer[]
}

interface CommunicationTemplate {
  id: string
  name: string
  subject: string
  content: string
  type: string
  category: string
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
  status: string
  recipientCount: number
  sentCount: number
  createdAt: string
}

interface CommunicationHistory {
  id: string
  customerId: string | null
  customerName: string
  type: string
  subject: string
  status: string
  sentAt: string
  toEmail?: string
}

export function CustomerCommunications({ customers }: CustomerCommunicationsProps) {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Datos reales persistidos (plantillas, campañas, historial de envíos)
  const {
    templates,
    campaigns,
    history: communicationHistory,
    sendCampaign: sendCampaignApi,
    createTemplate,
    createCampaign,
  } = useCustomerCommunications()

  // Formularios de creación
  const [tplForm, setTplForm] = useState({ name: '', subject: '', content: '', category: 'marketing' })
  const [campForm, setCampForm] = useState({ name: '', description: '', templateId: '' })

  const submitTemplate = async () => {
    if (!tplForm.name.trim()) {
      toast.error('El nombre de la plantilla es obligatorio')
      return
    }
    const created = await createTemplate(tplForm)
    if (created) {
      setTplForm({ name: '', subject: '', content: '', category: 'marketing' })
      setIsCreatingTemplate(false)
    }
  }

  const submitCampaign = async () => {
    if (!campForm.name.trim()) {
      toast.error('El nombre de la campaña es obligatorio')
      return
    }
    const created = await createCampaign({ ...campForm, status: 'draft' })
    if (created) {
      setCampForm({ name: '', description: '', templateId: '' })
      setIsCreatingCampaign(false)
    }
  }

  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length
    const activeCampaigns = campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length
    const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0)
    const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)
    const deliveryRate = totalRecipients > 0 ? (totalSent / totalRecipients) * 100 : 0

    return {
      totalCampaigns,
      activeCampaigns,
      totalSent,
      deliveryRate,
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

  // Envío real: resuelve los clientes con email válido y confirma antes de enviar.
  const sendCampaign = async (campaignId: string) => {
    const recipients = customers
      .filter(c => c.email && EMAIL_RE.test(c.email))
      .map(c => ({ id: c.id, name: c.name, email: c.email }))

    if (recipients.length === 0) {
      toast.error('No hay clientes con email válido para esta campaña')
      return
    }

    const ok = window.confirm(
      `Se enviará un email real a ${recipients.length} cliente(s) con email registrado. ¿Continuar?`,
    )
    if (!ok) return

    await sendCampaignApi(campaignId, recipients)
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

          {campaign.status === 'sent' && campaign.sentAt && (
            <p className="text-xs text-muted-foreground">
              Enviada el {format(new Date(campaign.sentAt), "d 'de' MMM, HH:mm", { locale: es })}
            </p>
          )}

          <div className="flex gap-2">
            {(campaign.status === 'scheduled' || campaign.status === 'draft') && (
              <Button size="sm" onClick={() => sendCampaign(campaign.id)}>
                <Send className="h-4 w-4 mr-1" />
                Enviar Ahora
              </Button>
            )}
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
          <Button variant="outline" onClick={() => setIsCreatingTemplate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Plantilla
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
                <p className="text-sm font-medium text-orange-700">Tasa de Entrega</p>
                <p className="text-2xl font-bold text-orange-900">{stats.deliveryRate.toFixed(1)}%</p>
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

      {/* Diálogo: Nueva Plantilla */}
      <Dialog open={isCreatingTemplate} onOpenChange={setIsCreatingTemplate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Plantilla de Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={tplForm.name}
                onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
                placeholder="Ej: Bienvenida nuevos clientes"
              />
            </div>
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input
                value={tplForm.subject}
                onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })}
                placeholder="Ej: ¡Bienvenido a {nombre}!"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenido</Label>
              <Textarea
                value={tplForm.content}
                onChange={(e) => setTplForm({ ...tplForm, content: e.target.value })}
                placeholder="Hola {nombre}, gracias por confiar en nosotros..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Usá <code>{'{nombre}'}</code> para personalizar con el nombre del cliente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={tplForm.category} onValueChange={(v) => setTplForm({ ...tplForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="notification">Notificación</SelectItem>
                  <SelectItem value="reminder">Recordatorio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingTemplate(false)}>Cancelar</Button>
            <Button onClick={submitTemplate}>Crear Plantilla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Nueva Campaña */}
      <Dialog open={isCreatingCampaign} onOpenChange={setIsCreatingCampaign}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Campaña de Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={campForm.name}
                onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                placeholder="Ej: Promoción de fin de mes"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={campForm.description}
                onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                placeholder="Breve descripción de la campaña"
              />
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              <Select value={campForm.templateId} onValueChange={(v) => setCampForm({ ...campForm, templateId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={templates.length ? 'Elegí una plantilla' : 'Creá una plantilla primero'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Al enviar, la campaña irá a todos los clientes con email registrado (te pediremos confirmación).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingCampaign(false)}>Cancelar</Button>
            <Button onClick={submitCampaign}>Crear Campaña</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}