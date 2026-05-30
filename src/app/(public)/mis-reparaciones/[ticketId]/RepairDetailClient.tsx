'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  Banknote,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PublicRepair } from '@/types/public'
import { formatCurrency } from '@/lib/currency'
import { REPAIR_STATUS_CONFIG, REPAIR_TIMELINE_STEPS, type RepairStatusKey } from '@/lib/constants/repair-status'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) throw new Error('Invalid response format')
  if (res.status === 401) throw new SessionExpiredError('Sesión expirada')
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al cargar datos')
  return data.data
}

class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
interface RepairDetailClientProps {
  ticketId: string
  initialRepair: PublicRepair | null
  verifyHash: string | null
}

export default function RepairDetailClient({ ticketId, initialRepair, verifyHash }: RepairDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [qrVerified, setQrVerified] = useState<boolean | null>(verifyHash && initialRepair ? true : null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const hasShownVerifiedToast = useRef(false)
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix =
    pathSegments.length > 2 && pathSegments[1] === 'mis-reparaciones'
      ? `/${pathSegments[0]}`
      : ''
  const repairsHref = `${tenantPrefix}/mis-reparaciones`
  const organizationSlug = tenantPrefix.replace('/', '')
  const repairApiUrl =
    `/api/public/repairs/${encodeURIComponent(ticketId)}` +
    `?${new URLSearchParams({
      ...(verifyHash ? { verify: verifyHash } : {}),
      ...(organizationSlug ? { org: organizationSlug } : {}),
    }).toString()}`

  const { data: repair, error, isLoading, mutate } = useSWR<PublicRepair>(
    repairApiUrl,
    fetcher,
    {
      fallbackData: initialRepair ?? undefined,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      refreshInterval: sessionExpired ? 0 : 120000,
      onError: (err) => {
        if (err instanceof SessionExpiredError) {
          setSessionExpired(true)
        }
      },
    },
  )

  useEffect(() => {
    if (!verifyHash || !repair || hasShownVerifiedToast.current) return
    setQrVerified(true)
    toast.success('Comprobante verificado correctamente', {
      description: 'Este es un comprobante autentico',
      duration: 5000,
    })
    hasShownVerifiedToast.current = true
  }, [verifyHash, repair])

  const formatDate = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('es-PY', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return (d: string) => fmt.format(new Date(d))
  }, [])

  const handleWhatsApp = () => {
    if (!repair) return
    const msg = `Hola, consulta sobre mi reparacion ticket *${repair.ticketNumber}* (${repair.brand} ${repair.model})`
    const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''
    if (!phone) return
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  /* Session expired ------------------------------------------------ */
  if (sessionExpired) {
    return (
      <div className="container max-w-lg py-20">
        <div className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl border bg-card shadow-sm">
          <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold">Sesión expirada</h2>
          <p className="text-muted-foreground">
            Tu sesión de consulta ha expirado. Por seguridad, necesitas verificar tu identidad nuevamente.
          </p>
          <Button onClick={() => router.push(repairsHref)} className="mt-2">
            Volver a verificar
          </Button>
        </div>
      </div>
    )
  }

  /* Loading -------------------------------------------------------- */
  if (isLoading && !repair) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando reparacion...</p>
        </div>
      </div>
    )
  }

  /* Error ---------------------------------------------------------- */
  if (error && !repair) {
    return (
      <div className="container max-w-lg py-20">
        <div className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl border bg-card shadow-sm">
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold">No se pudo cargar la reparación</h2>
          <p className="text-muted-foreground">
            {searchParams.get('verify')
              ? 'El enlace de verificación es inválido o ha expirado. Por favor intenta escanear el código nuevamente o busca tu reparación manualmente.'
              : 'No tienes permisos para ver esta reparación o el ticket no existe.'}
          </p>
          <div className="flex gap-3 mt-2">
            <Button onClick={() => mutate()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
            <Button onClick={() => router.push(repairsHref)} variant="outline">
              Volver a Buscar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!repair) return null

  const cfg = REPAIR_STATUS_CONFIG[(repair.status as RepairStatusKey)] || REPAIR_STATUS_CONFIG.recibido
  const StatusIcon = cfg.Icon
  const currentStep = cfg.stepIndex

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      {/* Back */}
      <button
        onClick={() => router.push(repairsHref)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      {/* QR Verification Badge */}
      {qrVerified && (
        <div className="mb-6 rounded-xl border p-4 flex items-center gap-3 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
          <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-900 dark:text-green-100">Comprobante Verificado</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Este es un comprobante auténtico emitido por {repair.ticketNumber}
            </p>
          </div>
        </div>
      )}

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
                {formatCurrency(repair.finalCost || repair.estimatedCost)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Stepper ---- */}
      {repair.status !== 'cancelado' && (
        <div className="mt-8 overflow-x-auto pb-2" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={REPAIR_TIMELINE_STEPS.length} aria-label={`Progreso: paso ${currentStep + 1} de ${REPAIR_TIMELINE_STEPS.length}`}>
          <div className="relative mx-auto flex min-w-[500px] max-w-2xl justify-between">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" />
            <div
              className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, (currentStep / (REPAIR_TIMELINE_STEPS.length - 1)) * 100))}%` }}
            />
            {REPAIR_TIMELINE_STEPS.map((step, i) => {
              const active = i <= currentStep
              const current = i === currentStep
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                      current && 'ring-4 ring-primary/20',
                    )}
                  >
                    {active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn('text-[11px] font-semibold uppercase tracking-wide', active ? 'text-primary' : 'text-muted-foreground')}>
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
                  const entryCfg = REPAIR_STATUS_CONFIG[entry.status as RepairStatusKey] || REPAIR_STATUS_CONFIG.recibido
                  return (
                    <div key={i} className="relative">
                      <span className={cn('absolute -left-[25px] top-1 h-3 w-3 rounded-full ring-2 ring-card', i === 0 ? entryCfg.bgDot : 'bg-muted-foreground/40')} />
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                        <p className="text-sm font-semibold text-foreground">{entryCfg.label}</p>
                        <time className="text-xs tabular-nums text-muted-foreground">{formatDate(entry.created_at)}</time>
                      </div>
                      {entry.note && (
                        <p className="mt-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{entry.note}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
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
            <p className="mt-3 text-center text-xs text-muted-foreground">Dudas? Escribinos citando tu ticket.</p>
          </section>

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
                    <Badge variant="outline" className="mt-0.5 h-4 border-blue-200 bg-blue-50/50 px-1 text-[10px] text-blue-700">En evaluacion</Badge>
                  )}
                </div>
                <dd className="font-medium">{formatCurrency(repair.estimatedCost)}</dd>
              </div>
              {repair.finalCost ? (
                <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                  <div>
                    <dt className="text-sm font-semibold text-green-800 dark:text-green-300">Costo Final</dt>
                    <Badge className="mt-0.5 h-4 bg-green-600 px-1 text-[10px]">Confirmado</Badge>
                  </div>
                  <dd className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(repair.finalCost)}</dd>
                </div>
              ) : (
                <p className="text-[11px] italic text-muted-foreground">* El costo final se confirma tras el diagnostico.</p>
              )}
            </dl>
            {repair.warrantyMonths && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/5 p-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Garantia Incluida</p>
                  <p className="text-xs text-muted-foreground">{repair.warrantyMonths} meses sobre la reparacion realizada.</p>
                </div>
              </div>
            )}
          </section>

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
