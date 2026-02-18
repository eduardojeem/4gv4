'use client'

import { use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeft,
  Package,
  User,
  Calendar,
  Shield,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageCircle,
  Copy,
  Wrench,
  CircleDot,
  Phone,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PublicRepair } from '@/types/public'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error('Invalid response format')
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al cargar datos')
  return data.data
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */
type StatusKey = 'recibido' | 'diagnostico' | 'reparacion' | 'pausado' | 'listo' | 'entregado' | 'cancelado'

const STATUS_CONFIG: Record<StatusKey, {
  label: string
  color: string
  bgCard: string
  bgDot: string
  Icon: React.FC<React.SVGProps<SVGSVGElement> & { className?: string }>
  description: string
  stepIndex: number
}> = {
  recibido: {
    label: 'Recibido',
    color: 'text-blue-600',
    bgCard: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
    bgDot: 'bg-blue-500',
    Icon: Package,
    description: 'Tu dispositivo ha sido recibido en nuestro taller.',
    stepIndex: 0,
  },
  diagnostico: {
    label: 'En Diagnostico',
    color: 'text-violet-600',
    bgCard: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900',
    bgDot: 'bg-violet-500',
    Icon: Clock,
    description: 'Estamos evaluando el problema de tu equipo.',
    stepIndex: 1,
  },
  reparacion: {
    label: 'En Reparacion',
    color: 'text-amber-600',
    bgCard: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
    bgDot: 'bg-amber-500',
    Icon: Wrench,
    description: 'Nuestros tecnicos estan trabajando en tu dispositivo.',
    stepIndex: 2,
  },
  pausado: {
    label: 'Pausado',
    color: 'text-yellow-600',
    bgCard: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900',
    bgDot: 'bg-yellow-500',
    Icon: AlertCircle,
    description: 'La reparacion esta pausada. Posiblemente esperamos repuestos o tu aprobacion.',
    stepIndex: 2,
  },
  listo: {
    label: 'Listo para Retirar',
    color: 'text-green-600',
    bgCard: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900',
    bgDot: 'bg-green-500',
    Icon: CheckCircle2,
    description: 'Tu equipo esta listo! Puedes pasar a retirarlo.',
    stepIndex: 3,
  },
  entregado: {
    label: 'Entregado',
    color: 'text-gray-600',
    bgCard: 'bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-900',
    bgDot: 'bg-gray-500',
    Icon: Package,
    description: 'Reparacion finalizada y entregada.',
    stepIndex: 4,
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-600',
    bgCard: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
    bgDot: 'bg-red-500',
    Icon: AlertCircle,
    description: 'La reparacion ha sido cancelada.',
    stepIndex: -1,
  },
}

