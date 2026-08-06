'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  ChevronRight,
  Copy,
  CreditCard,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Star,
  Wrench,
  X,
  CheckCircle2,
  Clock,
  PackageCheck,
  AlertCircle,
  Receipt,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Customer } from '@/hooks/use-customer-state'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerQuickViewProps {
  customer: Customer | null
  open: boolean
  onClose: () => void
  onViewDetail: (customer: Customer) => void
  onEdit: (customer: Customer) => void
}

interface RepairSummary {
  id: string
  ticket_number: string | null
  device_brand: string | null
  device_model: string | null
  problem_description?: string | null
  status: string
  final_cost: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  payment_status?: string | null
  delivered_at?: string | null
  created_at: string
}

interface RepairStats {
  totalRepairs: number
  totalSpent: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dot: string }> = {
  recibido: { 
    label: 'Recibido', 
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400' 
  },
  diagnostico: { 
    label: 'Diagnóstico', 
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500' 
  },
  reparacion: { 
    label: 'En reparación', 
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500' 
  },
  pausado: { 
    label: 'Pausado', 
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-400' 
  },
  listo: { 
    label: 'Listo para retiro', 
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold',
    dot: 'bg-emerald-500' 
  },
  entregado: { 
    label: 'Entregado', 
    badgeClass: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800',
    dot: 'bg-green-600' 
  },
  cancelado: { 
    label: 'Cancelado', 
    badgeClass: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800',
    dot: 'bg-red-500' 
  },
}

