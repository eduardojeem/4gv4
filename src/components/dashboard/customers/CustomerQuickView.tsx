'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  status: string
  final_cost: number | null
  created_at: string
}

interface RepairStats {
  totalRepairs: number
  totalSpent: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  recibido: { label: 'Recibido', dot: 'bg-slate-400' },
  diagnostico: { label: 'Diagnóstico', dot: 'bg-blue-500' },
  reparacion: { label: 'En reparación', dot: 'bg-amber-500' },
  pausado: { label: 'Pausado', dot: 'bg-orange-400' },
  listo: { label: 'Listo', dot: 'bg-emerald-500' },
  entregado: { label: 'Entregado', dot: 'bg-green-700' },
  cancelado: { label: 'Cancelado', dot: 'bg-red-500' },
}

const SEGMENT_CONFIG: Record<string, { label: string; class: string }> = {
  vip: { label: 'VIP', class: 'bg-purple-500/20 text-purple-300' },
  wholesale: { label: 'Mayorista', class: 'bg-orange-500/20 text-orange-300' },
  business: { label: 'Empresa', class: 'bg-indigo-500/20 text-indigo-300' },
  premium: { label: 'Premium', class: 'bg-blue-500/20 text-blue-300' },
  regular: { label: 'Regular', class: 'bg-slate-500/20 text-slate-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
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
  toast.success(`${label} copiado`)
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
  const activeRepairs = repairs.filter(r => !['entregado', 'cancelado'].includes(r.status))
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

        {/* ── Header ── */}
        <div className="relative bg-slate-900 px-6 pb-5 pt-5 dark:bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-base font-bold text-white shadow-md">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 truncate text-base font-bold text-white">
                {customer.name}
                {customer.segment === 'vip' && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold', segment.class)}>
                  {segment.label}
                </span>
                {(() => {
                  const normalizedStatus = String(customer.status || 'active').toLowerCase().trim()
                  const isActive = normalizedStatus === 'active' || normalizedStatus === 'activo'
                  const isSuspended = normalizedStatus === 'suspended' || normalizedStatus === 'suspendido'

                  if (isActive) {
                    return (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activo
                      </span>
                    )
                  }
                  if (isSuspended) {
                    return (
                      <span className="inline-flex items-center rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                        Suspendido
                      </span>
                    )
                  }
                  return (
                    <span className="inline-flex items-center rounded-md bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      Inactivo
                    </span>
                  )
                })()}
                {customer.profile_id ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <ShieldCheck className="h-3 w-3" />
                    Cuenta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/30 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    <Link2 className="h-3 w-3" />
                    Sin cuenta
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact actions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {customer.phone && (
              <button
                type="button"
                onClick={() => copyToClipboard(customer.phone, 'Teléfono')}
                className="flex items-center gap-1.5 rounded-md bg-white/8 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                title="Click para copiar"
              >
                <Phone className="h-3 w-3" />
                {customer.phone}
                <Copy className="h-2.5 w-2.5 opacity-40" />
              </button>
            )}
            {customer.email && (
              <button
                type="button"
                onClick={() => copyToClipboard(customer.email, 'Email')}
                className="flex items-center gap-1.5 rounded-md bg-white/8 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                title="Click para copiar"
              >
                <Mail className="h-3 w-3" />
                <span className="max-w-[130px] truncate">{customer.email}</span>
                <Copy className="h-2.5 w-2.5 opacity-40" />
              </button>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-500/25"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto overscroll-contain">
          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            <div className="flex flex-col items-center py-3">
              <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{customer.total_purchases || 0}</p>
              <p className="text-[10px] text-slate-500">Compras</p>
            </div>
            <div className="flex flex-col items-center py-3">
              <Wrench className="h-3.5 w-3.5 text-slate-400" />
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{stats.totalRepairs || customer.total_repairs || 0}</p>
              <p className="text-[10px] text-slate-500">Reparaciones</p>
            </div>
            <div className="flex flex-col items-center py-3">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalSpent || customer.lifetime_value || 0)}</p>
              <p className="text-[10px] text-slate-500">Gastado</p>
            </div>
          </div>

          {/* Reparaciones */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Reparaciones
              </h3>
              {activeRepairs.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {activeRepairs.length} activa{activeRepairs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loadingRepairs ? (
              <div className="mt-2 space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : repairs.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
                Sin reparaciones registradas
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {repairs.map((repair) => {
                  const config = STATUS_CONFIG[repair.status] || STATUS_CONFIG.recibido
                  const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || 'Dispositivo'
                  return (
                    <div
                      key={repair.id}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', config.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                          {device}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {repair.ticket_number || repair.id.slice(0, 8)} · {config.label}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {timeAgo(repair.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Info extra */}
          <div className="space-y-1.5 px-4 pb-3">
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{customer.address || customer.city}</span>
              </div>
            )}
            {lastActivity && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                Última actividad: {timeAgo(lastActivity)}
              </div>
            )}
            {customer.notes && (
              <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Nota: </span>
                <span className="line-clamp-2">{customer.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => { onClose(); onViewDetail(customer) }}
          >
            Ver detalle completo
            <ChevronRight className="h-3.5 w-3.5" />
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
