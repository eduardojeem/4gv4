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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Phone, Mail, Calendar, Wrench,
  Smartphone, AlertCircle,
  DollarSign, Clock, FileText, Image as ImageIcon,
  Edit, Printer, CheckCircle,
  Maximize2, Minimize2, Share2, MessageCircle, Copy, Shield, X, Eye, EyeOff,
  PackageCheck, PackageX, CheckCircle2, ExternalLink, XCircle, Check, ChevronDown,
  Loader2, Sparkles, History, FileCheck2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { toast } from 'sonner'
import { Repair, RepairDeliveryOutcome, RepairStatus } from '@/types/repairs'
import { statusConfig, priorityConfig, urgencyConfig, deviceTypeConfig } from '@/config/repair-constants'
import { getAvailableTransitions } from '@/lib/repairs/state-machine'
import { getRepairFinancialPresentation } from '@/lib/repairs/financial-closure'
import { normalizeRepairLineType } from '@/lib/repairs/line-types'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { PatternDrawer } from './PatternDrawer'
import { CreateAfterSalesCaseDialog } from '@/components/dashboard/after-sales/CreateAfterSalesCaseDialog'
import { RepairWarrantyCase } from './RepairWarrantyCase'
import { DeviceHistoryTimeline } from './DeviceHistoryTimeline'
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
import { RepairCostSummary } from './RepairCostSummary'
import { RepairCostsEditorDialog } from './RepairCostsEditorDialog'
import { RepairInternalCostCorrectionDialog } from './RepairInternalCostCorrectionDialog'
import { RepairFinalPriceCorrectionDialog } from './RepairFinalPriceCorrectionDialog'
import { calculateRepairCost } from '@/lib/repairs/cost-breakdown'
import { useAuth } from '@/contexts/auth-context'

