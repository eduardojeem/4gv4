'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Coins,
  Copy,
  Flame,
  Loader2,
  MessageCircle,
  Scissors,
  TrendingUp,
  Trophy,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { addDays, todayIn, utcToZoned, weekdayOf, WEEKDAY_LABELS } from '@/lib/agenda/time'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'
import type { Appointment } from '@/components/dashboard/agenda/types'

type PeriodPreset = 'today' | 'this_week' | 'last_week' | 'this_month'

function getPeriodDates(preset: PeriodPreset, timeZone: string) {
  const today = todayIn(timeZone)
  const d = new Date(today + 'T12:00:00Z')
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  if (preset === 'today') {
    return { from: today, to: today, days: 1, label: 'Hoy' }
  }

  if (preset === 'this_week') {
    const monday = addDays(today, diffToMonday)
    const sunday = addDays(monday, 6)
    return { from: monday, to: sunday, days: 7, label: 'Esta semana' }
  }

  if (preset === 'last_week') {
    const lastMonday = addDays(today, diffToMonday - 7)
    const lastSunday = addDays(lastMonday, 6)
    return { from: lastMonday, to: lastSunday, days: 7, label: 'Semana anterior' }
  }

  // this_month
  const firstDay = today.slice(0, 8) + '01'
  return {
    from: firstDay,
    to: today,
    days: Math.max(1, parseInt(today.slice(8, 10), 10)),
    label: 'Este mes',
  }
}

interface BarberProductivityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionals: AgendaProfessional[]
  currency?: string
  timeZone?: string
  storeName?: string
}

