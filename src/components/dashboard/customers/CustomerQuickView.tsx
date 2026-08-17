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
  DollarSign,
  Wallet,
  Info,
  ChevronDown,
  ChevronUp,
  Coins
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Customer } from '@/hooks/use-customer-state'
import { formatCurrency as globalFormatCurrency } from '@/lib/currency'
import { CustomerGlobalPaymentModal } from './CustomerGlobalPaymentModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerQuickViewProps {
  customer: Customer | null
  open: boolean
  onClose: () => void
  onViewDetail: (customer: Customer) => void
  onEdit: (customer: Customer) => void
}

interface CustomerCreditItem {
  id: string
  principal?: number
  amount?: number
  interest_rate?: number
  term_months?: number
  status: string
  created_at: string
}

interface CreditsStats {
  totalCredits: number
  activeCredits: number
  totalPrincipal: number
  pendingBalance: number
  totalInstallments: number
  pendingInstallments: number
}

interface SaleItemSummary {
  id: string
  quantity: number
  unit_price: number
  total_price: number
  product_name: string | null
}

interface SaleSummary {
  id: string
  code: string | null
  status: string
  payment_method: string | null
  payment_status: string | null
  total_amount: number
  subtotal?: number
  created_at: string
  sale_items?: SaleItemSummary[]
}

interface SalesStats {
  totalPurchases: number
  totalSpent: number
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

interface StoreCreditMovement {
  id: string
  amount: number
  reason: string
  source_type: 'after_sales' | 'sale' | 'repair' | 'manual'
  created_at: string
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
    label: 'En Reparación', 
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500' 
  },
  pausado: { 
    label: 'Pausado', 
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-400' 
  },
  listo: { 
    label: 'Listo para Entrega', 
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold',
    dot: 'bg-emerald-500' 
  },
  entregado: { 
    label: 'Entregado', 
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400' 
  },
  cancelado: { 
    label: 'Cancelado', 
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500' 
  },
}