interface RepairDetailDialogProps {
  open: boolean
  repair: Repair | null
  onClose: () => void
  onEdit?: (repair: Repair) => void
  onDeliver?: (repair: Repair) => void
  onQuickPay?: (repair: Repair) => void
  onCostSaved?: () => void | Promise<void>
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
  repair: propRepair,
  onClose,
  onEdit,
  onDeliver,
  onQuickPay,
  onCostSaved,
  onStatusChange
}: RepairDetailDialogProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const { isAdmin } = useAuth()
  const [warrantyClaimOpen, setWarrantyClaimOpen] = useState(false)
  // Al registrar un reclamo se remonta el bloque para que muestre el caso recien creado.
  const [warrantyCaseVersion, setWarrantyCaseVersion] = useState(0)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [isSendingStatusWhatsApp, setIsSendingStatusWhatsApp] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isCostsEditorOpen, setIsCostsEditorOpen] = useState(false)
  const [isInternalCostCorrectionOpen, setIsInternalCostCorrectionOpen] = useState(false)
  const [isFinalPriceCorrectionOpen, setIsFinalPriceCorrectionOpen] = useState(false)
  const { settings } = useSharedSettings()
  const [verificationHash, setVerificationHash] = useState<string | undefined>(undefined)
  const [deliveredEditWarningOpen, setDeliveredEditWarningOpen] = useState(false)

  // Estado local sincronizado para actualización reactiva instantánea
  const [localRepair, setLocalRepair] = useState<Repair | null>(propRepair)

  React.useEffect(() => {
    setLocalRepair(propRepair)
  }, [propRepair])

  const activeRepair = propRepair || localRepair

  // Fetch verification hash when repair is loaded
  React.useEffect(() => {
    const controller = new AbortController()

    if (activeRepair && open) {
      const ticketNum = activeRepair.ticketNumber || activeRepair.id
      const customerName = activeRepair.customer?.name || 'Cliente'
      const dateObj = new Date(activeRepair.createdAt)

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
  }, [activeRepair, open])

  React.useEffect(() => {
    if (!open) {
      setShowSensitiveData(false)
    }
  }, [open])

  if (!open || !activeRepair) return null

  const repair = activeRepair

  const StatusIcon = statusConfig[activeRepair.status]?.icon || AlertCircle
  const DeviceIcon = deviceTypeConfig[activeRepair.deviceType]?.icon || Smartphone
  const isPaused = activeRepair.status === 'pausado'
  const isCancelled = activeRepair.status === 'cancelado'
  const currentStepIndex = isPaused ? 2 : STATUS_FLOW.indexOf(activeRepair.status)
  const lineTotals = (activeRepair.parts || []).reduce((totals, part) => {
    const amount = Math.max(0, part.cost * part.quantity - (part.discountAmount ?? 0))
    const lineType = normalizeRepairLineType(part.lineType)
    if (lineType === 'service') totals.services += amount
    else if (lineType === 'included_material') totals.includedInternal += (part.internalCost ?? 0) * part.quantity
    else totals.chargedParts += amount
    return totals
  }, { services: 0, chargedParts: 0, includedInternal: 0 })
  const financial = getRepairFinancialPresentation({
    status: activeRepair.status,
    finalCost: activeRepair.finalCost,
    estimatedCost: activeRepair.estimatedCost,
    paidAmount: activeRepair.paidAmount,
  })
  const configuredTaxRate = [0, 5, 10].includes(Number(settings.repairLaborTaxRate))
    ? Number(settings.repairLaborTaxRate) as 0 | 5 | 10
    : 10
  const repairCostSummary = activeRepair.costSummary ?? calculateRepairCost({
    currency: settings.currency || 'PYG',
    laborAmount: activeRepair.laborCost || 0,
    laborTaxRate: configuredTaxRate,
    parts: (activeRepair.parts || []).map((part, index) => ({
      key: part.databaseId || String(part.id || index),
      quantity: part.quantity,
      unitPrice: part.cost,
      unitCost: part.internalCost ?? part.cost,
      discountAmount: part.discountAmount ?? 0,
      taxRate: part.taxRate ?? configuredTaxRate,
      lineType: part.lineType,
    })),
    additionalCharges: activeRepair.additionalCharges || 0,
    deductions: activeRepair.deductions || 0,
    discountAmount: activeRepair.discountAmount || 0,
    paidAmount: activeRepair.paidAmount || 0,
  })

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
    const extraCustomerFields = (repair.customer || {}) as Partial<{
      address: string
      city: string
      country: string
      document: string
    }>
    return {
      ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase(),
      date: new Date(repair.createdAt || new Date()),
      priority: repair.priority,
      urgency: repair.urgency,
      customer: {
        id: repair.customer?.id || '',
        name: repair.customer?.name || 'Cliente',
        customerCode: repair.customer?.customerCode || '',
        phone: repair.customer?.phone || '',
        email: repair.customer?.email || '',
        address: extraCustomerFields.address,
        city: extraCustomerFields.city,
        country: extraCustomerFields.country,
        document: extraCustomerFields.document,
      },
      devices: [{
        typeLabel: deviceTypeConfig[repair.deviceType]?.label || repair.deviceType,
        brand: repair.brand,
        model: repair.model,
        serialNumber: repair.serialNumber,
        imei: repair.imei || repair.serialNumber,
        accessType: repair.accessType,
        accessPassword: repair.accessPassword,
        issue: repair.issue,
        description: repair.description,
        technician: repair.technician?.name || 'Sin asignar',
        estimatedCost: repair.estimatedCost,
        finalCost: repair.finalCost,
        paidAmount: repair.paidAmount,
        ticketNumber: repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()
      }],
      finalCost: repair.finalCost || undefined,
      estimatedCost: repair.estimatedCost,
      paidAmount: repair.paidAmount,
      warrantyMonths: repair.warrantyMonths,
      warrantyType: repair.warrantyType,
      warrantyNotes: repair.warrantyNotes,
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

  const handlePrint = (type: 'customer' | 'technician' | 'technician_detailed') => {
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
        `Hola ${repair.customer?.name || 'estimado/a cliente'},`,
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
      `Hola ${repair.customer?.name || 'estimado/a cliente'},`,
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
    <>
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-help-id="repair-detail"
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
        <DialogHeader data-testid="repair-detail-header" className="border-b bg-muted/20 px-2 py-1.5 sm:px-6 sm:py-3.5 shrink-0">
          <div className="flex justify-between items-start gap-2 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-4 min-w-0">
              <div className={cn(
                "hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                statusConfig[repair.status]?.bgColor || 'bg-slate-500'
              )}>
                <DeviceIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 space-y-1 sm:space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="bg-background font-mono text-xs">
                    #{repair.ticketNumber || repair.id.slice(0, 8).toUpperCase()}
                  </Badge>
                  <Badge className={cn("gap-1", statusConfig[repair.status]?.color || 'bg-slate-100 text-slate-800')}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig[repair.status]?.label || repair.status || 'En Proceso'}
                  </Badge>
                  {(repair.priority ? priorityConfig[repair.priority] : null) ? (
                    <Badge variant="outline" className={cn('max-sm:hidden', priorityConfig[repair.priority]?.color)}>
                      Prioridad {priorityConfig[repair.priority]?.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="max-sm:hidden bg-slate-50 text-slate-600 border-slate-200">
                      Prioridad Normal
                    </Badge>
                  )}
                  {repair.urgency && urgencyConfig[repair.urgency] && (
                    <Badge className={cn('max-sm:hidden', urgencyConfig[repair.urgency]?.color)}>
                      {urgencyConfig[repair.urgency]?.label}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="truncate text-base font-bold tracking-tight sm:text-xl">
                  {repair.device}
                </DialogTitle>
                <DialogDescription data-testid="repair-detail-device-description" className="flex items-center gap-1.5 text-xs max-sm:hidden sm:gap-2 sm:text-sm flex-wrap">
                  <span>{deviceTypeConfig[repair.deviceType]?.label || repair.deviceType}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{repair.brand} {repair.model}</span>
                  {(repair.serialNumber || repair.imei) && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="max-sm:hidden font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        IMEI/SN: {repair.serialNumber || repair.imei}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-11 min-w-11 max-sm:hidden sm:h-9 sm:min-h-9 sm:w-9 sm:min-w-9" aria-label="Compartir" title="Compartir reparación">
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
                className="max-sm:hidden"
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="max-sm:hidden" title="Imprimir documentos de la reparación">
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
                      <p className="font-medium">Ficha técnica simple (taller)</p>
                      <p className="text-xs text-muted-foreground">
                        Resumen para pegar en el equipo
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint('technician_detailed')} className="items-start gap-3 py-2.5">
                    <FileCheck2 className="h-4 w-4 mt-0.5 shrink-0 text-indigo-600" />
                    <div>
                      <p className="font-medium">Ficha de laboratorio (completa)</p>
                      <p className="text-xs text-muted-foreground">
                        Incluye PIN/Patrón, checklist de banco y notas técnicas
                      </p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {activeRepair.status === 'entregado' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setWarrantyClaimOpen(true)}
                  className="max-sm:hidden bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Procesar Garantía</span>
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="max-sm:hidden"
                  onClick={() => {
                    if (activeRepair.status === 'entregado') {
                      setDeliveredEditWarningOpen(true)
                    } else {
                      onEdit(activeRepair)
                    }
                  }}
                >
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="min-h-11 min-w-11 sm:h-9 sm:min-h-9 sm:w-9 sm:min-w-9" aria-label="Cerrar detalle de reparación">
                <span className="sr-only">Cerrar detalle de reparación</span>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper de progreso */}
        <div data-testid="repair-detail-progress" className="border-b bg-background px-3 py-1.5 max-sm:hidden sm:px-6 sm:py-2 shrink-0">
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
                        "text-[10px] font-medium leading-none",
                        current ? 'block' : 'hidden sm:block',
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
          <div className="border-b bg-slate-50/50 px-3 py-2 dark:bg-slate-900/10 flex items-center gap-2 shrink-0 sm:flex-wrap sm:justify-between sm:px-6 sm:py-2.5">
            <span className="max-sm:hidden text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              Cambio rápido de estado:
            </span>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain sm:flex-wrap">
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
                      "h-11 shrink-0 rounded-xl text-xs font-bold gap-1.5 transition-all active:scale-95 sm:h-7",
                      cfg.color,
                      "hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    )}
                    onClick={async () => {
                      // "Entregado" nunca se hace con un cambio de estado plano:
                      // así no se preguntaba si funcionó ni se ofrecía cobrar,
                      // y la reparación quedaba entregada (y hasta sin fecha de
                      // garantía) en un solo click sin querer. Se redirige al
                      // mismo flujo del botón "Entregar".
                      if (nextStatus === 'entregado') {
                        if (onDeliver) {
                          onClose()
                          onDeliver(repair)
                        }
                        return
                      }
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
                  className="h-11 shrink-0 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 sm:h-7"
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
          <div className="space-y-4 p-3 sm:space-y-5 sm:p-6">
            {/* Mensaje de Estado de Pago */}
            {repair.status === 'listo' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-400">Equipo Listo para Entrega</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-500/90 mt-1">
                      Podés cobrar al entregar o continuar por POS si necesitás agregar productos.
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
              <aside data-testid="repair-detail-summary" className="order-2 w-full shrink-0 space-y-4 lg:order-1 lg:w-80">
                {/* Estado financiero: independiente de si el equipo ya fue entregado. */}
                <section aria-labelledby="repair-payment-summary-title" className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <DollarSign className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-emerald-600/5" />
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 id="repair-payment-summary-title" className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                        Estado del pago
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-bold text-[10px]',
                          financial.status === 'pagado'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : financial.status === 'parcial'
                              ? 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                              : 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
                        )}
                      >
                        {!financial.priceDefined
                          ? (financial.paid > 0 ? 'Anticipo recibido' : 'Precio pendiente')
                          : financial.status === 'pagado'
                          ? 'Pago completado'
                          : financial.status === 'parcial'
                            ? 'Pago parcial'
                            : 'Pago pendiente'}
                      </Badge>
                    </div>
                    <div
                      role="status"
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm',
                        financial.priceDefined && financial.status === 'pagado'
                          ? 'border-emerald-300 bg-emerald-100/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100'
                          : financial.paid > 0
                            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                            : 'border-emerald-200 bg-background/70 text-foreground dark:border-emerald-900/60',
                      )}
                    >
                      {financial.priceDefined && financial.status === 'pagado' ? (
                        <>
                          <p className="font-semibold">Equipo pagado en su totalidad</p>
                          <p className="mt-0.5 text-xs opacity-80">Podés entregarlo sin registrar otro cobro.</p>
                        </>
                      ) : !financial.priceDefined && financial.paid > 0 ? (
                        <>
                          <p className="font-semibold">{`Anticipo recibido: ${formatCurrency(financial.paid)}`}</p>
                          <p className="mt-0.5 text-xs opacity-80">El precio final todavía está pendiente; el saldo se calculará cuando lo definas.</p>
                        </>
                      ) : financial.paid > 0 ? (
                        <>
                          <p className="font-semibold">{`Anticipo recibido: ${formatCurrency(financial.paid)}`}</p>
                          <p className="mt-0.5 text-xs opacity-80">{`Saldo pendiente al entregar: ${formatCurrency(financial.balance)}`}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">Sin pagos registrados</p>
                          <p className="mt-0.5 text-xs opacity-80">
                            {financial.priceDefined
                              ? `Saldo pendiente: ${formatCurrency(financial.balance)}`
                              : 'El saldo se calculará cuando definas el precio final.'}
                          </p>
                        </>
                      )}
                    </div>
                    <dl className="divide-y divide-emerald-200/80 rounded-lg border border-emerald-200 bg-background/80 text-sm dark:divide-emerald-900/60 dark:border-emerald-900/60">
                      <div className="flex items-center justify-between px-3 py-2">
                        <dt className="text-muted-foreground">Total</dt>
                        <dd className="font-semibold tabular-nums">
                          {financial.priceDefined ? formatCurrency(financial.total) : 'Precio pendiente'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <dt className="text-muted-foreground">{financial.priceDefined ? 'Pagado' : 'Anticipo recibido'}</dt>
                        <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(financial.paid)}</dd>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <dt className="font-medium">Pendiente</dt>
                        <dd className={cn(
                          'font-bold tabular-nums',
                          financial.balance !== null && financial.balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300',
                        )}>
                          {financial.priceDefined ? formatCurrency(financial.balance) : 'Por calcular'}
                        </dd>
                      </div>
                    </dl>
                    {repair.finalCost === null || repair.finalCost === undefined ? (
                      <p className="text-muted-foreground text-[11px] leading-snug">
                        * Precio final pendiente — el saldo se calculará al definirlo
                      </p>
                    ) : (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-background/60 p-2 text-xs">
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Servicios</dt><dd className="font-semibold tabular-nums">{formatCurrency(lineTotals.services)}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Repuestos cobrados</dt><dd className="font-semibold tabular-nums">{formatCurrency(lineTotals.chargedParts)}</dd></div>
                        {(repair.laborCost || 0) > 0 && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Mano de obra adicional</dt><dd className="font-semibold tabular-nums">{formatCurrency(repair.laborCost || 0)}</dd></div>}
                        {showSensitiveData && lineTotals.includedInternal > 0 && <div className="col-span-2 flex justify-between gap-2 border-t pt-1 text-amber-700 dark:text-amber-300"><dt>Material incluido · costo interno</dt><dd className="font-semibold tabular-nums">{formatCurrency(lineTotals.includedInternal)}</dd></div>}
                      </dl>
                    )}

                    {onQuickPay && financial.canCollect && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm mt-1"
                        onClick={() => {
                          onClose()
                          onQuickPay(repair)
                        }}
                      >
                        <DollarSign className="h-4 w-4" />
                        {financial.priceDefined
                          ? `Pagar monto pendiente (${formatCurrency(financial.balance)})`
                          : financial.paid > 0 ? 'Registrar otro adelanto' : 'Registrar adelanto'}
                      </Button>
                    )}
                  </div>
                </section>

                {repair.closeout && (
                  <section aria-labelledby="repair-closeout-title" className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                    <h3 id="repair-closeout-title" className="text-sm font-semibold">Cierre sin reparación</h3>
                    <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                      {repair.closeout.outcome === 'withdrawn' ? 'Retirado sin reparar' : 'No fue posible reparar'}
                    </p>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between gap-3"><dt>Cargo final</dt><dd className="font-semibold">{formatCurrency(repair.closeout.finalCharge)}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Pagado antes del cierre</dt><dd>{formatCurrency(repair.closeout.paidBefore)}</dd></div>
                      <div className="flex justify-between gap-3"><dt>{repair.closeout.settlementKind === 'store_credit' ? 'Saldo a favor creado' : repair.closeout.settlementKind === 'refund' ? 'Devuelto al cliente' : repair.closeout.settlementKind === 'outstanding' ? 'Saldo pendiente' : 'Ajuste del cierre'}</dt><dd className="font-semibold">{formatCurrency(repair.closeout.settlementAmount)}</dd></div>
                    </dl>
                    {repair.closeout.parts.length > 0 && <div className="mt-3 space-y-1 border-t border-amber-200 pt-3 text-xs dark:border-amber-900/60">
                      {repair.closeout.parts.map((part) => <p key={part.repairPartId}>{part.name} · {part.disposition === 'consumed' ? 'Consumido' : 'Reintegrado al inventario'}</p>)}
                    </div>}
                    {repair.closeout.reason && <p className="mt-3 text-xs text-muted-foreground">Motivo: {repair.closeout.reason}</p>}
                  </section>
                )}

                {repair.payments && repair.payments.length > 0 && (
                  <div className="rounded-xl border bg-card p-4 shadow-sm" data-help-id="repair-payment-history">
                    <h3 className="text-sm font-semibold" data-help-id="repair-audit-summary">Historial de pagos</h3>
                    <div className="mt-3 space-y-3">
                      {repair.payments.map((payment) => (
                        <div key={payment.id} className="rounded-lg border p-3 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold capitalize">{payment.method === 'mixed' ? 'Pago mixto' : payment.method}</span>
                            <span className="font-bold tabular-nums">{formatCurrency(payment.amount)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap justify-between gap-2 text-muted-foreground">
                            <span>{format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                            {payment.reference && <span>Ref. {payment.reference}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cliente */}
                <div className="rounded-xl border bg-card p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                      {((repair.customer?.name || 'Cliente')
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-sm">{repair.customer?.name || 'Cliente Registrado'}</p>
                      <p className="text-xs text-muted-foreground">Cliente de la orden</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {repair.customer?.phone && (
                      <a
                        href={`tel:${repair.customer.phone}`}
                        className="flex items-center gap-2.5 text-foreground/90 hover:text-primary transition-colors"
                      >
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        {repair.customer.phone}
                      </a>
                    )}
                    {repair.customer?.email && (
                      <a
                        href={`mailto:${repair.customer.email}`}
                        className="flex items-center gap-2.5 text-foreground/90 hover:text-primary transition-colors break-all"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        {repair.customer.email}
                      </a>
                    )}
                  </div>
                  {repair.customer?.phone && (
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
                    <RepairWarrantyCase
                      key={warrantyCaseVersion}
                      repairId={repair.id}
                      onClaim={() => setWarrantyClaimOpen(true)}
                    />
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
              <main data-testid="repair-detail-sections" className="order-1 w-full min-w-0 flex-1 lg:order-2">
                <Tabs defaultValue="diagnostic" className="w-full">
                  <TabsList className="sticky top-0 z-10 h-auto w-full justify-start overflow-x-auto bg-background/95 p-1 backdrop-blur">
                    <TabsTrigger value="diagnostic" className="min-h-11 shrink-0 text-xs sm:min-h-9 sm:text-sm">
                      Diagnóstico
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="min-h-11 shrink-0 text-xs sm:min-h-9 sm:text-sm">
                      Costos y Piezas
                    </TabsTrigger>
                    <TabsTrigger value="history" className="min-h-11 shrink-0 text-xs sm:min-h-9 sm:text-sm gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      <span>Historial y Bitácora</span>
                    </TabsTrigger>
                    <TabsTrigger value="images" className="min-h-11 shrink-0 text-xs sm:min-h-9 sm:text-sm">
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
                    <RepairCostSummary
                      summary={repairCostSummary}
                      editable={activeRepair.status !== 'cancelado' && activeRepair.status !== 'entregado'}
                      repairId={activeRepair.id}
                      onEdit={() => setIsCostsEditorOpen(true)}
                      correctable={isAdmin && activeRepair.status === 'entregado'}
                      onCorrectInternalCost={activeRepair.parts.some((part) => Boolean(part.databaseId)) ? () => setIsInternalCostCorrectionOpen(true) : undefined}
                      onCorrectFinalPrice={() => setIsFinalPriceCorrectionOpen(true)}
                    />
                    {onQuickPay && financial.canCollect && (
                      <Button
                        type="button"
                        className="w-full bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                        onClick={() => { onClose(); onQuickPay(activeRepair) }}
                      >
                        <DollarSign className="mr-2 h-4 w-4" />
                        {financial.priceDefined
                          ? `Cobrar saldo pendiente (${formatCurrency(financial.balance)})`
                          : financial.paid > 0 ? 'Registrar otro adelanto' : 'Registrar adelanto'}
                      </Button>
                    )}
                  </TabsContent>

                  {/* Historial del Celular, Eventos y Bitácora */}
                  <TabsContent value="history" className="mt-4 space-y-4">
                    <DeviceHistoryTimeline
                      repair={activeRepair}
                      onOpenWarrantyModal={() => setWarrantyClaimOpen(true)}
                      onNoteAdded={(notes) => {
                        setLocalRepair((prev) => (prev ? { ...prev, notes } : null))
                      }}
                      onSelectPreviousRepair={(prevRepair) => {
                        setLocalRepair(prevRepair)
                      }}
                    />
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

        <DialogFooter data-testid="repair-detail-actions" className="border-t bg-background px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:grid max-sm:grid-cols-2 max-sm:gap-2 sm:flex sm:flex-wrap sm:justify-end sm:px-4 sm:py-3 shrink-0">
          <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-9">
            Cerrar
          </Button>

          {onEdit && (
            <Button
              variant="outline"
              className="min-h-11 gap-2 sm:hidden"
              onClick={() => {
                if (activeRepair.status === 'entregado') setDeliveredEditWarningOpen(true)
                else onEdit(activeRepair)
              }}
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}

          <>
              {onQuickPay && financial.canCollect && (
                <Button
                  variant="default"
                  className="min-h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold max-sm:col-span-2 sm:min-h-9"
                  onClick={() => {
                    onClose()
                    onQuickPay(repair)
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  {!financial.priceDefined
                    ? 'Registrar adelanto'
                    : repair.status === 'entregado'
                      ? 'Cobrar saldo'
                      : `Pagar monto pendiente (${formatCurrency(financial.balance)})`}
                </Button>
              )}
              {repair.status !== 'entregado' && repair.status !== 'cancelado' && (
              <Button
                variant="outline"
                className="min-h-11 gap-2 sm:min-h-9"
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
              )}
              {onDeliver && repair.status === 'listo' && (
                <Button
                  variant="outline"
                  className="min-h-11 gap-2 sm:min-h-9"
                  onClick={() => {
                    onClose()
                    onDeliver(repair)
                  }}
                >
                  <PackageCheck className="h-4 w-4" />
                  <span data-help-id="repair-delivery">Entregar</span>
                </Button>
              )}
            </>

        </DialogFooter>

        <CreateAfterSalesCaseDialog
          open={warrantyClaimOpen}
          onOpenChange={setWarrantyClaimOpen}
          sourceType="repair"
          repairId={repair.id}
          customerId={repair.customer?.id}
          reference={repair.ticketNumber || repair.id.slice(0, 8)}
          subject={[repair.brand, repair.model].filter(Boolean).join(' ') || repair.device}
          customerName={repair.customer?.name}
          allowedRequestTypes={['repair_warranty']}
          warrantyExpired={getWarrantyStatus(repair.warrantyExpiresAt) === 'expired'}
          warrantyExpiresLabel={
            repair.warrantyExpiresAt ? formatWarrantyExpiration(repair.warrantyExpiresAt) : null
          }
          onCreated={() => setWarrantyCaseVersion((version) => version + 1)}
        />
        <RepairCostsEditorDialog
          open={isCostsEditorOpen}
          repair={activeRepair}
          maxDiscountPercent={settings.repairMaxDiscountPercent}
          laborTaxRate={configuredTaxRate}
          onOpenChange={setIsCostsEditorOpen}
          onSaved={async () => {
            await onCostSaved?.()
          }}
        />
        <RepairInternalCostCorrectionDialog
          open={isInternalCostCorrectionOpen}
          repair={activeRepair}
          onOpenChange={setIsInternalCostCorrectionOpen}
          onSaved={async () => {
            await onCostSaved?.()
          }}
        />
        <RepairFinalPriceCorrectionDialog
          open={isFinalPriceCorrectionOpen}
          repair={activeRepair}
          onOpenChange={setIsFinalPriceCorrectionOpen}
          onSaved={async () => { await onCostSaved?.() }}
        />
      </DialogContent>
    </Dialog>

    {/* Modal de Advertencia al Intentar Editar Reparación Entregada */}
    <Dialog open={deliveredEditWarningOpen} onOpenChange={setDeliveredEditWarningOpen}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-950 border-amber-300 dark:border-amber-800/80 shadow-2xl">
        <div className="p-5 pb-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-transparent border-b border-amber-200 dark:border-amber-800/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20 shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-extrabold text-amber-950 dark:text-amber-100">
                Reparación Entregada y Cerrada
              </DialogTitle>
              <DialogDescription className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                Orden #{activeRepair.ticketNumber || activeRepair.id.slice(0, 8).toUpperCase()} · Cliente: {activeRepair.customer?.name || 'Cliente'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <div className="bg-amber-50/80 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-1.5">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              ⚠️ ¿Por qué no se debe editar directamente una orden entregada?
            </p>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
              Esta orden ya fue finalizada, cobrada y retirada. Los repuestos utilizados salieron del inventario y los costos fueron asentados en caja. Alterar la orden original alteraría el balance histórico del taller.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ¿Cómo proceder si el cliente tiene un reclamo o reingreso?
            </p>
            
            <div className="space-y-2 text-[11px]">
              <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="flex h-5 w-5 rounded-full bg-amber-600 text-white font-bold items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Abrir Reclamo de Garantía (Recomendado)
                  </span>
                  Crea un caso post-venta vinculado al equipo sin alterar la orden original ni duplicar cargos.
                </div>
              </div>

              <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="flex h-5 w-5 rounded-full bg-amber-600 text-white font-bold items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Evaluación Técnica de Cobertura
                  </span>
                  El taller determina si la falla corresponde a repuesto defectuoso o mano de obra con garantía.
                </div>
              </div>

              <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="flex h-5 w-5 rounded-full bg-amber-600 text-white font-bold items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    Resolución y Trazabilidad
                  </span>
                  Se genera el reingreso o cambio de pieza con cobertura del 100% o porcentaje aplicable.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDeliveredEditWarningOpen(false)
              if (onEdit) {
                onClose()
                onEdit(activeRepair)
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Continuar a edición de datos menores
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeliveredEditWarningOpen(false)}
              className="text-xs"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setDeliveredEditWarningOpen(false)
                setWarrantyClaimOpen(true)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <Shield className="h-3.5 w-3.5" />
              Procesar como Garantía
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