const TIMELINE_STEPS = [
  { id: 'recibido', label: 'Recibido' },
  { id: 'diagnostico', label: 'Diagnostico' },
  { id: 'reparacion', label: 'Reparacion' },
  { id: 'listo', label: 'Listo' },
  { id: 'entregado', label: 'Entregado' },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function RepairDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const router = useRouter()
  const { ticketId } = use(params)

  const { data: repair, error, isLoading } = useSWR<PublicRepair>(
    `/api/public/repairs/${ticketId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      refreshInterval: 120000,
      onError: () => {
        toast.error('No se pudo cargar la reparacion')
        router.push('/mis-reparaciones')
      },
    },
  )

  const formatPrice = useMemo(() => {
    const fmt = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 })
    return (n: number) => fmt.format(n)
  }, [])

  const formatDate = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('es-PY', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return (d: string) => fmt.format(new Date(d))
  }, [])

  const handleWhatsApp = () => {
    if (!repair) return
    const msg = `Hola, consulta sobre mi reparacion ticket *${repair.ticketNumber}* (${repair.brand} ${repair.model})`
    const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '595981234567'
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  /* Loading -------------------------------------------------------- */
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando reparacion...</p>
        </div>
      </div>
    )
  }

  if (error || !repair) return null

  const cfg = STATUS_CONFIG[(repair.status as StatusKey)] || STATUS_CONFIG.recibido
  const StatusIcon = cfg.Icon
  const currentStep = cfg.stepIndex

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      {/* Back */}
      <button
        onClick={() => router.push('/mis-reparaciones')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      {/* ---- Status banner ---- */}
      <div className={cn('rounded-2xl border p-6 md:p-8', cfg.bgCard)}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm', cfg.color)}>
              <StatusIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Estado actual</p>
              <h1 className={cn('text-2xl font-bold md:text-3xl', cfg.color)}>{cfg.label}</h1>
              <p className="mt-1 max-w-md text-sm opacity-80">{cfg.description}</p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="md:text-right">
              <p className="text-xs font-medium uppercase tracking-wider opacity-50">Ticket</p>
              <p className="font-mono text-xl font-bold">{repair.ticketNumber}</p>
            </div>
            <div className="rounded-xl bg-white/60 px-4 py-2.5 text-center shadow-sm dark:bg-black/10 md:text-right">
              <p className="text-[10px] font-bold uppercase opacity-50">
                {repair.finalCost ? 'Total final' : 'Presupuesto estimado'}
              </p>
              <p className={cn('text-lg font-bold', repair.finalCost ? 'text-green-700' : cfg.color)}>
                {formatPrice(repair.finalCost || repair.estimatedCost)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Stepper ---- */}
      {repair.status !== 'cancelado' && (
        <div className="mt-8 overflow-x-auto pb-2">
          <div className="relative mx-auto flex min-w-[500px] max-w-2xl justify-between">
            {/* Track */}
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" />
            <div
              className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, (currentStep / (TIMELINE_STEPS.length - 1)) * 100))}%` }}
            />

            {TIMELINE_STEPS.map((step, i) => {
              const active = i <= currentStep
              const current = i === currentStep
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground',
                      current && 'ring-4 ring-primary/20',
                    )}
                  >
                    {active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wide',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- Body grid ---- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left col (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Device info */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Package className="h-5 w-5 text-primary" />
              Detalles del Dispositivo
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipo</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{repair.device}</p>
                <p className="text-sm text-muted-foreground">{repair.brand} {repair.model}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Problema Reportado</p>
                <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm text-foreground">{repair.issue}</p>
              </div>
            </div>
          </section>

          {/* Timeline */}
          {repair.statusHistory && repair.statusHistory.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                Historial de Actividad
              </h2>
              <div className="relative mt-5 space-y-6 border-l-2 border-border pl-6">
                {repair.statusHistory.map((entry, i) => {
                  const entryCfg = STATUS_CONFIG[entry.status as StatusKey] || STATUS_CONFIG.recibido
                  return (
                    <div key={i} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[25px] top-1 h-3 w-3 rounded-full ring-2 ring-card',
                          i === 0 ? entryCfg.bgDot : 'bg-muted-foreground/40',
                        )}
                      />
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                        <p className="text-sm font-semibold text-foreground">{entryCfg.label}</p>
                        <time className="text-xs tabular-nums text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </time>
                      </div>
                      {entry.note && (
                        <p className="mt-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <Button
              onClick={handleWhatsApp}
              className="h-12 w-full gap-2 bg-green-600 text-base font-semibold text-white shadow-md hover:bg-green-700 active:scale-[0.98]"
            >
              <MessageCircle className="h-5 w-5" />
              Consultar por WhatsApp
            </Button>
            <Button
              variant="outline"
              className="mt-3 w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(repair.ticketNumber)
                toast.success('Ticket copiado')
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar ticket
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Dudas? Escribinos citando tu ticket.
            </p>
          </section>

          {/* Dates */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              Fechas
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Ingreso</dt>
                <dd className="font-medium tabular-nums">{formatDate(repair.createdAt)}</dd>
              </div>
              {repair.estimatedCompletion && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Estimado</dt>
                  <dd className="font-medium tabular-nums">{formatDate(repair.estimatedCompletion)}</dd>
                </div>
              )}
              {repair.status === 'entregado' && repair.completedAt && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Entregado</dt>
                  <dd className="font-medium tabular-nums">{formatDate(repair.completedAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Financials */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Banknote className="h-4 w-4 text-primary" />
              Resumen Financiero
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <dt className="text-muted-foreground">Presupuesto</dt>
                  {!repair.finalCost && (
                    <Badge variant="outline" className="mt-0.5 h-4 border-blue-200 bg-blue-50/50 px-1 text-[10px] text-blue-700">
                      En evaluacion
                    </Badge>
                  )}
                </div>
                <dd className="font-medium">{formatPrice(repair.estimatedCost)}</dd>
              </div>

              {repair.finalCost ? (
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                  <div>
                    <dt className="text-sm font-semibold text-green-800 dark:text-green-300">Costo Final</dt>
                    <Badge className="mt-0.5 h-4 bg-green-600 px-1 text-[10px]">Confirmado</Badge>
                  </div>
                  <dd className="text-lg font-bold text-green-700 dark:text-green-400">{formatPrice(repair.finalCost)}</dd>
                </div>
              ) : (
                <p className="text-[11px] italic text-muted-foreground">
                  * El costo final se confirma tras el diagnostico.
                </p>
              )}
            </dl>

            {repair.warrantyMonths && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/5 p-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Garantia Incluida</p>
                  <p className="text-xs text-muted-foreground">
                    {repair.warrantyMonths} meses sobre la reparacion realizada.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Technician */}
          {repair.technician && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tecnico Asignado</p>
                  <p className="text-sm font-semibold text-foreground">{repair.technician.name}</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