export function BarberProductivityModal({
  open,
  onOpenChange,
  professionals,
  currency = 'PYG',
  timeZone = 'America/Asuncion',
  storeName = 'El negocio',
}: BarberProductivityModalProps) {
  const [preset, setPreset] = useState<PeriodPreset>('this_week')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const dates = useMemo(() => getPeriodDates(preset, timeZone), [preset, timeZone])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setLoadError(false)
      fetch(`/api/agenda?date=${dates.from}&days=${dates.days}`)
        .then((res) => { if (!res.ok) throw new Error('productivity'); return res.json() })
        .then((payload: { appointments?: Appointment[] } | null) => {
          if (cancelled) return
          setAppointments(payload?.appointments ?? [])
        })
        .catch(() => {
          if (!cancelled) { setLoadError(true); setAppointments([]); toast.error('No se pudieron cargar los datos de productividad.') }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, dates.from, dates.days])

  // Métricas agregadas y por barbero
  const { barberRankings, totalVolume, totalCompleted, totalNoShows, attendanceRate, peakDay, peakSlots } =
    useMemo(() => {
      const activeProf = professionals.filter((p) => p.is_active)

      // Inicializar mapa de métricas por profesional
      const profStatsMap = new Map<
        string,
        {
          professional: AgendaProfessional
          completedCount: number
          noShowCount: number
          cancelledCount: number
          totalVolume: number
          estimatedEarnings: number
          averageTicket: number
        }
      >()

      for (const p of activeProf) {
        profStatsMap.set(p.id, {
          professional: p,
          completedCount: 0,
          noShowCount: 0,
          cancelledCount: 0,
          totalVolume: 0,
          estimatedEarnings: 0,
          averageTicket: 0,
        })
      }

      // Distribución por día de la semana
      const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

      // Distribución por franja horaria
      const slotCounts = {
        morning: 0, // 08:00 - 12:00
        midday: 0, // 12:00 - 15:00
        afternoon: 0, // 15:00 - 18:00
        evening: 0, // 18:00 - 21:00
      }

      let salonVolume = 0
      let salonCompleted = 0
      let salonNoShows = 0
      let salonCancelled = 0

      for (const apt of appointments) {
        const local = utcToZoned(apt.starts_at, timeZone)
        const dayIdx = weekdayOf(local.date)
        const hour = parseInt(local.time.slice(0, 2), 10)

        if (apt.status === 'completed') {
          dayCounts[dayIdx] = (dayCounts[dayIdx] || 0) + 1

          if (hour >= 8 && hour < 12) slotCounts.morning++
          else if (hour >= 12 && hour < 15) slotCounts.midday++
          else if (hour >= 15 && hour < 18) slotCounts.afternoon++
          else if (hour >= 18) slotCounts.evening++
        }

        const stats = apt.professional_id ? profStatsMap.get(apt.professional_id) : null

        if (apt.status === 'completed') {
          salonCompleted++
          salonVolume += Number(apt.price || 0)
          if (stats) {
            stats.completedCount++
            stats.totalVolume += Number(apt.price || 0)
          }
        } else if (apt.status === 'no_show') {
          salonNoShows++
          if (stats) stats.noShowCount++
        } else if (apt.status === 'cancelled') {
          salonCancelled++
          if (stats) stats.cancelledCount++
        }
      }

      // Calcular ganancias estimadas y tickets promedio
      const rankings = Array.from(profStatsMap.values()).map((item) => {
        const p = item.professional
        let earnings = 0
        if (p.remuneration_type === 'chair_rental') {
          // El barbero se queda con el 100% de los cortes menos su canon
          const canon = p.commission_fixed_deduction ?? 0
          earnings = Math.max(0, item.totalVolume - canon)
        } else if (p.remuneration_type === 'fixed') {
          earnings = 0 // Sueldo fijo acordado fuera de comisión
        } else {
          const rate = p.commission_rate_services ?? 50
          earnings = (item.totalVolume * rate) / 100
        }

        const avg = item.completedCount > 0 ? Math.round(item.totalVolume / item.completedCount) : 0

        return {
          ...item,
          estimatedEarnings: earnings,
          averageTicket: avg,
        }
      })

      // Ordenar por volumen completado o cantidad de turnos
      rankings.sort((a, b) => {
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount
        }
        return b.totalVolume - a.totalVolume
      })

      const totalHandled = salonCompleted + salonNoShows + salonCancelled
      const rate = totalHandled > 0 ? Math.round((salonCompleted / totalHandled) * 100) : 100

      // Encontrar día pico
      let bestDayIdx = 5 // Por defecto viernes
      let bestDayCount = -1
      for (const [dStr, cnt] of Object.entries(dayCounts)) {
        const d = Number(dStr)
        if (cnt > bestDayCount) {
          bestDayCount = cnt
          bestDayIdx = d
        }
      }

      return {
        barberRankings: rankings,
        totalVolume: salonVolume,
        totalCompleted: salonCompleted,
        totalNoShows: salonNoShows,
        attendanceRate: rate,
        peakDay: {
          dayName: WEEKDAY_LABELS[bestDayIdx] || 'Viernes',
          count: bestDayCount > 0 ? bestDayCount : 0,
          dayCounts,
        },
        peakSlots: slotCounts,
      }
    }, [professionals, appointments, timeZone])

  const copyOrShareSummary = () => {
    const topBarbers = barberRankings
      .slice(0, 3)
      .map((b, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
        return `${medal} ${i + 1}º ${b.professional.name} · ${b.completedCount} cortes (${formatCurrency(b.totalVolume, { currency })})`
      })
      .join('\n')

    const text = [
      `🏆 *RANKING & PRODUCTIVIDAD - ${storeName}*`,
      `📅 *Período:* ${dates.label} (${dates.from} al ${dates.to})`,
      '',
      topBarbers || 'Sin turnos completados en el período.',
      '',
      `📊 *Métricas del salón:*`,
      `• Total turnos completados: ${totalCompleted}`,
      `• Facturación en sillón: ${formatCurrency(totalVolume, { currency })}`,
      `• Tasa de asistencia: ${attendanceRate}% (${totalNoShows} ausentes)`,
      `• Día récord: ${peakDay.dayName} (${peakDay.count} cortes)`,
      '',
      `¡Felicitaciones a todo el equipo por el trabajo! 💈🔥`,
    ].join('\n')

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      toast.success('Resumen copiado al portapapeles', {
        description: 'Listo para pegar en WhatsApp o el grupo del staff.',
      })
    }
  }

  const shareViaWhatsApp = () => {
    const topBarbers = barberRankings
      .slice(0, 3)
      .map((b, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
        return `${medal} ${i + 1}º ${b.professional.name} · ${b.completedCount} cortes (${formatCurrency(b.totalVolume, { currency })})`
      })
      .join('\n')

    const text = [
      `🏆 *RANKING & PRODUCTIVIDAD - ${storeName}*`,
      `📅 *Período:* ${dates.label} (${dates.from} al ${dates.to})`,
      '',
      topBarbers || 'Sin turnos completados en el período.',
      '',
      `📊 *Métricas del salón:*`,
      `• Turnos completados: ${totalCompleted}`,
      `• Facturación en sillón: ${formatCurrency(totalVolume, { currency })}`,
      `• Tasa de asistencia: ${attendanceRate}%`,
      `• Día récord: ${peakDay.dayName} (${peakDay.count} cortes)`,
      '',
      `¡A seguir metiendo tijera! 💈🔥`,
    ].join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Ranking y Productividad del Equipo
              </DialogTitle>
              <DialogDescription>
                Rendimiento de los profesionales, asistencia y horarios pico.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Selector de Período */}
        <div className="flex flex-wrap items-center gap-2 border-y py-2.5">
          <span className="text-xs font-bold text-muted-foreground">Período:</span>
          {[
            { id: 'this_week', label: 'Esta semana' },
            { id: 'last_week', label: 'Semana pasada' },
            { id: 'this_month', label: 'Este mes' },
            { id: 'today', label: 'Hoy' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id as PeriodPreset)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                preset === item.id
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
          {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {loadError && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">No se pudo consultar el período. Cerrá y volvé a abrir para reintentar.</p>}
        <div hidden={loadError || loading}>
        {/* 4 KPIs Clave del Salón */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Scissors className="h-3 w-3 text-primary" /> Turnos Atendidos
            </span>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
              {totalCompleted}
            </p>
            <p className="text-[10px] text-muted-foreground">Cortes completados</p>
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3 text-emerald-600" /> Facturación
            </span>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
              {formatCurrency(totalVolume, { currency })}
            </p>
            <p className="text-[10px] text-muted-foreground">Producido en sillón</p>
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-indigo-500" /> Asistencia
            </span>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
              {attendanceRate}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              {totalNoShows} ausencia{totalNoShows === 1 ? '' : 's'} (no-show)
            </p>
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-500" /> Día Récord
            </span>
            <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
              {peakDay.dayName}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {peakDay.count} turnos realizados
            </p>
          </div>
        </div>

        {/* Podio / Leaderboard de Barberos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500" />
              Ranking de Barberos ({dates.label})
            </h3>
            <span className="text-xs text-muted-foreground">
              Ordenado por turnos completados
            </span>
          </div>

          <div className="space-y-2">
            {barberRankings.map((barber, index) => {
              const medal =
                index === 0
                  ? '🥇 1º'
                  : index === 1
                  ? '🥈 2º'
                  : index === 2
                  ? '🥉 3º'
                  : `${index + 1}º`
              const isFirst = index === 0 && barber.completedCount > 0

              return (
                <div
                  key={barber.professional.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all',
                    isFirst
                      ? 'border-amber-500/40 bg-gradient-to-r from-amber-50/60 via-card to-card shadow-xs dark:from-amber-950/20'
                      : 'border-border/80 bg-card hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black',
                        index === 0
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : index === 1
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : index === 2
                          ? 'bg-amber-700/20 text-amber-900 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {medal}
                    </span>

                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-2xs"
                      style={{ backgroundColor: barber.professional.color || '#6366f1' }}
                    >
                      {barber.professional.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground">
                          {barber.professional.name}
                        </p>
                        {barber.professional.remuneration_type === 'chair_rental' ? (
                          <Badge variant="outline" className="border-indigo-500/30 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                            Sillón
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
                            {barber.professional.commission_rate_services ?? 50}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {barber.professional.specialty || 'Barbero profesional'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-black text-foreground">
                        {barber.completedCount}{' '}
                        <span className="text-xs font-semibold text-muted-foreground">
                          corte{barber.completedCount === 1 ? '' : 's'}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ticket prom: {formatCurrency(barber.averageTicket, { currency })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(barber.totalVolume, { currency })}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Ganancia: {formatCurrency(barber.estimatedEarnings, { currency })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Análisis de Horarios Pico y Días de Mayor Demanda */}
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground">
              Inteligencia del Salón: Horarios y Días con Más Clientes
            </h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-xl border bg-card p-3">
              <span className="text-[11px] font-bold text-muted-foreground">
                Franjas Horarias con Mayor Demanda
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span>🌅 Mañana (08:00 - 12:00)</span>
                  <span className="font-bold">{peakSlots.morning} cortes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>☀️ Siesta (12:00 - 15:00)</span>
                  <span className="font-bold">{peakSlots.midday} cortes</span>
                </div>
                <div className="flex items-center justify-between text-primary font-semibold">
                  <span>🔥 Tarde Pico (15:00 - 18:00)</span>
                  <span className="font-black">{peakSlots.afternoon} cortes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>🌙 Noche (18:00 - 21:00)</span>
                  <span className="font-bold">{peakSlots.evening} cortes</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 rounded-xl border bg-card p-3">
              <span className="text-[11px] font-bold text-muted-foreground">
                Consejo Estratégico para el Dueño
              </span>
              <p className="text-xs text-foreground/90 leading-relaxed">
                El día con mayor concentración es <b>{peakDay.dayName}</b> con {peakDay.count} turnos.
                Asegurá que todos los sillones estén cubiertos los viernes y sábados por la tarde para evitar demoras y capturar clientes que buscan turnos de último momento.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Cierre y Compartir */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyOrShareSummary}
              className="gap-1.5 rounded-xl text-xs font-bold"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar Resumen
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={shareViaWhatsApp}
              className="gap-1.5 rounded-xl bg-[#25D366] text-xs font-bold text-white hover:bg-[#1ebe5a]"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Cerrar
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
