'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Package, 
  User, 
  Calendar, 
  DollarSign, 
  Shield, 
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageCircle,
  Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PublicRepair } from '@/types/public'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Configuration for status visual representation
const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  bg: string;
  icon: any;
  description: string;
  stepIndex: number;
}> = {
  recibido: { 
    label: 'Recibido', 
    color: 'text-blue-600', 
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: Package,
    description: 'Tu dispositivo ha sido recibido en nuestro taller.',
    stepIndex: 0
  },
  diagnostico: { 
    label: 'En Diagnóstico', 
    color: 'text-purple-600', 
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    icon:  Clock,
    description: 'Estamos evaluando el problema de tu equipo.',
    stepIndex: 1
  },
  reparacion: { 
    label: 'En Reparación', 
    color: 'text-orange-600', 
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    icon: WrenchIcon,
    description: 'Nuestros técnicos están trabajando en tu dispositivo.',
    stepIndex: 2
  },
  pausado: { 
    label: 'Pausado', 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    icon: AlertCircle,
    description: 'La reparación está pausada. Posiblemente esperamos repuestos o tu aprobación.',
    stepIndex: 2 // Keeps in repair phase visually but marked distinctively
  },
  listo: { 
    label: 'Listo para Retirar', 
    color: 'text-green-600', 
    bg: 'bg-green-50 dark:bg-green-950/30',
    icon: CheckCircle2,
    description: '¡Tu equipo está listo! Puedes pasar a retirarlo.',
    stepIndex: 3
  },
  entregado: { 
    label: 'Entregado', 
    color: 'text-gray-600', 
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    icon: Package,
    description: 'Reparación finalizada y entregada.',
    stepIndex: 4
  },
  cancelado: { 
    label: 'Cancelado', 
    color: 'text-red-600', 
    bg: 'bg-red-50 dark:bg-red-950/30',
    icon: AlertCircle,
    description: 'La reparación ha sido cancelada.',
    stepIndex: -1
  }
}

// Timeline steps definition
const TIMELINE_STEPS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'reparacion', label: 'Reparación' },
  { id: 'listo', label: 'Listo' },
  { id: 'entregado', label: 'Entregado' }
]

function WrenchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