const SEGMENT_CONFIG: Record<string, { label: string; class: string }> = {
  vip: { label: 'VIP', class: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
  high_value: { label: 'Alto Valor', class: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  business: { label: 'Empresa', class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  wholesale: { label: 'Mayorista', class: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  new: { label: 'Nuevo', class: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' },
  regular: { label: 'Regular', class: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [repairStats, setRepairStats] = useState<RepairStats>({ totalRepairs: 0, totalSpent: 0 })
  const [sales, setSales] = useState<SaleSummary[]>([])
  const [salesStats, setSalesStats] = useState<SalesStats>({ totalPurchases: 0, totalSpent: 0 })
  const [credits, setCredits] = useState<CustomerCreditItem[]>([])
  const [creditStats, setCreditStats] = useState<CreditsStats>({
    totalCredits: 0,
    activeCredits: 0,
    totalPrincipal: 0,
    pendingBalance: 0,
    totalInstallments: 0,
    pendingInstallments: 0
  })
  const [loadingRepairs, setLoadingRepairs] = useState(false)
  const [loadingSales, setLoadingSales] = useState(false)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [storeBalance, setStoreBalance] = useState(0)
  const [storeMovements, setStoreMovements] = useState<StoreCreditMovement[]>([])
  const [storeExpanded, setStoreExpanded] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'purchases' | 'repairs' | 'credits'>('purchases')
  const [globalPaymentOpen, setGlobalPaymentOpen] = useState(false)

  useEffect(() => {
    if (!open || !customer) {
      setRepairs([])
      setRepairStats({ totalRepairs: 0, totalSpent: 0 })
      setSales([])
      setSalesStats({ totalPurchases: 0, totalSpent: 0 })
      setCredits([])
      setCreditStats({
        totalCredits: 0,
        activeCredits: 0,
        totalPrincipal: 0,
        pendingBalance: 0,
        totalInstallments: 0,
        pendingInstallments: 0
      })
      setStoreBalance(0)
      setStoreMovements([])
      setStoreExpanded(false)
      setActiveSubTab('purchases')
      return
    }

    const controller = new AbortController()

    const fetchSales = async () => {
      setLoadingSales(true)
      try {
        const res = await fetch(`/api/customers/${customer.id}/sales?limit=5`, {
          signal: controller.signal,
        })
        const data = await res.json()

        if (data?.sales) {
          setSales(data.sales)
          setSalesStats(data.stats ?? { totalPurchases: 0, totalSpent: 0 })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setSales([])
      } finally {
        setLoadingSales(false)
      }
    }

    const fetchRepairs = async () => {
      setLoadingRepairs(true)
      try {
        const res = await fetch(`/api/customers/${customer.id}/repairs?limit=5`, {
          signal: controller.signal,
        })
        const data = await res.json()

        if (data?.repairs) {
          setRepairs(data.repairs)
          setRepairStats(data.stats ?? { totalRepairs: 0, totalSpent: 0 })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setRepairs([])
      } finally {
        setLoadingRepairs(false)
      }
    }

    const fetchCredits = async () => {
      setLoadingCredits(true)
      try {
        const res = await fetch(`/api/customers/${customer.id}/credits`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (data?.credits) {
          setCredits(data.credits)
          setCreditStats(data.stats ?? {
            totalCredits: 0,
            activeCredits: 0,
            totalPrincipal: 0,
            pendingBalance: 0,
            totalInstallments: 0,
            pendingInstallments: 0,
          })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setCredits([])
      } finally {
        setLoadingCredits(false)
      }
    }

    const fetchStoreCredit = async () => {
      try {
        const res = await fetch(`/api/customers/${customer.id}/store-credit?page=1&pageSize=10`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => null)
        if (!payload?.success) return
        setStoreBalance(Number(payload.data?.balance || 0))
        setStoreMovements(payload.data?.movements ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setStoreBalance(0)
      }
    }

    fetchSales()
    fetchRepairs()
    fetchCredits()
    fetchStoreCredit()
    return () => controller.abort()
  }, [open, customer])

  if (!customer) return null

  const initials = customer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const activeRepairs = repairs.filter(r => !['entregado', 'cancelado'].includes((r.status || '').toLowerCase()))
  const segment = SEGMENT_CONFIG[customer.segment] || SEGMENT_CONFIG.regular
  const phoneClean = customer.phone?.replace(/\D/g, '') || ''
  const whatsappUrl = phoneClean ? `https://wa.me/${phoneClean}` : null
  const lastActivity = customer.last_activity || customer.last_visit || customer.registration_date

  const totalPurchasesCount = salesStats.totalPurchases || customer.total_purchases || sales.length || 0
  const totalRepairsCount = repairStats.totalRepairs || customer.total_repairs || repairs.length || 0
  const totalOverallSpent = (salesStats.totalSpent || 0) + (repairStats.totalSpent || 0) || customer.lifetime_value || 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="!block w-[calc(100%-2rem)] max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-[#0d1117] text-slate-900 dark:text-slate-100"
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
        <div className="max-h-[calc(92vh-13rem)] overflow-y-auto overscroll-contain">
          {/* Métricas del Cliente */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/50 dark:divide-slate-800/80 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('purchases')}
              className={cn(
                "flex flex-col items-center py-3 px-2 transition-colors",
                activeSubTab === 'purchases' ? "bg-blue-50/50 dark:bg-blue-950/20" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
              )}
            >
              <ShoppingBag className={cn("h-4 w-4", activeSubTab === 'purchases' ? "text-blue-600 dark:text-blue-400 font-bold" : "text-blue-500")} />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white tabular-nums">{totalPurchasesCount}</p>
              <p className="text-[11px] font-medium text-slate-500">Compras</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('repairs')}
              className={cn(
                "flex flex-col items-center py-3 px-2 transition-colors",
                activeSubTab === 'repairs' ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
              )}
            >
              <Wrench className={cn("h-4 w-4", activeSubTab === 'repairs' ? "text-amber-600 dark:text-amber-400 font-bold" : "text-amber-500")} />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white tabular-nums">{totalRepairsCount}</p>
              <p className="text-[11px] font-medium text-slate-500">Reparaciones</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('credits')}
              className={cn(
                "flex flex-col items-center py-3 px-2 transition-colors",
                activeSubTab === 'credits' ? "bg-purple-50/50 dark:bg-purple-950/20" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
              )}
            >
              <CreditCard className={cn("h-4 w-4", creditStats.activeCredits > 0 ? "text-purple-600 dark:text-purple-400" : "text-slate-400")} />
              <p className={cn("mt-1 text-base font-bold tabular-nums", creditStats.activeCredits > 0 ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-900 dark:text-white")}>
                {creditStats.activeCredits > 0 ? `${creditStats.activeCredits} Activo` : creditStats.totalCredits > 0 ? `${creditStats.totalCredits} Hist.` : '0'}
              </p>
              <p className="text-[11px] font-medium text-slate-500">Créditos</p>
            </button>

            <div className="flex flex-col items-center py-3 px-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white tabular-nums">{globalFormatCurrency(totalOverallSpent)}</p>
              <p className="text-[11px] font-medium text-slate-500">Total Gastado</p>
            </div>

            <div className="flex flex-col items-center py-3 px-2">
              <Wallet className={cn("h-4 w-4", storeBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")} />
              <p className={cn("mt-1 text-base font-bold tabular-nums", storeBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white")}>
                {globalFormatCurrency(storeBalance)}
              </p>
              <p className="text-[11px] font-medium text-slate-500">Saldo a Favor</p>
            </div>
          </div>

          {/* ── Banner de Créditos Activos y Deuda Pendiente ── */}
          {(creditStats.activeCredits > 0 || creditStats.pendingBalance > 0 || (customer.current_balance && customer.current_balance > 0)) && (
            <div className="mx-4 mt-3 rounded-xl border p-3.5 bg-purple-50/80 border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-500/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-purple-100 dark:bg-purple-800/40">
                    <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        {creditStats.activeCredits > 0 ? `Créditos Activos (${creditStats.activeCredits})` : 'Crédito con Saldo'}
                      </p>
                      {creditStats.pendingInstallments > 0 && (
                        <Badge className="bg-purple-200/80 text-purple-900 dark:bg-purple-900/50 dark:text-purple-200 text-[10px] h-4 px-1.5 border-0">
                          {creditStats.pendingInstallments} cuota{creditStats.pendingInstallments > 1 ? 's' : ''} pendiente{creditStats.pendingInstallments > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold text-purple-950 dark:text-purple-100 tabular-nums">
                      Saldo Deudor: {globalFormatCurrency(creditStats.pendingBalance || customer.current_balance || 0)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGlobalPaymentOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span>Abonar a Deuda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('credits')}
                    className="px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <span>Ver</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Saldo a Favor ── */}
          <div className={`mx-4 mt-3 rounded-xl border p-3.5 ${storeBalance > 0 ? 'bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-500/20' : 'bg-slate-50/70 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-700/40'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${storeBalance > 0 ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-slate-100 dark:bg-slate-800/40'}`}>
                  <Wallet className={`h-4 w-4 ${storeBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${storeBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>Saldo a Favor</p>
                  <p className={`text-base font-bold tabular-nums ${storeBalance > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-600'}`}>
                    {globalFormatCurrency(storeBalance)}
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {storeBalance > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-800/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    ✓ Disponible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    Sin saldo
                  </span>
                )}
                {storeMovements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStoreExpanded(v => !v)}
                    className={`p-1 rounded-md transition-colors ${storeBalance > 0 ? 'text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    title={storeExpanded ? 'Ocultar movimientos' : 'Ver movimientos'}
                  >
                    {storeExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {storeBalance > 0 && (
              <p className="mt-1.5 text-[10px] text-emerald-600/80 dark:text-emerald-400/70 pl-10">
                💡 Aplicable en próxima compra o reparación
              </p>
            )}

            {storeExpanded && storeMovements.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-200/60 dark:divide-white/5 rounded-lg border border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-black/20 overflow-hidden text-xs">
                {storeMovements.slice(0, 5).map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{m.reason}</p>
                      <p className="text-[10px] text-slate-400">
                        {({ after_sales: 'Posventa', sale: 'Venta', repair: 'Reparación', manual: 'Manual' } as Record<string, string>)[m.source_type] || 'Mov.'} · {new Date(m.created_at).toLocaleDateString('es-PY')}
                      </p>
                    </div>
                    <span className={`shrink-0 font-bold tabular-nums ${m.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {m.amount >= 0 ? '+' : '-'}{globalFormatCurrency(Math.abs(Number(m.amount)))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {storeBalance === 0 && storeMovements.length === 0 && (
              <div className="flex items-start gap-1.5 mt-2 pl-10">
                <Info className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Se acumula por devoluciones y ajustes</p>
              </div>
            )}
          </div>

          {/* ── Subtabs Switcher: Compras vs Reparaciones vs Créditos ── */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('purchases')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeSubTab === 'purchases'
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Compras Recientes</span>
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px]",
                    activeSubTab === 'purchases' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  )}>
                    {sales.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('repairs')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeSubTab === 'repairs'
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Reparaciones</span>
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px]",
                    activeSubTab === 'repairs' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  )}>
                    {repairs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('credits')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeSubTab === 'credits'
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Créditos</span>
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px]",
                    activeSubTab === 'credits' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  )}>
                    {credits.length}
                  </span>
                </button>
              </div>

              {activeSubTab === 'repairs' && activeRepairs.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  {activeRepairs.length} activa(s)
                </span>
              )}
              {activeSubTab === 'credits' && creditStats.activeCredits > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                  {creditStats.activeCredits} activo(s)
                </span>
              )}
            </div>

            {/* ── TAB 1: COMPRAS ── */}
            {activeSubTab === 'purchases' && (
              <>
                {loadingSales ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                    ))}
                  </div>
                ) : sales.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <ShoppingBag className="mx-auto h-6 w-6 opacity-40 mb-1.5" />
                    <p>No se encontraron compras registradas en el POS.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sales.map(sale => {
                      const isPaid = (sale.payment_status || '').toLowerCase() === 'completed' || (sale.payment_status || '').toLowerCase() === 'pagado'
                      const isCredit = (sale.payment_method || '').toLowerCase() === 'credit' || (sale.payment_method || '').toLowerCase() === 'credito'

                      return (
                        <div
                          key={sale.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 text-xs dark:border-white/5 dark:bg-slate-900/30 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                  {sale.code ? `Venta #${sale.code}` : `Ticket #${sale.id.slice(-6)}`}
                                </span>
                                {isCredit && (
                                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-0 text-[10px] font-bold">
                                    A Crédito
                                  </Badge>
                                )}
                              </div>
                              {sale.sale_items && sale.sale_items.length > 0 && (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {sale.sale_items.map(it => `${it.quantity}x ${it.product_name || 'Producto'}`).join(', ')}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold tabular-nums text-xs text-slate-900 dark:text-slate-100">
                                {globalFormatCurrency(sale.total_amount)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                            <Badge variant="outline" className="gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200">
                              {sale.payment_method ? sale.payment_method.toUpperCase() : 'CONTADO'}
                            </Badge>
                            {isPaid ? (
                              <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                Pagado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200">
                                <Clock className="h-3 w-3 text-amber-600" />
                                {sale.payment_status || 'Pendiente'}
                              </Badge>
                            )}
                            <span className="ml-auto text-[10px] text-slate-400">
                              {timeAgo(sale.created_at)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── TAB 2: REPARACIONES ── */}
            {activeSubTab === 'repairs' && (
              <>
                {loadingRepairs ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                    ))}
                  </div>
                ) : repairs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <Wrench className="mx-auto h-6 w-6 opacity-40 mb-1.5" />
                    <p>No se encontraron reparaciones registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {repairs.map(repair => {
                      const statusKey = (repair.status || 'recibido').toLowerCase()
                      const statusCfg = STATUS_CONFIG[statusKey] || {
                        label: repair.status || 'Recibido',
                        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
                        dot: 'bg-slate-400'
                      }
                      const isDelivered = statusKey === 'entregado' || Boolean(repair.delivered_at)
                      const isReadyForPickup = statusKey === 'listo'
                      const isPaid = (repair.payment_status || '').toLowerCase() === 'paid' || (repair.payment_status || '').toLowerCase() === 'pagado'
                      const isPartialPaid = !isPaid && (repair.paid_amount ?? 0) > 0
                      const cost = (repair.final_cost ?? repair.estimated_cost) || 0

                      return (
                        <div
                          key={repair.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 text-xs dark:border-white/5 dark:bg-slate-900/30 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white font-mono">
                                  {repair.ticket_number ? `#${repair.ticket_number}` : `ORD-${repair.id.slice(-6)}`}
                                </span>
                                {(repair.device_brand || repair.device_model) && (
                                  <span className="text-slate-500 font-medium truncate">
                                    · {[repair.device_brand, repair.device_model].filter(Boolean).join(' ')}
                                  </span>
                                )}
                              </div>
                              {repair.problem_description && (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  Falla: {repair.problem_description}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold tabular-nums text-xs text-slate-900 dark:text-slate-100">
                                {globalFormatCurrency(cost)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                            <Badge variant="outline" className={cn('gap-1 px-2 py-0.5 text-[10px]', statusCfg.badgeClass)}>
                              {statusCfg.label}
                            </Badge>

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

                            {isPaid ? (
                              <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                <DollarSign className="h-3 w-3 text-blue-600" />
                                Pagado
                              </Badge>
                            ) : isPartialPaid ? (
                              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200">
                                <Receipt className="h-3 w-3 text-amber-600" />
                                Pago Parcial ({globalFormatCurrency(repair.paid_amount)})
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
              </>
            )}

            {/* ── TAB 3: CRÉDITOS Y CUOTAS ── */}
            {activeSubTab === 'credits' && (
              <div className="space-y-3">
                {/* Tarjeta de Límite de Crédito del Cliente */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Línea de Crédito:</span>
                        <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">
                          {(customer.credit_limit || 0) > 0 ? globalFormatCurrency(customer.credit_limit || 0) : 'No habilitada'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {(customer.credit_limit || 0) > 0
                          ? `Saldo pendiente actual: ${globalFormatCurrency(customer.current_balance || creditStats.pendingBalance || 0)}`
                          : 'El cliente no tiene asignado un límite de crédito para compras o retiro de reparaciones.'}
                      </p>
                    </div>
                  </div>

                  {(!customer.credit_limit || customer.credit_limit <= 0) ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onClose()
                        onEdit(customer)
                      }}
                      className="h-7 px-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg gap-1 shrink-0 self-start sm:self-auto"
                    >
                      <CreditCard className="h-3 w-3" />
                      Habilitar Crédito
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose()
                        onEdit(customer)
                      }}
                      className="h-7 px-2.5 text-[11px] font-medium rounded-lg gap-1 shrink-0 self-start sm:self-auto"
                    >
                      <Pencil className="h-3 w-3" />
                      Modificar Límite
                    </Button>
                  )}
                </div>

                {loadingCredits ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                    ))}
                  </div>
                ) : credits.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <CreditCard className="mx-auto h-6 w-6 opacity-40 mb-1.5 text-purple-400" />
                    <p>No se encontraron créditos registrados para este cliente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {credits.map(cr => {
                      const isActive = cr.status === 'active' || cr.status === 'pending' || cr.status === 'late'
                      const isCompleted = cr.status === 'completed' || cr.status === 'paid'

                      return (
                        <div
                          key={cr.id}
                          className={cn(
                            "rounded-xl border p-3 text-xs transition-all",
                            isActive
                              ? "border-purple-200 bg-purple-50/40 dark:border-purple-900/40 dark:bg-purple-950/10"
                              : "border-slate-200/80 bg-slate-50/40 dark:border-white/5 dark:bg-slate-900/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                Crédito #{cr.id.slice(-6)}
                              </span>
                              <Badge className={cn(
                                "text-[10px] uppercase font-bold",
                                isActive
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-0"
                                  : isCompleted
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-0"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0"
                              )}>
                                {isActive ? 'Activo' : isCompleted ? 'Liquidado' : cr.status}
                              </Badge>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                              {globalFormatCurrency(cr.principal || cr.amount || 0)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            {cr.term_months && <span>Plazo: {cr.term_months} meses</span>}
                            {cr.interest_rate !== undefined && <span>Tasa: {cr.interest_rate}%</span>}
                            {cr.created_at && (
                              <span className="ml-auto text-slate-400">
                                {new Date(cr.created_at).toLocaleDateString('es-PY')}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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

      <CustomerGlobalPaymentModal
        customer={customer}
        open={globalPaymentOpen}
        onClose={() => setGlobalPaymentOpen(false)}
        onSuccess={() => {
          // Refresh customer data
          if (customer?.id) {
            fetch(`/api/customers/${customer.id}/credits`)
              .then((res) => res.json())
              .then((data) => {
                if (data.success) {
                  setCredits(data.credits || [])
                  setCreditStats(data.stats || {
                    totalCredits: 0,
                    activeCredits: 0,
                    totalPrincipal: 0,
                    pendingBalance: 0,
                    totalInstallments: 0,
                    pendingInstallments: 0,
                  })
                }
              })
              .catch(() => {})
          }
        }}
      />
    </Dialog>
  )
}
