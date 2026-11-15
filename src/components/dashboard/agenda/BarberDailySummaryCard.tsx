'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  MessageCircle,
  Scissors,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { utcToZoned } from '@/lib/agenda/time'
import { cn } from '@/lib/utils'
import type { AgendaData } from '@/components/dashboard/agenda/types'

interface BarberDailySummaryCardProps {
  data: AgendaData
  date: string
  currentUserId?: string | null
  selectedProfessionalId: string | null
  onSelectProfessional: (id: string | null) => void
}

export function BarberDailySummaryCard({
  data,
  date,
  currentUserId,
  selectedProfessionalId,
  onSelectProfessional,
}: BarberDailySummaryCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [nowMinutes, setNowMinutes] = useState(() => utcToZoned(Date.now(), data.timeZone).minutes)

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(utcToZoned(Date.now(), data.timeZone).minutes)
    }, 60_000)
    return () => clearInterval(timer)
  }, [data.timeZone])

  // Encuentra el profesional vinculado al usuario logueado (si existe)
  const myProfessional = useMemo(() => {
    if (!currentUserId || !data.professionals.length) return null
    return data.professionals.find((p) => p.user_id === currentUserId && p.is_active) ?? null
  }, [currentUserId, data.professionals])

  // El profesional actualmente visualizado en las métricas
  const activeProfessional = useMemo(() => {
    if (selectedProfessionalId) {
      return data.professionals.find((p) => p.id === selectedProfessionalId) ?? null
    }
    return null
  }, [selectedProfessionalId, data.professionals])

  // Turnos del día en la zona horaria del negocio
  const dayAppointments = useMemo(() => {
    return data.appointments.filter((apt) => {
      const zoned = utcToZoned(apt.starts_at, data.timeZone)
      return zoned.date === date
    })
  }, [data.appointments, date, data.timeZone])

  // Turnos filtrados para el profesional seleccionado
  const professionalAppointments = useMemo(() => {
    if (!activeProfessional) return dayAppointments
    return dayAppointments.filter((apt) => apt.professional_id === activeProfessional.id)
  }, [dayAppointments, activeProfessional])

  // Cálculos estadísticos
  const stats = useMemo(() => {
    const targetApts = activeProfessional ? professionalAppointments : dayAppointments
    const active = targetApts.filter((a) => a.status !== 'cancelled')
    const completed = active.filter((a) => a.status === 'completed')
    const pending = active.filter((a) => a.status === 'pending' || a.status === 'confirmed')
    const totalVolume = completed.reduce((sum, a) => sum + Number(a.price || 0), 0)

    // Comisión estimada
    let estimatedCommission = 0
    if (activeProfessional) {
      if (activeProfessional.remuneration_type === 'chair_rental') {
        estimatedCommission = Math.max(0,totalVolume - (activeProfessional.commission_fixed_deduction ?? 0))
      } else if (activeProfessional.remuneration_type === 'fixed') {
        estimatedCommission = 0
      } else {
        const rate = activeProfessional.commission_rate_services ?? 50
        estimatedCommission = Math.max(0,(totalVolume * rate) / 100 - completed.length * (activeProfessional.commission_fixed_deduction ?? 0))
      }
    }

    // Próximo turno en cola
    const upcoming = active
      .filter((a) => {
        const startMin = utcToZoned(a.starts_at, data.timeZone).minutes
        return startMin >= nowMinutes - 15 && (a.status === 'pending' || a.status === 'confirmed')
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null

    return {
      total: active.length,
      completed: completed.length,
      pending: pending.length,
      totalVolume,
      estimatedCommission,
      upcoming,
    }
  }, [activeProfessional, professionalAppointments, dayAppointments, nowMinutes, data.timeZone])

  // Solo renderizar si hay profesionales activos
  const activeProfessionals = useMemo(
    () => data.professionals.filter((p) => p.is_active),
    [data.professionals]
  )

  if (activeProfessionals.length === 0) return null

  const isFilteredToMe = Boolean(myProfessional && selectedProfessionalId === myProfessional.id)
  const isFilteredToAll = selectedProfessionalId === null

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm transition-all">
      {/* Barra superior de control y selección de barbero */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {myProfessional ? (
            <div className="inline-flex rounded-xl border border-border/80 bg-background/90 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => onSelectProfessional(myProfessional.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                  isFilteredToMe
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                <Scissors className="h-3.5 w-3.5" />
                Mis Turnos
              </button>
              <button
                type="button"
                onClick={() => onSelectProfessional(null)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                  isFilteredToAll
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Todo el Equipo
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Equipo:
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onSelectProfessional(null)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedProfessionalId === null
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-background hover:bg-muted text-foreground border'
                  )}
                >
                  Todos
                </button>
                {activeProfessionals.map((prof) => {
                  const isSelected = selectedProfessionalId === prof.id
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => onSelectProfessional(prof.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'bg-background hover:bg-muted text-foreground border'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prof.color }} />
                      {prof.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeProfessional && (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/60">
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                style={{ backgroundColor: activeProfessional.color }}
              />
              <span className="text-xs font-bold text-foreground">
                {activeProfessional.name}
              </span>
              {activeProfessional.commission_rate_services != null && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  {activeProfessional.commission_rate_services}% comisión
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isFilteredToMe && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              Vista individual activa
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5 mr-1" /> Ver métricas de hoy
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5 mr-1" /> Ocultar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Contenido expandible con KPIs */}
      {!collapsed && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* KPI 1: Turnos de hoy */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Turnos del día seleccionado</span>
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-foreground">
                  {stats.total}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({stats.completed} listos)
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{stats.pending} pendientes</span>
              </div>
            </div>

            {/* KPI 2: Facturación generada */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">
                  {activeProfessional ? 'Servicios Atendidos' : 'Total Servicios'}
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-1">
                <span className="text-xl font-black tracking-tight text-foreground">
                  {formatCurrency(stats.totalVolume, { currency: data.currency })}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {activeProfessional
                  ? `Producción de ${activeProfessional.name.split(' ')[0]}`
                  : 'Total de turnos atendidos'}
              </p>
            </div>

            {/* KPI 3: Mi Comisión Estimada */}
            {activeProfessional ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 shadow-2xs dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Ganancia Estimada
                  </span>
                  <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-1">
                  <span className="text-xl font-black tracking-tight text-emerald-900 dark:text-emerald-200">
                    {formatCurrency(stats.estimatedCommission, { currency: data.currency })}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {activeProfessional.remuneration_type === 'chair_rental'
                    ? 'Servicios atendidos menos alquiler'
                    : activeProfessional.remuneration_type === 'fixed'
                    ? 'Sueldo fijo acordado'
                    : `${activeProfessional.commission_rate_services ?? 50}% de tus servicios`}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-2xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium">Profesionales activos</span>
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-black tracking-tight text-foreground">
                    {activeProfessionals.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  En equipo de trabajo
                </p>
              </div>
            )}

            {/* KPI 4: Próximo Turno / En Silla */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-2xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Próximo Cliente</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              {stats.upcoming ? (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold text-foreground">
                      {utcToZoned(stats.upcoming.starts_at, data.timeZone).time} · {stats.upcoming.customer_name}
                    </span>
                    {stats.upcoming.customer_phone && (
                      <a
                        href={`https://wa.me/${stats.upcoming.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `¡Hola ${stats.upcoming.customer_name}! Te esperamos en breve en ${data.storeName} para tu turno de ${stats.upcoming.service_name}.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-emerald-600 p-1 text-white hover:bg-emerald-700"
                        title="Escribir por WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {stats.upcoming.service_name}
                  </p>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Sin turnos próximos</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