export default function RepairDetailPage({ params }: { params: { ticketId: string } }) {
  const router = useRouter()
  const [repair, setRepair] = useState<PublicRepair | null>(null)
  const [loading, setLoading] = useState(true)
  
  const fetchRepairDetails = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/public/repairs/${id}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        try {
          const text = await response.text()
          console.error('Detail non-JSON response', {
            status: response.status,
            contentType,
            bodyPreview: text.slice(0, 300)
          })
        } catch {}
        toast.error('Error al cargar reparación (respuesta no válida)')
        router.push('/mis-reparaciones')
        return
      }
      const data = await response.json()

      if (!data.success) {
        toast.error(data.error || 'Error al cargar reparación')
        router.push('/mis-reparaciones')
        return
      }

      setRepair(data.data)
    } catch (error) {
      console.error('Error fetching repair:', error)
      toast.error('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchRepairDetails(params.ticketId)
  }, [params.ticketId, fetchRepairDetails])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(price)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-PY', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleWhatsAppClick = () => {
    if (!repair) return
    const message = `Hola, quisiera consultar sobre mi reparación con ticket *${repair.ticketNumber}* (${repair.brand} ${repair.model})`
    const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '595981234567'
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (loading) {
    return (
      <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!repair) return null

  const statusConfig = STATUS_CONFIG[repair.status] || STATUS_CONFIG.recibido
  const StatusIcon = statusConfig.icon
  const currentStepIndex = statusConfig.stepIndex

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Navigation */}
      <Button variant="ghost" onClick={() => router.push('/mis-reparaciones')} className="pl-0 hover:pl-2 transition-all">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a buscar
      </Button>

      {/* Hero Status Section */}
      <div className={cn("rounded-3xl p-8 text-center sm:text-left sm:flex sm:items-center sm:justify-between shadow-sm border", statusConfig.bg)}>
        <div className="space-y-4">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className={cn("p-3 rounded-full bg-white/80 shadow-sm", statusConfig.color)}>
              <StatusIcon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Estado Actual</p>
              <h1 className={cn("text-3xl font-bold", statusConfig.color)}>{statusConfig.label}</h1>
            </div>
          </div>
          <p className="text-lg opacity-90 max-w-xl">
            {statusConfig.description}
          </p>
        </div>
        
        <div className="mt-6 sm:mt-0 flex flex-col gap-3 min-w-[200px]">
          <div className="text-center sm:text-right">
            <p className="text-sm opacity-70">Ticket #</p>
            <p className="text-2xl font-mono font-bold">{repair.ticketNumber}</p>
          </div>
              <div className="bg-white/50 rounded-lg p-3 text-center sm:text-right">
                <p className="text-xs uppercase font-bold opacity-70">
                  {repair.finalCost ? 'Total Final' : 'Presupuesto Estimado'}
                </p>
                <p className={cn("text-xl font-bold", repair.finalCost ? "text-green-700" : "text-blue-700")}>
                  {formatPrice(repair.finalCost || repair.estimatedCost)}
                </p>
              </div>
        </div>
      </div>

      {/* Progress Timeline (Stepper) */}
      {repair.status !== 'cancelado' && (
        <div className="py-4 overflow-x-auto">
          <div className="flex justify-between min-w-[600px] relative px-4">
             {/* Progress Bar Background */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -z-10 -translate-y-1/2" />
            
            {/* Active Progress Bar */}
            <div 
              className="absolute top-1/2 left-0 h-1 bg-primary -z-10 -translate-y-1/2 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, (currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100))}%` }}
            />

            {TIMELINE_STEPS.map((step, index) => {
              const isActive = index <= currentStepIndex
              const isCurrent = index === currentStepIndex
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2 z-10">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                    isActive ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-muted-foreground/30 text-muted-foreground",
                    isCurrent && "ring-4 ring-primary/20"
                  )}>
                    {isActive ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs">{index + 1}</span>}
                  </div>
                  <span className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Detalles del Dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
               <div>
                 <p className="text-sm text-muted-foreground mb-1">Equipo</p>
                 <p className="font-semibold text-lg">{repair.device}</p>
                 <p className="text-muted-foreground">{repair.brand} {repair.model}</p>
               </div>
               <div>
                 <p className="text-sm text-muted-foreground mb-1">Problema Reportado</p>
                 <div className="bg-muted/50 p-3 rounded-lg text-sm">
                   {repair.issue}
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Status History */}
          {repair.statusHistory && repair.statusHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Historial de Actividad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative border-l-2 border-muted pl-6 space-y-8 py-2">
                  {repair.statusHistory.map((entry, index) => {
                    const entryConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.recibido
                    return (
                      <div key={index} className="relative">
                        <span className={cn(
                          "absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-background",
                          index === 0 ? "bg-primary" : "bg-muted-foreground"
                        )} />
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                          <p className="font-semibold text-sm">{entryConfig.label}</p>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-muted-foreground mt-1 bg-muted/30 p-2 rounded">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Ingreso</span>
                <span className="text-sm">{formatDate(repair.createdAt)}</span>
              </div>
              {repair.estimatedCompletion && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Estimado</span>
                  <span className="text-sm">{formatDate(repair.estimatedCompletion)}</span>
                </div>
              )}
              {repair.status === 'entregado' && repair.completedAt && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entregado</span>
                  <span className="text-sm">{formatDate(repair.completedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Quick Actions */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <Button 
                onClick={handleWhatsAppClick} 
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 text-base shadow-md transition-transform active:scale-95"
              >
                <MessageCircle className="h-5 w-5" />
                Consultar por WhatsApp
              </Button>
              <Button 
                onClick={() => navigator.clipboard.writeText(repair.ticketNumber)}
                variant="outline"
                className="w-full mt-3 gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar número de ticket
              </Button>
              <p className="text-xs text-center mt-3 text-muted-foreground">
                ¿Tienes dudas? Escríbenos directamente citando tu ticket.
              </p>
            </CardContent>
          </Card>

          {/* Financials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Costo Estimado</span>
                  {!repair.finalCost && (
                    <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 py-0 mt-0.5 border-blue-200 text-blue-700 bg-blue-50/50">
                      En evaluación
                    </Badge>
                  )}
                </div>
                <span className="font-medium">{formatPrice(repair.estimatedCost)}</span>
              </div>
              
              {repair.finalCost ? (
                <div className="flex justify-between items-center py-2 border-b bg-green-50/30 -mx-2 px-2 rounded-md">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-green-900">Costo Final</span>
                    <Badge className="w-fit text-[10px] h-4 px-1 py-0 mt-0.5 bg-green-600">Confirmado</Badge>
                  </div>
                  <span className="font-bold text-lg text-green-700">{formatPrice(repair.finalCost)}</span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic px-1">
                  * El costo final se confirmará una vez finalizado el diagnóstico técnico.
                </p>
              )}

              {repair.warrantyMonths && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-3 mt-4">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Garantía Incluida</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {repair.warrantyMonths} meses de garantía sobre la reparación realizada.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technician */}
          {repair.technician && (
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Técnico Asignado</p>
                  <p className="font-medium">{repair.technician.name}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