const SEGMENT_CONFIG: Record<string, { label: string; class: string }> = {
  vip: { label: 'VIP', class: 'bg-purple-500/20 text-purple-300 border-purple-400/30' },
  wholesale: { label: 'Mayorista', class: 'bg-orange-500/20 text-orange-300 border-orange-400/30' },
  business: { label: 'Empresa', class: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30' },
  premium: { label: 'Premium', class: 'bg-blue-500/20 text-blue-300 border-blue-400/30' },
  regular: { label: 'Regular', class: 'bg-slate-500/20 text-slate-300 border-slate-400/20' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount?: number | null): string {
  if (!amount) return '₲ 0'
  return `₲ ${amount.toLocaleString('es-PY')}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`
  return `Hace ${Math.floor(days / 365)} años`
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copiado al portapapeles`)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerQuickView({ customer, open, onClose, onViewDetail, onEdit }: CustomerQuickViewProps) {
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [stats, setStats] = useState<RepairStats>({ totalRepairs: 0, totalSpent: 0 })
  const [loadingRepairs, setLoadingRepairs] = useState(false)

  useEffect(() => {
    if (!open || !customer) {
      setRepairs([])
      setStats({ totalRepairs: 0, totalSpent: 0 })
      return
    }

    const controller = new AbortController()

    const fetchRepairs = async () => {
      setLoadingRepairs(true)
      try {
        const res = await fetch(`/api/customers/${customer.id}/repairs?limit=5`, {
          signal: controller.signal,
        })
        const data = await res.json()

        if (data?.repairs) {
          setRepairs(data.repairs)
          setStats(data.stats ?? { totalRepairs: 0, totalSpent: 0 })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setRepairs([])
      } finally {
        setLoadingRepairs(false)
      }
    }

    fetchRepairs()
    return () => controller.abort()
  }, [open, customer])

  if (!customer) return null

  const initials = customer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const activeRepairs = repairs.filter(r => !['entregado', 'cancelado'].includes(r.status.toLowerCase()))
  const segment = SEGMENT_CONFIG[customer.segment] || SEGMENT_CONFIG.regular
  const phoneClean = customer.phone?.replace(/\D/g, '') || ''
  const whatsappUrl = phoneClean ? `https://wa.me/${phoneClean}` : null
  const lastActivity = customer.last_activity || customer.last_visit || customer.registration_date

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!block w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Detalle de {customer.name}</DialogTitle>

        {/* ── Header Elegante ── */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 pb-5 pt-5 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950 border-b border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg ring-2 ring-white/20">
              {initials}
              {customer.segment === 'vip' && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 p-1 text-slate-950 shadow">
                  <Star className="h-3 w-3 fill-slate-950" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 truncate text-lg font-bold text-white tracking-tight">
                {customer.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', segment.class)}>
                  {segment.label}
                </span>
                {(() => {
                  const normalizedStatus = String(customer.status || 'active').toLowerCase().trim()
                  const isActive = normalizedStatus === 'active' || normalizedStatus === 'activo'
                  const isSuspended = normalizedStatus === 'suspended' || normalizedStatus === 'suspendido'

                  if (isActive) {
                    return (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activo
                      </span>
                    )
                  }
                  if (isSuspended) {
                    return (
                      <span className="inline-flex items-center rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        Suspendido
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center rounded-md bg-slate-500/20 border border-slate-500/30 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      Inactivo
                    </span>
                  )
                })()}
                {customer.profile_id ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                    <ShieldCheck className="h-3 w-3" />
                    Cuenta Vinculada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/20 border border-slate-500/30 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    <Link2 className="h-3 w-3" />
                    Sin cuenta
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Quick Action Chips */}
          <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-white/10">
            {customer.phone && (
              <button
                type="button"
                onClick={() => copyToClipboard(customer.phone, 'Teléfono')}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80 transition-all hover:bg-white/20 hover:text-white"
                title="Click para copiar teléfono"
              >
                <Phone className="h-3.5 w-3.5 text-blue-400" />
                <span>{customer.phone}</span>
                <Copy className="h-3 w-3 opacity-40 ml-0.5" />
              </button>
            )}
            {customer.email && (
              <button
                type="button"
                onClick={() => copyToClipboard(customer.email, 'Email')}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80 transition-all hover:bg-white/20 hover:text-white"
                title="Click para copiar email"
              >
                <Mail className="h-3.5 w-3.5 text-purple-400" />
                <span className="max-w-[140px] truncate">{customer.email}</span>
                <Copy className="h-3 w-3 opacity-40 ml-0.5" />
              </button>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/30"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto overscroll-contain">
          {/* Métricas del Cliente */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50 dark:divide-slate-800/80 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center py-3.5 px-2">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{customer.total_purchases || 0}</p>
              <p className="text-[11px] font-medium text-slate-500">Compras</p>
            </div>
            <div className="flex flex-col items-center py-3.5 px-2">
              <Wrench className="h-4 w-4 text-amber-500" />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{stats.totalRepairs || customer.total_repairs || 0}</p>
              <p className="text-[11px] font-medium text-slate-500">Reparaciones</p>
            </div>
            <div className="flex flex-col items-center py-3.5 px-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalSpent || customer.lifetime_value || 0)}</p>
              <p className="text-[11px] font-medium text-slate-500">Total Gastado</p>
            </div>
          </div>

          {/* Sección de Reparaciones con Detalles de Estado, Costo, Retiro y Pago */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                Reparaciones Recientes
              </h3>
              {activeRepairs.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {activeRepairs.length} en proceso
                </span>
              )}
            </div>

            {loadingRepairs ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : repairs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                <Wrench className="mx-auto h-6 w-6 opacity-40 mb-1.5" />
                <p>Sin reparaciones registradas para este cliente</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {repairs.map((repair) => {
                  const statusKey = repair.status?.toLowerCase() || 'recibido'
                  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.recibido
                  const deviceName = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || 'Dispositivo'
                  const cost = (repair.final_cost ?? repair.estimated_cost) || 0
                  
                  // Estados clave pedidos por el usuario:
                  const isDelivered = statusKey === 'entregado' || Boolean(repair.delivered_at)
                  const isReadyForPickup = statusKey === 'listo'
                  const isPaid = repair.payment_status === 'pagado' || (repair.paid_amount != null && repair.paid_amount >= cost && cost > 0)
                  const isPartialPaid = !isPaid && (repair.paid_amount ?? 0) > 0

                  return (
                    <div
                      key={repair.id}
                      className="group rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                    >
                      {/* Fila 1: Dispositivo + Ticket + Costo */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusCfg.dot)} />
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {deviceName}
                            </p>
                            {repair.ticket_number && (
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 h-4 bg-slate-100 dark:bg-slate-800">
                                #{repair.ticket_number}
                              </Badge>
                            )}
                          </div>
                          {repair.problem_description && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400 pl-4">
                              {repair.problem_description}
                            </p>
                          )}
                        </div>

                        {/* Costo de la reparación */}
                        <div className="text-right shrink-0">
                          <span className="font-bold tabular-nums text-xs text-slate-900 dark:text-slate-100">
                            {formatCurrency(cost)}
                          </span>
                        </div>
                      </div>

                      {/* Fila 2: Badges de Estado + Pago + Retiro */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                        {/* 1. Estado General */}
                        <Badge variant="outline" className={cn('gap-1 px-2 py-0.5 text-[10px]', statusCfg.badgeClass)}>
                          {statusCfg.label}
                        </Badge>

                        {/* 2. Estado de Retiro/Entrega */}
                        {isDelivered ? (
                          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-800">
                            <PackageCheck className="h-3 w-3 text-green-600" />
                            Retirado
                          </Badge>
                        ) : isReadyForPickup ? (
                          <Badge variant="outline" className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 animate-pulse">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Listo para Retiro
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200">
                            <Clock className="h-3 w-3" />
                            En Taller
                          </Badge>
                        )}

                        {/* 3. Estado de Pago */}
                        {isPaid ? (
                          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            <DollarSign className="h-3 w-3 text-blue-600" />
                            Pagado
                          </Badge>
                        ) : isPartialPaid ? (
                          <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200">
                            <Receipt className="h-3 w-3 text-amber-600" />
                            Pago Parcial ({formatCurrency(repair.paid_amount)})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200">
                            <AlertCircle className="h-3 w-3 text-orange-500" />
                            Pendiente de Pago
                          </Badge>
                        )}

                        <span className="ml-auto text-[10px] text-slate-400">
                          {timeAgo(repair.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Info adicional (Dirección, Nota, Última actividad) */}
          <div className="space-y-2 px-4 pb-4">
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{customer.address || customer.city}</span>
              </div>
            )}
            {lastActivity && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>Última actividad: {timeAgo(lastActivity)}</span>
              </div>
            )}
            {customer.notes && (
              <div className="mt-2 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-900 border border-amber-200/80 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/40">
                <span className="font-bold">Nota del cliente: </span>
                <p className="mt-0.5 line-clamp-2">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/40">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-sm"
            onClick={() => { onClose(); onViewDetail(customer) }}
          >
            Ver detalle completo
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { onClose(); onEdit(customer) }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
