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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Maximize2, Minimize2, Share2, MessageCircle, Copy, Shield, X, Eye, EyeOff,
  PackageCheck, PackageX, CheckCircle2, ExternalLink, XCircle, Check, ChevronDown,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { toast } from 'sonner'
import { Repair, RepairDeliveryOutcome, RepairStatus } from '@/types/repairs'
import { statusConfig, priorityConfig, urgencyConfig, deviceTypeConfig } from '@/config/repair-constants'
import { getAvailableTransitions } from '@/lib/repairs/state-machine'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
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
import { logger } from '@/lib/logger'
import { formatWhatsAppPhone, getWhatsAppLink } from '@/lib/whatsapp'

interface RepairDetailDialogProps {
  open: boolean
  repair: Repair | null
  onClose: () => void
  onEdit?: (repair: Repair) => void
  onDeliver?: (repair: Repair) => void
  onQuickPay?: (repair: Repair) => void
  onStatusChange?: (id: string, status: RepairStatus) => Promise<boolean>
}

// Flujo lineal de estados para el stepper de progreso.
// "pausado" se representa sobre la etapa de reparación; "cancelado" reemplaza el stepper.
const STATUS_FLOW: RepairStatus[] = ['recibido', 'diagnostico', 'reparacion', 'listo', 'entregado']
const STATUS_FLOW_LABELS: Record<string, string> = {
  recibido: 'Recibido',
  diagnostico: 'Diagnóstico',
  reparacion: 'Reparación',
  listo: 'Listo',
  entregado: 'Entregado',
}

