import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  User, Phone, Mail, MapPin, Calendar, Wrench, 
  Smartphone, Tablet, Laptop, Monitor, AlertCircle, 
  DollarSign, Clock, FileText, Image as ImageIcon,
  Edit, Trash, Printer, Package as PackageIcon, CheckCircle,
  Maximize2, Minimize2, Share2, MessageCircle, Copy, Shield
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { toast } from 'sonner'
import { Repair } from '@/types/repairs'
import { statusConfig, priorityConfig, urgencyConfig, deviceTypeConfig } from '@/config/repair-constants'
import { cn } from '@/lib/utils'
import { PatternDrawer } from './PatternDrawer'
import { printRepairReceipt, generateRepairShareText, RepairPrintPayload } from '@/lib/repair-receipt'
import { 
  getWarrantyStatus, 
  getDaysRemaining, 
  getWarrantyStatusColor,
  getWarrantyTypeLabel,
  formatWarrantyDuration,
  formatWarrantyExpiration 
} from '@/lib/warranty-utils'
import { useSharedSettings } from '@/hooks/use-shared-settings'

interface RepairDetailDialogProps {
  open: boolean
  repair: Repair | null
  onClose: () => void
  onEdit?: (repair: Repair) => void
}

export function RepairDetailDialog({
  open,
  repair,
  onClose,
  onEdit
}: RepairDetailDialogProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const { settings } = useSharedSettings()

  if (!repair) return null

  const StatusIcon = statusConfig[repair.status]?.icon || AlertCircle
  const DeviceIcon = deviceTypeConfig[repair.deviceType]?.icon || Smartphone

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Pendiente'
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy - h:mm a", { locale: es })
    } catch (e) {
      return 'Fecha inválida'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  const getPrintPayload = (): RepairPrintPayload => {
    if (!repair) throw new Error("No repair")
    return {
      ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase(),
      date: new Date(repair.createdAt),
      priority: repair.priority,
      urgency: repair.urgency,
      customer: {
        name: repair.customer.name,
        customerCode: repair.customer.customerCode,
        phone: repair.customer.phone,
        email: repair.customer.email,
        address: (repair.customer as any).address,
        city: (repair.customer as any).city,
        country: (repair.customer as any).country,
        document: (repair.customer as any).document,
      },
      devices: [{
        typeLabel: deviceTypeConfig[repair.deviceType]?.label || repair.deviceType,
        brand: repair.brand,
        model: repair.model,
        issue: repair.issue,
        description: repair.description,
        technician: repair.technician?.name || 'Sin asignar',
        estimatedCost: repair.estimatedCost,
        ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()
      }],
      company: {
        name: settings.companyName,
        phone: settings.companyPhone,
        address: settings.companyAddress,
        email: settings.companyEmail,
      }
    }
  }

  const handlePrint = (type: 'customer' | 'technician') => {
    if (!repair) return
    const payload = getPrintPayload()
    printRepairReceipt(type, payload)
  }

  const handleShare = async (method: 'whatsapp' | 'copy' | 'native' | 'whatsapp-pdf') => {
    if (!repair) return
    const payload = getPrintPayload()
    const shareText = generateRepairShareText(payload)

    if (method === 'whatsapp') {
      const encodedText = encodeURIComponent(shareText)
      const url = `https://wa.me/?text=${encodedText}`
      window.open(url, '_blank')
    } else if (method === 'whatsapp-pdf') {
       // Opción para abrir el diálogo de impresión directamente, 
       // sugiriendo al usuario guardar como PDF y enviarlo
       // Ya que compartir archivos directamente a WhatsApp Web no es posible vía API
       // y Web Share API tiene soporte limitado en escritorio.
       toast.info('Se abrirá la vista de impresión. Guarda como PDF y envíalo por WhatsApp.')
       setTimeout(() => {
          handlePrint('customer')
       }, 1500)
    } else if (method === 'copy') {
      navigator.clipboard.writeText(shareText)
      toast.success('Texto copiado al portapapeles')
    } else if (method === 'native') {
      if (navigator.share) {
        navigator.share({
          title: `Reparación ${payload.ticketNumber}`,
          text: shareText,
        }).catch(console.error)
      } else {
        toast.error('Tu dispositivo no soporta compartir nativo')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-300",
        isMaximized 
          ? "w-[98vw] max-w-[98vw] h-[98vh]" 
          : "max-w-6xl h-[90vh]"
      )}>
        <DialogHeader className="p-6 pb-2 bg-muted/20 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">
                  {repair.ticketNumber || `ID: ${repair.id.slice(0, 8)}`}
                </Badge>
                <Badge className={cn(priorityConfig[repair.priority].color)}>
                  Prioridad {priorityConfig[repair.priority].label}
                </Badge>
                {repair.urgency === 'urgent' && (
                  <Badge className={cn(urgencyConfig[repair.urgency].color)}>
                    {urgencyConfig[repair.urgency].label}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <DeviceIcon className="h-6 w-6 text-muted-foreground" />
                {repair.device}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 text-sm">
                <StatusIcon className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {statusConfig[repair.status]?.label || repair.status}
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{repair.brand} {repair.model}</span>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Imprimir" className="hidden sm:flex">
                    <Printer className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePrint('customer')}>
                    Comprobante Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint('technician')}>
                    Ficha Técnica
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restaurar tamaño" : "Maximizar"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(repair)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <span className="sr-only">Cerrar</span>
                {/* Close icon is handled by DialogContent default but we can add custom if needed */}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <div className="border-b bg-muted/20">
            <ScrollArea className="w-full">
              <div className="px-6 pt-2">
                <TabsList className="bg-transparent h-auto p-0 gap-6">
                  <TabsTrigger 
                    value="info" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
                  >
                    Información
                  </TabsTrigger>
                  <TabsTrigger 
                    value="diagnostic" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
                  >
                    Diagnóstico
                  </TabsTrigger>
                  <TabsTrigger 
                    value="finance" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
                  >
                    Costos y Piezas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="history" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
                  >
                    Historial y Notas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="images" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1"
                  >
                    Imágenes ({repair.images?.length || 0})
                  </TabsTrigger>
                </TabsList>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <ScrollArea className="flex-1 bg-background w-full">
            <ScrollBar orientation="horizontal" />
            <div className="p-6 min-w-full">
              {/* Información General */}
              <TabsContent value="info" className="mt-0 space-y-6">
                {/* Mensaje de Estado de Pago */}
                {repair.status === 'listo' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-400">Equipo Listo para Entrega</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-500/90 mt-1">
                          El equipo está listo. Para entregarlo, debe procesar el pago desde el módulo de <strong>Punto de Venta (POS)</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Información del Cliente
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3 border">
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="font-medium">{repair.customer.name}</p>
                          <p className="text-xs text-muted-foreground">Cliente Registrado</p>
                        </div>
                      </div>
                      {repair.customer.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{repair.customer.phone}</p>
                        </div>
                      )}
                      {repair.customer.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{repair.customer.email}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fechas y Técnico */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Detalles del Servicio
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3 border">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Recibido:
                        </span>
                        <span className="font-medium">{formatDate(repair.createdAt)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Estimado:
                        </span>
                        <span className="font-medium">{formatDate(repair.estimatedCompletion)}</span>
                      </div>
                      {repair.completedAt && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" /> Completado:
                          </span>
                          <span className="font-medium text-green-600">{formatDate(repair.completedAt)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex items-center gap-3 pt-1">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Técnico Asignado</p>
                          <p className="text-sm text-muted-foreground">
                            {repair.technician?.name || 'Sin asignar'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Costo Final - Destacado */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-6 rounded-xl shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-white" />
                        <span className="text-white/90 text-sm font-medium uppercase tracking-wide">
                          Costo de la Reparación
                        </span>
                        {repair.status === 'entregado' && (
                           <Badge variant="secondary" className="bg-white/90 text-emerald-700 hover:bg-white font-bold ml-2">
                              PAGADO Y ENTREGADO
                           </Badge>
                        )}
                        {repair.status === 'listo' && (
                           <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400 font-bold ml-2 border-none">
                              PENDIENTE DE PAGO
                           </Badge>
                        )}
                        {repair.paymentStatus === 'parcial' && repair.status !== 'entregado' && (
                           <Badge variant="secondary" className="bg-blue-400 text-blue-900 hover:bg-blue-400 font-bold ml-2 border-none">
                              PAGO PARCIAL
                           </Badge>
                        )}
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-bold text-white text-4xl">
                          {repair.finalCost !== null && repair.finalCost !== undefined 
                            ? formatCurrency(repair.finalCost) 
                            : formatCurrency(repair.estimatedCost || 0)
                          }
                        </span>
                        {repair.finalCost !== null && repair.finalCost !== undefined && repair.finalCost !== repair.estimatedCost && (
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                            {repair.finalCost > repair.estimatedCost ? '↑' : '↓'} Ajustado
                          </Badge>
                        )}
                      </div>
                      {/* Información detallada del pago */}
                      {repair.paymentStatus === 'parcial' && repair.paidAmount !== undefined && repair.paidAmount > 0 && (
                        <div className="mt-2 text-white/90 text-sm">
                          <div className="flex justify-between border-b border-white/20 pb-1 mb-1">
                            <span>Pagado:</span>
                            <span className="font-semibold">{formatCurrency(repair.paidAmount)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-white">
                            <span>Restante:</span>
                            <span>{formatCurrency((repair.finalCost || repair.estimatedCost || 0) - repair.paidAmount)}</span>
                          </div>
                        </div>
                      )}
                      
                      {repair.finalCost === null || repair.finalCost === undefined ? (
                        <p className="text-white/80 text-xs">
                          * Costo estimado - El costo final será determinado al completar el diagnóstico
                        </p>
                      ) : (
                        <div className="flex items-center gap-4 text-white/90 text-sm mt-2">
                          <div className="flex items-center gap-1">
                            <span className="text-white/70">Mano de obra:</span>
                            <span className="font-semibold">{formatCurrency(repair.laborCost || 0)}</span>
                          </div>
                          <span className="text-white/50">•</span>
                          <div className="flex items-center gap-1">
                            <span className="text-white/70">Piezas:</span>
                            <span className="font-semibold">
                              {formatCurrency(
                                (repair.parts || []).reduce((acc, part) => acc + (part.cost * part.quantity), 0)
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                      <DollarSign className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Garantía */}
                {repair.warrantyMonths && repair.warrantyMonths > 0 ? (
                  <div className={cn(
                    "relative overflow-hidden rounded-2xl shadow-xl border-2 transition-all duration-300 hover:shadow-2xl",
                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).bg,
                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).border
                  )}>
                    {/* Decorative gradient bar */}
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1.5",
                      getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).gradient
                    )} />
                    
                    <div className="p-6 pt-8">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-4 flex-1">
                          {/* Header */}
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl shadow-md",
                              getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).badge
                            )}>
                              <Shield className={cn(
                                "h-5 w-5",
                                getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).icon
                              )} />
                            </div>
                            <div>
                              <h3 className={cn(
                                "text-lg font-bold tracking-tight",
                                getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                              )}>
                                Garantía de Reparación
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired' 
                                  ? 'Esta garantía ha expirado'
                                  : getWarrantyStatus(repair.warrantyExpiresAt) === 'expiring'
                                  ? 'La garantía está por vencer'
                                  : 'Garantía activa y vigente'
                                }
                              </p>
                            </div>
                          </div>
                          
                          {/* Info Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/20 dark:border-white/10">
                              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Duración</p>
                              <p className={cn(
                                "font-bold text-xl",
                                getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                              )}>
                                {formatWarrantyDuration(repair.warrantyMonths)}
                              </p>
                            </div>
                            
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/20 dark:border-white/10">
                              <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Cobertura</p>
                              <p className={cn(
                                "font-bold text-xl",
                                getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                              )}>
                                {getWarrantyTypeLabel(repair.warrantyType || 'full').split(' ')[0]}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {repair.warrantyType === 'labor' && 'Mano de obra'}
                                {repair.warrantyType === 'parts' && 'Repuestos'}
                                {repair.warrantyType === 'full' && 'Total'}
                              </p>
                            </div>
                            
                            {repair.warrantyExpiresAt && (
                              <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/20 dark:border-white/10">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                                  {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired' ? 'Venció' : 'Vence'}
                                </p>
                                <p className={cn(
                                  "font-bold text-xl",
                                  getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                                )}>
                                  {formatWarrantyExpiration(repair.warrantyExpiresAt).split(' de ')[0]}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatWarrantyExpiration(repair.warrantyExpiresAt).split(' de ').slice(1).join(' de ')}
                                </p>
                                {getWarrantyStatus(repair.warrantyExpiresAt) !== 'expired' && (
                                  <div className={cn(
                                    "mt-2 px-2 py-1 rounded-md text-xs font-semibold inline-block",
                                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).badge
                                  )}>
                                    {getDaysRemaining(repair.warrantyExpiresAt)} días restantes
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Fecha de retiro del equipo */}
                          {repair.pickedUpAt && (
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/20 dark:border-white/10">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).badge
                                )}>
                                  <Calendar className={cn(
                                    "h-4 w-4",
                                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).icon
                                  )} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Equipo retirado</p>
                                  <p className={cn(
                                    "text-sm font-semibold mt-1",
                                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                                  )}>
                                    {formatDate(repair.pickedUpAt)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    La garantía comenzó desde esta fecha
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Warranty Notes */}
                          {repair.warrantyNotes && (
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/20 dark:border-white/10">
                              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Notas Adicionales</p>
                              <p className={cn(
                                "text-sm leading-relaxed",
                                getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                              )}>
                                {repair.warrantyNotes}
                              </p>
                            </div>
                          )}

                          {/* Footer Message */}
                          <div className={cn(
                            "rounded-xl p-4 border-2 border-dashed",
                            getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).border,
                            "bg-white/30 dark:bg-black/10"
                          )}>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired' 
                                ? '⚠️ La garantía ha expirado. Contacte al taller para más información sobre extensiones o nuevas reparaciones.'
                                : getWarrantyStatus(repair.warrantyExpiresAt) === 'expiring'
                                ? '⚠️ La garantía está por vencer. Conserve su comprobante y verifique el estado de su equipo antes de que expire.'
                                : '✓ Garantía activa. Conserve este comprobante para hacer válida la garantía en caso de ser necesario.'
                              }
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-center gap-2">
                          <div className={cn(
                            "w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg",
                            getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).gradient,
                            "ring-4 ring-white/50 dark:ring-black/50"
                          )}>
                            <Shield className="h-10 w-10 text-white drop-shadow-lg" />
                          </div>
                          <div className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-md",
                            getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).badge
                          )}>
                            {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired' 
                              ? 'Vencida'
                              : getWarrantyStatus(repair.warrantyExpiresAt) === 'expiring'
                              ? 'Por vencer'
                              : 'Activa'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-zinc-950/30 shadow-md">
                    <div className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/50">
                          <Shield className="h-6 w-6 text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">Sin Garantía</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Esta reparación no incluye garantía.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Diagnóstico */}
              <TabsContent value="diagnostic" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Problema Reportado</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border min-h-[100px]">
                        <p className="text-sm leading-relaxed">{repair.issue}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Descripción Detallada</h3>
                      <div className="bg-muted/30 p-4 rounded-lg border min-h-[100px]">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {repair.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Seguridad y Acceso</h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Tipo de Acceso</p>
                        <Badge variant="outline" className="capitalize">
                          {repair.accessType || 'Ninguno'}
                        </Badge>
                      </div>

                      {repair.accessType === 'pattern' && repair.accessPassword && (
                        <div>
                          <p className="text-sm font-medium mb-2">Patrón de Desbloqueo</p>
                          <div className="w-fit mx-auto bg-background rounded-lg p-2">
                             <PatternDrawer 
                               value={repair.accessPassword} 
                               onChange={() => {}} 
                               disabled={true} 
                               minimal={true}
                             />
                          </div>
                        </div>
                      )}

                      {repair.accessType !== 'pattern' && repair.accessType !== 'none' && repair.accessPassword && (
                        <div>
                          <p className="text-sm font-medium mb-1">Contraseña / PIN</p>
                          <code className="bg-background px-2 py-1 rounded border text-sm font-mono block w-full">
                            {repair.accessPassword}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Costos y Piezas */}
              <TabsContent value="finance" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Resumen Financiero */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Resumen de Costos
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Mano de Obra:</span>
                        <span className="font-medium">{formatCurrency(repair.laborCost || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Costo de Piezas:</span>
                        <span className="font-medium">
                          {formatCurrency(
                            (repair.parts || []).reduce((acc, part) => acc + (part.cost * part.quantity), 0)
                          )}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">Costo Estimado:</span>
                        <span className="font-medium">{formatCurrency(repair.estimatedCost || 0)}</span>
                      </div>
                      <Separator className="my-3" />
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4 rounded-lg shadow-lg">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Costo Final</span>
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-white text-2xl">
                                {repair.finalCost !== null && repair.finalCost !== undefined 
                                  ? formatCurrency(repair.finalCost) 
                                  : formatCurrency(repair.estimatedCost || 0)
                                }
                              </span>
                              {repair.finalCost !== null && repair.finalCost !== undefined && repair.finalCost !== repair.estimatedCost && (
                                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                                  {repair.finalCost > repair.estimatedCost ? '↑' : '↓'} Ajustado
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        {repair.finalCost !== null && repair.finalCost !== undefined && repair.finalCost !== repair.estimatedCost && (
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <div className="flex items-center justify-between text-xs text-white/90">
                              <span>Diferencia:</span>
                              <span className="font-semibold">
                                {repair.finalCost > repair.estimatedCost ? '+' : ''}
                                {formatCurrency(repair.finalCost - repair.estimatedCost)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      {repair.finalCost === null || repair.finalCost === undefined ? (
                        <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2 flex items-start gap-2">
                          <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-amber-700 dark:text-amber-400">
                            El costo final aún no ha sido establecido. Se muestra el costo estimado.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Lista de Piezas */}
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <PackageIcon className="h-5 w-5 text-primary" />
                      Piezas y Refacciones
                    </h3>
                    {(!repair.parts || repair.parts.length === 0) ? (
                      <div className="bg-muted/20 border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                        No hay piezas registradas para esta reparación.
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                          <thead className="bg-muted/50 text-muted-foreground font-medium">
                            <tr>
                              <th className="px-4 py-3 text-left">Pieza</th>
                              <th className="px-4 py-3 text-center">Cant.</th>
                              <th className="px-4 py-3 text-right">Costo Unit.</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {repair.parts.map((part, index) => (
                              <tr key={index} className="bg-background">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{part.name}</div>
                                  <div className="text-xs text-muted-foreground">{part.partNumber}</div>
                                </td>
                                <td className="px-4 py-3 text-center">{part.quantity}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(part.cost)}</td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(part.cost * part.quantity)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Historial y Notas */}
              <TabsContent value="history" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Notas de la Reparación
                  </h3>
                  
                  {(!repair.notes || repair.notes.length === 0) ? (
                    <div className="bg-muted/20 border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                      No hay notas registradas.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {repair.notes.map((note, index) => (
                        <div key={index} className="flex gap-4 p-4 bg-muted/30 rounded-lg border">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-sm">{note.author}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(note.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90">{note.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Imágenes */}
              <TabsContent value="images" className="mt-0 space-y-6">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Galería de Imágenes
                  </h3>
                </div>

                {(!repair.images || repair.images.length === 0) ? (
                  <div className="bg-muted/20 border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No hay imágenes adjuntas a esta reparación.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {repair.images.map((image, index) => (
                      <div key={index} className="group relative aspect-square rounded-lg overflow-hidden border bg-muted">
                        <img 
                          src={image.url} 
                          alt={image.description || `Imagen ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="secondary" size="sm" asChild>
                            <a href={image.url} target="_blank" rel="noopener noreferrer">
                              Ver Completa
                            </a>
                          </Button>
                        </div>
                        {image.description && (
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs truncate">
                            {image.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        
        <DialogFooter className="p-4 border-t bg-background flex flex-wrap justify-between sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 sm:hidden">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint('customer')}>
                Comprobante Cliente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('technician')}>
                Ficha Técnica
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar Texto por WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('whatsapp-pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                PDF para WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('customer')}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Texto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('native')}>
                <Share2 className="mr-2 h-4 w-4" />
                Otras apps
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onEdit && (
            <Button onClick={() => onEdit(repair)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