export function RepairDetailDialog({
  open,
  repair,
  onClose,
  onEdit,
  onDeliver,
  onQuickPay,
  onStatusChange
}: RepairDetailDialogProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [isSendingStatusWhatsApp, setIsSendingStatusWhatsApp] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const { settings } = useSharedSettings()
  const [verificationHash, setVerificationHash] = useState<string | undefined>(undefined)

  // Fetch verification hash when repair is loaded
  React.useEffect(() => {
    const controller = new AbortController()

    if (repair && open) {
      const ticketNum = repair.ticketNumber || repair.id
      const customerName = repair.customer.name
      const dateObj = new Date(repair.createdAt)

      fetch('/api/repairs/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ticketNumber: ticketNum,
          customerName: customerName,
          date: dateObj.toISOString()
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVerificationHash(data.hash)
        }
      })
      .catch(err => {
        if (err?.name !== 'AbortError') {
            logger.error('Failed to fetch verification hash', { error: err })
          }
      })
    } else {
      setVerificationHash(undefined)
    }
    return () => controller.abort()
  }, [repair, open])

  React.useEffect(() => {
    if (!open) {
      setShowSensitiveData(false)
    }
  }, [open])

  if (!repair) return null

  const StatusIcon = statusConfig[repair.status]?.icon || AlertCircle
  const DeviceIcon = deviceTypeConfig[repair.deviceType]?.icon || Smartphone
  const isPaused = repair.status === 'pausado'
  const isCancelled = repair.status === 'cancelado'
  const currentStepIndex = isPaused ? 2 : STATUS_FLOW.indexOf(repair.status)
  const partsTotal = (repair.parts || []).reduce((acc, part) => acc + (part.cost * part.quantity), 0)
  const displayCost = repair.finalCost !== null && repair.finalCost !== undefined
    ? repair.finalCost
    : (repair.estimatedCost || 0)

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Pendiente'
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy - h:mm a", { locale: es })
    } catch (e) {
      return 'Fecha inválida'
    }
  }

  const getPrintPayload = (): RepairPrintPayload => {
    if (!repair) throw new Error("No repair")
    // Campos opcionales que el tipo Repair['customer'] no declara.
    const extraCustomerFields = repair.customer as Partial<{
      address: string
      city: string
      country: string
      document: string
    }>
    return {
      ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase(),
      date: new Date(repair.createdAt),
      priority: repair.priority,
      urgency: repair.urgency,
      customer: {
        id: repair.customer.id,
        name: repair.customer.name,
        customerCode: repair.customer.customerCode,
        phone: repair.customer.phone,
        email: repair.customer.email,
        address: extraCustomerFields.address,
        city: extraCustomerFields.city,
        country: extraCustomerFields.country,
        document: extraCustomerFields.document,
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
        logo: settings.companyLogo || undefined,
      },
      verificationHash
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
      try {
        await navigator.clipboard.writeText(shareText)
        toast.success('Texto copiado al portapapeles')
      } catch (error) {
        toast.error('No se pudo copiar el texto')
      }
    } else if (method === 'native') {
      if (navigator.share) {
        navigator.share({
          title: `Reparación ${payload.ticketNumber}`,
          text: shareText,
        }).catch(() => {
          toast.error('No se pudo compartir')
        })
      } else {
        toast.error('Tu dispositivo no soporta compartir nativo')
      }
    }
  }

  const buildStatusWhatsAppMessage = () => {
    const ticket = repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()
    const statusLabel = statusConfig[repair.status]?.label || repair.status
    const deviceLabel = [repair.brand, repair.model].filter(Boolean).join(' ') || repair.device

    if (repair.status === 'listo') {
      const amount =
        repair.finalCost !== null && repair.finalCost !== undefined
          ? `\nCosto final: ${formatCurrency(repair.finalCost)}`
          : ''
      return [
        `Hola ${repair.customer.name},`,
        '',
        `Tu ${deviceLabel} (reparacion #${ticket}) ya esta *${statusLabel}*.`,
        'Puedes pasar por el local para retirarlo.',
        amount,
        '',
        'Si tienes dudas, responde este mensaje y te ayudamos.',
      ]
        .filter(Boolean)
        .join('\n')
    }

    return [
      `Hola ${repair.customer.name},`,
      '',
      `Actualizamos el estado de tu reparacion #${ticket}: *${statusLabel}*.`,
      `Equipo: ${deviceLabel}.`,
      '',
      'Cualquier consulta estamos a disposicion.',
    ].join('\n')
  }

  const openManualWhatsApp = (phone: string, message: string): boolean => {
    const url = getWhatsAppLink({ phone, message })
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (popup) return true
    window.location.href = url
    return true
  }

  const handleSendStatusByWhatsApp = async () => {
    const rawPhone = repair.customer?.phone?.trim()
    if (!rawPhone) {
      toast.error('El cliente no tiene telefono registrado')
      return
    }

    const normalizedPhone = formatWhatsAppPhone(rawPhone).replace(/\D/g, '')
    if (normalizedPhone.length < 6) {
      toast.error('El telefono del cliente no es valido')
      return
    }

    const message = buildStatusWhatsAppMessage()
    setIsSendingStatusWhatsApp(true)

    try {
      const opened = openManualWhatsApp(normalizedPhone, message)
      if (!opened) {
        toast.error('No se pudo abrir WhatsApp manualmente')
        return
      }

      toast.success('WhatsApp abierto con el aviso de estado')
    } catch (error) {
      logger.error('Failed to send repair status via WhatsApp', { error, repairId: repair.id })
      toast.error('No se pudo enviar el aviso por WhatsApp')
    } finally {
      setIsSendingStatusWhatsApp(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-300",
          "rounded-2xl border-border/60 shadow-2xl",
          // En móvil ocupa toda la pantalla, estilo app
          "max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none",
          isMaximized
            ? "sm:w-[98vw] sm:max-w-[98vw] sm:h-[96vh] sm:max-h-[96vh]"
            : "sm:w-[92vw] sm:max-w-5xl sm:h-[85vh] sm:max-h-[85vh]"
        )}>
        <DialogHeader className="px-4 sm:px-6 py-3.5 bg-muted/20 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className={cn(
                "hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                statusConfig[repair.status]?.bgColor || 'bg-slate-500'
              )}>
                <DeviceIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="bg-background font-mono text-xs">
                    #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                  </Badge>
                  <Badge className={cn("gap-1", statusConfig[repair.status]?.color)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig[repair.status]?.label || repair.status}
                  </Badge>
                  <Badge variant="outline" className={cn(priorityConfig[repair.priority].color)}>
                    Prioridad {priorityConfig[repair.priority].label}
                  </Badge>
                  {repair.urgency === 'urgent' && (
                    <Badge className={cn(urgencyConfig[repair.urgency].color)}>
                      {urgencyConfig[repair.urgency].label}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight truncate">
                  {repair.device}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-sm flex-wrap">
                  <span>{deviceTypeConfig[repair.deviceType]?.label || repair.deviceType}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{repair.brand} {repair.model}</span>
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Compartir" title="Compartir reparación">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-64">
                  <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Enviar Texto por WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('whatsapp-pdf')}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF para WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" title="Imprimir documentos de la reparación">
                    <Printer className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Imprimir</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-1 hidden sm:block opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-72">
                  <DropdownMenuItem onClick={() => handlePrint('customer')} className="items-start gap-3 py-2.5">
                    <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Comprobante para el cliente</p>
                      <p className="text-xs text-muted-foreground">
                        Recibo con datos del equipo, costo y garantía
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint('technician')} className="items-start gap-3 py-2.5">
                    <Wrench className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Ficha técnica (taller)</p>
                      <p className="text-xs text-muted-foreground">
                        Orden interna con diagnóstico y detalle del trabajo
                      </p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(repair)}>
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <span className="sr-only">Cerrar</span>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper de progreso */}
        <div className="px-4 sm:px-6 py-2 border-b bg-background shrink-0">
          {isCancelled ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-2.5">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Esta reparación fue cancelada.
              </p>
            </div>
          ) : (
            <div className="flex items-center max-w-3xl mx-auto">
              {STATUS_FLOW.map((step, i) => {
                const cfg = statusConfig[step]
                const Icon = cfg.icon
                const done = i < currentStepIndex
                const current = i === currentStepIndex
                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <div className={cn(
                        "h-0.5 flex-1 mx-1.5 rounded-full",
                        i <= currentStepIndex ? "bg-emerald-400" : "bg-border"
                      )} />
                    )}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-colors",
                        done && "bg-emerald-500 border-emerald-500 text-white",
                        current && !isPaused && cn(cfg.bgColor, "border-transparent text-white shadow-md"),
                        current && isPaused && "bg-purple-500 border-purple-500 text-white",
                        !done && !current && "bg-muted border-border text-muted-foreground"
                      )}>
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium leading-none hidden sm:block",
                        current ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {current && isPaused ? 'Pausado' : STATUS_FLOW_LABELS[step]}
                      </span>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick status transitions container */}
        {repair && onStatusChange && !isCancelled && (
          <div className="px-4 sm:px-6 py-2.5 border-b bg-slate-50/50 dark:bg-slate-900/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              Cambio rápido de estado:
            </span>
            <div className="flex flex-wrap gap-2">
              {getAvailableTransitions(repair.status).map((nextStatus) => {
                const cfg = statusConfig[nextStatus]
                if (!cfg) return null
                const NextIcon = cfg.icon

                return (
                  <Button
                    key={nextStatus}
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-7 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-95",
                      cfg.color,
                      "hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    )}
                    onClick={async () => {
                      setIsUpdatingStatus(true)
                      try {
                        const success = await onStatusChange(repair.id, nextStatus)
                        if (success) {
                          toast.success(`Estado actualizado a ${cfg.label}`)
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado')
                      } finally {
                        setIsUpdatingStatus(false)
                      }
                    }}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <NextIcon className="h-3.5 w-3.5" />
                    )}
                    {cfg.label}
                  </Button>
                )
              })}
              
              {/* Optional: Cancel option if not cancelado or entregado */}
              {repair.status !== 'entregado' && repair.status !== 'cancelado' && !getAvailableTransitions(repair.status).includes('cancelado') && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  onClick={async () => {
                    setIsUpdatingStatus(true)
                    try {
                      const success = await onStatusChange(repair.id, 'cancelado')
                      if (success) {
                        toast.success('Reparación cancelada')
                      }
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar')
                    } finally {
                      setIsUpdatingStatus(false)
                    }
                  }}
                  disabled={isUpdatingStatus}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 bg-background w-full">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Mensaje de Estado de Pago */}
            {repair.status === 'listo' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
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

            {/* Delivery outcome banner */}
            {repair.status === 'entregado' && (() => {
              const outcome = repair.deliveryOutcome as RepairDeliveryOutcome | null | undefined
              const outcomeMap = {
                repaired: {
                  Icon: CheckCircle2,
                  title: 'Equipo Reparado y Entregado',
                  desc: 'El equipo fue reparado correctamente y entregado al cliente.',
                  bg: 'bg-emerald-50 dark:bg-emerald-950/30',
                  border: 'border-emerald-200 dark:border-emerald-900/50',
                  iconCls: 'text-emerald-600 dark:text-emerald-400',
                  titleCls: 'text-emerald-800 dark:text-emerald-300',
                  descCls: 'text-emerald-700 dark:text-emerald-400/90',
                },
                withdrawn: {
                  Icon: PackageX,
                  title: 'Retirado Sin Reparar',
                  desc: 'El cliente retiró el equipo antes de completar la reparación.',
                  bg: 'bg-amber-50 dark:bg-amber-950/30',
                  border: 'border-amber-200 dark:border-amber-900/50',
                  iconCls: 'text-amber-600 dark:text-amber-400',
                  titleCls: 'text-amber-800 dark:text-amber-300',
                  descCls: 'text-amber-700 dark:text-amber-400/90',
                },
                unrepairable: {
                  Icon: Wrench,
                  title: 'No Fue Posible Reparar',
                  desc: 'El equipo tiene daños irreparables o no se encontraron los repuestos.',
                  bg: 'bg-rose-50 dark:bg-rose-950/30',
                  border: 'border-rose-200 dark:border-rose-900/50',
                  iconCls: 'text-rose-600 dark:text-rose-400',
                  titleCls: 'text-rose-800 dark:text-rose-300',
                  descCls: 'text-rose-700 dark:text-rose-400/90',
                },
              }
              // Fallback for entregado without outcome (legacy records)
              const cfg = outcome ? outcomeMap[outcome] : {
                Icon: PackageCheck,
                title: 'Equipo Entregado',
                desc: 'La reparación fue completada y el equipo fue entregado al cliente.',
                bg: 'bg-emerald-50 dark:bg-emerald-950/30',
                border: 'border-emerald-200 dark:border-emerald-900/50',
                iconCls: 'text-emerald-600 dark:text-emerald-400',
                titleCls: 'text-emerald-800 dark:text-emerald-300',
                descCls: 'text-emerald-700 dark:text-emerald-400/90',
              }
              const { Icon } = cfg
              return (
                <div className={cn('rounded-lg border p-4', cfg.bg, cfg.border)}>
                  <div className="flex items-start gap-3">
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', cfg.iconCls)} />
                    <div className="flex-1 min-w-0">
                      <h4 className={cn('font-semibold', cfg.titleCls)}>{cfg.title}</h4>
                      <p className={cn('text-sm mt-1', cfg.descCls)}>{cfg.desc}</p>
                      {repair.pickedUpAt && (
                        <p className={cn('text-xs mt-2 flex items-center gap-1.5', cfg.descCls)}>
                          <Calendar className="h-3.5 w-3.5" />
                          Entregado el{' '}
                          {format(new Date(repair.pickedUpAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* ─── Columna lateral: resumen siempre visible ─── */}
              <aside className="w-full lg:w-80 shrink-0 space-y-4">
                {/* Costo */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 dark:from-emerald-600 dark:via-emerald-700 dark:to-teal-800 p-5 text-white shadow-md">
                  <DollarSign className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-white/10" />
                  <div className="relative space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/85 text-xs font-medium uppercase tracking-wide">
                        Costo de la Reparación
                      </span>
                      {repair.status === 'entregado' && (
                        <Badge variant="secondary" className="bg-white/90 text-emerald-700 hover:bg-white font-bold text-[10px]">
                          PAGADO
                        </Badge>
                      )}
                      {repair.status === 'listo' && (
                        <Badge variant="secondary" className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400 font-bold text-[10px] border-none">
                          PENDIENTE DE PAGO
                        </Badge>
                      )}
                      {repair.paymentStatus === 'parcial' && repair.status !== 'entregado' && repair.status !== 'listo' && (
                        <Badge variant="secondary" className="bg-blue-400 text-blue-900 hover:bg-blue-400 font-bold text-[10px] border-none">
                          PAGO PARCIAL
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-3xl">{formatCurrency(displayCost)}</span>
                      {repair.finalCost !== null && repair.finalCost !== undefined && repair.finalCost !== repair.estimatedCost && (
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px]">
                          {repair.finalCost > repair.estimatedCost ? '↑' : '↓'} Ajustado
                        </Badge>
                      )}
                    </div>
                    {repair.paymentStatus === 'parcial' && repair.paidAmount !== undefined && repair.paidAmount > 0 && (
                      <div className="text-white/90 text-xs space-y-1 pt-1">
                        <div className="flex justify-between border-b border-white/20 pb-1">
                          <span>Pagado:</span>
                          <span className="font-semibold">{formatCurrency(repair.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-white">
                          <span>Restante:</span>
                          <span>{formatCurrency(displayCost - repair.paidAmount)}</span>
                        </div>
                      </div>
                    )}
                    {repair.finalCost === null || repair.finalCost === undefined ? (
                      <p className="text-white/75 text-[11px] leading-snug">
                        * Costo estimado — el final se determina al completar el diagnóstico
                      </p>
                    ) : (
                      <div className="flex items-center gap-3 text-white/90 text-xs pt-1">
                        <span>
                          <span className="text-white/70">Mano de obra </span>
                          <span className="font-semibold">{formatCurrency(repair.laborCost || 0)}</span>
                        </span>
                        <span className="text-white/40">•</span>
                        <span>
                          <span className="text-white/70">Piezas </span>
                          <span className="font-semibold">{formatCurrency(partsTotal)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cliente */}
                <div className="rounded-xl border bg-card p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                      {repair.customer.name
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-sm">{repair.customer.name}</p>
                      <p className="text-xs text-muted-foreground">Cliente registrado</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {repair.customer.phone && (
                      <a
                        href={`tel:${repair.customer.phone}`}
                        className="flex items-center gap-2.5 text-foreground/90 hover:text-primary transition-colors"
                      >
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        {repair.customer.phone}
                      </a>
                    )}
                    {repair.customer.email && (
                      <a
                        href={`mailto:${repair.customer.email}`}
                        className="flex items-center gap-2.5 text-foreground/90 hover:text-primary transition-colors break-all"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        {repair.customer.email}
                      </a>
                    )}
                  </div>
                  {repair.customer.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleSendStatusByWhatsApp}
                      disabled={isSendingStatusWhatsApp}
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      {isSendingStatusWhatsApp ? 'Enviando estado...' : 'Avisar estado por WhatsApp'}
                    </Button>
                  )}
                </div>

                {/* Servicio: fechas y técnico */}
                <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                      <Clock className="h-4 w-4" /> Recibido
                    </span>
                    <span className="font-medium text-right text-xs">{formatDate(repair.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                      <Clock className="h-4 w-4" /> Estimado
                    </span>
                    <span className="font-medium text-right text-xs">{formatDate(repair.estimatedCompletion)}</span>
                  </div>
                  {repair.completedAt && (
                    <div className="flex justify-between items-center gap-3 text-sm">
                      <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                        <CheckCircle className="h-4 w-4 text-emerald-500" /> Completado
                      </span>
                      <span className="font-medium text-emerald-600 text-right text-xs">{formatDate(repair.completedAt)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Técnico asignado</p>
                      <p className={cn(
                        "text-sm font-medium truncate",
                        !repair.technician?.name && "text-muted-foreground italic"
                      )}>
                        {repair.technician?.name || 'Sin asignar'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Garantía compacta */}
                {repair.warrantyMonths && repair.warrantyMonths > 0 ? (
                  <div className={cn(
                    "rounded-xl border p-4 space-y-2.5",
                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).bg,
                    getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).border
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className={cn(
                          "h-4 w-4",
                          getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).icon
                        )} />
                        <span className={cn(
                          "text-sm font-semibold",
                          getWarrantyStatusColor(getWarrantyStatus(repair.warrantyExpiresAt)).text
                        )}>
                          Garantía
                        </span>
                      </div>
                      <Badge variant="outline" className="bg-background text-[10px]">
                        {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired'
                          ? 'Vencida'
                          : getWarrantyStatus(repair.warrantyExpiresAt) === 'expiring'
                          ? 'Por vencer'
                          : 'Activa'}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duración</span>
                        <span className="font-medium">{formatWarrantyDuration(repair.warrantyMonths)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cobertura</span>
                        <span className="font-medium">{getWarrantyTypeLabel(repair.warrantyType || 'full')}</span>
                      </div>
                      {repair.warrantyExpiresAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {getWarrantyStatus(repair.warrantyExpiresAt) === 'expired' ? 'Venció' : 'Vence'}
                          </span>
                          <span className="font-medium">{formatWarrantyExpiration(repair.warrantyExpiresAt)}</span>
                        </div>
                      )}
                      {repair.warrantyExpiresAt && getWarrantyStatus(repair.warrantyExpiresAt) !== 'expired' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Restan</span>
                          <span className="font-semibold">{getDaysRemaining(repair.warrantyExpiresAt)} días</span>
                        </div>
                      )}
                      {repair.pickedUpAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Retirado</span>
                          <span className="font-medium">{formatDate(repair.pickedUpAt)}</span>
                        </div>
                      )}
                    </div>
                    {repair.warrantyNotes && (
                      <p className="text-[11px] text-muted-foreground border-t pt-2 leading-snug">
                        {repair.warrantyNotes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted/10 p-4 flex items-center gap-3">
                    <Shield className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sin garantía</p>
                      <p className="text-xs text-muted-foreground">No incluye garantía.</p>
                    </div>
                  </div>
                )}
              </aside>

              {/* ─── Área principal: detalle por pestañas ─── */}
              <main className="flex-1 min-w-0 w-full">
                <Tabs defaultValue="diagnostic" className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto h-auto p-1">
                    <TabsTrigger value="diagnostic" className="text-xs sm:text-sm">
                      Diagnóstico
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="text-xs sm:text-sm">
                      Costos y Piezas
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs sm:text-sm">
                      Historial ({repair.notes?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="images" className="text-xs sm:text-sm">
                      Imágenes ({repair.images?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  {/* Diagnóstico */}
                  <TabsContent value="diagnostic" className="mt-4 space-y-5">
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Problema Reportado</h3>
                      <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <p className="text-sm leading-relaxed">{repair.issue}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Descripción Detallada</h3>
                      <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {repair.description || 'Sin descripción detallada.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Seguridad y Acceso</h3>
                      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Tipo de Acceso</p>
                          <Badge variant="outline" className="capitalize">
                            {repair.accessType || 'Ninguno'}
                          </Badge>
                        </div>

                        {repair.accessType === 'pattern' && repair.accessPassword && (
                          <div>
                            <p className="text-sm font-medium mb-2">Patrón de Desbloqueo</p>
                            <div className="flex flex-col items-center gap-2">
                              {!showSensitiveData ? (
                                <div className="text-xs text-muted-foreground bg-background px-3 py-2 rounded border">
                                  Patrón oculto por seguridad
                                </div>
                              ) : (
                                <div className="w-fit mx-auto bg-background rounded-lg p-2">
                                  <PatternDrawer
                                    value={repair.accessPassword}
                                    onChange={() => {}}
                                    disabled={true}
                                    minimal={true}
                                  />
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="h-7 px-2"
                                onClick={() => setShowSensitiveData(prev => !prev)}
                              >
                                {showSensitiveData ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                                {showSensitiveData ? 'Ocultar' : 'Ver'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {repair.accessType !== 'pattern' && repair.accessType !== 'none' && repair.accessPassword && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium">Contraseña / PIN</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="h-7 px-2"
                                onClick={() => setShowSensitiveData(prev => !prev)}
                              >
                                {showSensitiveData ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                                {showSensitiveData ? 'Ocultar' : 'Ver'}
                              </Button>
                            </div>
                            <code className="bg-background px-2 py-1 rounded border text-sm font-mono block w-full">
                              {showSensitiveData ? repair.accessPassword : '•'.repeat(Math.max(repair.accessPassword.length, 6))}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Costos y Piezas */}
                  <TabsContent value="finance" className="mt-4 space-y-5">
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Resumen de Costos
                      </h3>
                      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Mano de Obra:</span>
                          <span className="font-medium">{formatCurrency(repair.laborCost || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Costo de Piezas:</span>
                          <span className="font-medium">{formatCurrency(partsTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Costo Estimado:</span>
                          <span className="font-medium">{formatCurrency(repair.estimatedCost || 0)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Costo Final:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(displayCost)}
                            </span>
                            {repair.finalCost !== null && repair.finalCost !== undefined && repair.finalCost !== repair.estimatedCost && (
                              <Badge variant="outline" className="text-xs">
                                {repair.finalCost > repair.estimatedCost ? '↑' : '↓'}{' '}
                                {formatCurrency(Math.abs(repair.finalCost - repair.estimatedCost))}
                              </Badge>
                            )}
                          </div>
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

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <PackageIcon className="h-4 w-4" />
                        Piezas y Refacciones
                      </h3>
                      {(!repair.parts || repair.parts.length === 0) ? (
                        <div className="bg-muted/20 border border-dashed rounded-xl p-8 text-center text-muted-foreground text-sm">
                          No hay piezas registradas para esta reparación.
                        </div>
                      ) : (
                        <div className="border rounded-xl overflow-x-auto shadow-sm">
                          <table className="w-full text-sm min-w-[480px]">
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
                  </TabsContent>

                  {/* Historial y Notas */}
                  <TabsContent value="history" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notas de la Reparación
                    </h3>

                    {(!repair.notes || repair.notes.length === 0) ? (
                      <div className="bg-muted/20 border border-dashed rounded-xl p-8 text-center text-muted-foreground text-sm">
                        No hay notas registradas.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {repair.notes.map((note, index) => (
                          <div key={index} className="flex gap-4 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-medium text-sm">{note.author}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatDate(note.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/90">{note.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Imágenes */}
                  <TabsContent value="images" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Galería de Imágenes
                    </h3>

                    {(!repair.images || repair.images.length === 0) ? (
                      <div className="bg-muted/20 border border-dashed rounded-xl p-12 text-center text-muted-foreground">
                        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No hay imágenes adjuntas a esta reparación.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {repair.images.map((image, index) => (
                          <div key={index} className="group relative aspect-square rounded-xl overflow-hidden border bg-muted">
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
                </Tabs>
              </main>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-4 py-3 border-t bg-background flex flex-wrap justify-between sm:justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>

          {repair.status !== 'entregado' && (
            <>
              {onQuickPay && (
                <Button
                  variant="default"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    onClose()
                    onQuickPay(repair)
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  Cobrar Aquí
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (repair.customer?.id) {
                    window.location.href = `/dashboard/pos?customerId=${repair.customer.id}&repairId=${repair.id}`
                  }
                  onClose()
                }}
              >
                <ExternalLink className="h-4 w-4" />
                + Productos en POS
              </Button>
              {onDeliver && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    onClose()
                    onDeliver(repair)
                  }}
                >
                  <PackageCheck className="h-4 w-4" />
                  Entregar
                </Button>
              )}
            </>
          )}

        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
