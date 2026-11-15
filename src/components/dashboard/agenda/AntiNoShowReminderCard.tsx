'use client'

import { useMemo, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { siteUrl } from '@/lib/site-url'
import { whatsappNumber } from '@/lib/quotes/quote-math'
import { buildAppointmentWhatsApp } from '@/lib/agenda/messages'
import { utcToZoned } from '@/lib/agenda/time'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'

interface AntiNoShowReminderCardProps {
  data: AgendaData
  date: string
  onAppointmentUpdated: (updated: Appointment) => void
}

export function AntiNoShowReminderCard({
  data,
  date,
  onAppointmentUpdated,
}: AntiNoShowReminderCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Mapeo rápido de nombres de profesionales
  const professionalMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of data.professionals) {
      map.set(p.id, p.name)
    }
    return map
  }, [data.professionals])

  // Turnos del día activos (no cancelados ni marcados como ausentes)
  const eligibleAppointments = useMemo(() => {
    return data.appointments
      .filter((apt) => {
        const local = utcToZoned(apt.starts_at, data.timeZone)
        if (local.date !== date) return false
        if (apt.status !== 'pending' && apt.status !== 'confirmed') return false
        return true
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [data.appointments, date, data.timeZone])

  // Turnos que aún no recibieron recordatorio
  const pendingReminders = useMemo(() => {
    return eligibleAppointments.filter((apt) => !apt.reminder_sent_at)
  }, [eligibleAppointments])

  // Si no hay ningún turno activo para este día, no mostrar nada
  if (eligibleAppointments.length === 0) return null

  const handleSendReminder = async (appointment: Appointment) => {
    if (sendingId || !whatsappNumber(appointment.customer_phone)) return
    setSendingId(appointment.id)
    try {
      const profName = appointment.professional_id
        ? professionalMap.get(appointment.professional_id) ?? null
        : null

      const message = buildAppointmentWhatsApp('reminder', {
        storeName: data.storeName,
        customerName: appointment.customer_name,
        serviceName: appointment.service_name,
        startsAt: appointment.starts_at,
        timeZone: data.timeZone,
        professionalName: profName,
        url: siteUrl(`/turno/${appointment.public_token}`),
      })

      const targetPhone = whatsappNumber(appointment.customer_phone) ?? ''
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`

      // Abrir WhatsApp en pestaña nueva
      window.open(waUrl, '_blank', 'noopener,noreferrer')

      // Registrar recordatorio en el backend
      const response = await fetch(`/api/agenda/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reminder_sent' }),
      })

      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { appointment?: Appointment } | null
        if (body?.appointment) {
          onAppointmentUpdated(body.appointment)
        } else {
          onAppointmentUpdated({
            ...appointment,
            reminder_sent_at: new Date().toISOString(),
          })
        }
        toast.success(`Recordatorio preparado para ${appointment.customer_name}`, {
          description: 'Completá el envío en WhatsApp. La apertura quedó registrada en la agenda.',
        })
      } else {
        toast.warning(`Se abrió WhatsApp, pero no se pudo marcar como enviado en el sistema.`)
      }
    } catch {
      toast.error('Ocurrió un error al preparar el recordatorio.')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Bell className="h-5 w-5" />
            {pendingReminders.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white">
                {pendingReminders.length}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                Disparador Anti No-Show (Recordatorios WhatsApp)
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold',
                  pendingReminders.length > 0
                    ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-border bg-muted/50 text-muted-foreground'
                )}
              >
                {pendingReminders.length > 0
                  ? `${pendingReminders.length} por preparar`
                  : 'Todos preparados ✓'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingReminders.length > 0
                ? `Enviá un aviso a los clientes de hoy para confirmar asistencia y asegurar que nadie falte.`
                : `Excelente: todos los turnos activos de hoy ya tienen su recordatorio o confirmación enviada.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingReminders.length > 0 && !expanded && (
            <Button
              size="sm"
              onClick={() => setExpanded(true)}
              className="gap-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              <Bell className="h-3.5 w-3.5" />
              Ver clientes a recordar ({pendingReminders.length})
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                Ocultar <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Ver detalles <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Clientes citados para el <b>{date}</b> ({eligibleAppointments.length} turnos programados)
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Un recordatorio reduce ausencias un 80%
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eligibleAppointments.map((apt) => {
              const localTime = utcToZoned(apt.starts_at, data.timeZone).time
              const profName = apt.professional_id
                ? professionalMap.get(apt.professional_id) ?? 'Sin asignar'
                : 'Sin asignar'
              const isSent = Boolean(apt.reminder_sent_at)

              return (
                <div
                  key={apt.id}
                  className={cn(
                    'flex flex-col justify-between rounded-xl border p-3 transition-all',
                    isSent
                      ? 'border-border/60 bg-card/60 opacity-80'
                      : 'border-emerald-500/30 bg-card shadow-2xs hover:border-emerald-500/60'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {localTime} hs
                      </span>
                      {isSent ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Preparado
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          Pendiente
                        </Badge>
                      )}
                    </div>

                    <p className="truncate text-sm font-bold text-foreground">
                      {apt.customer_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {apt.service_name} · <span className="font-medium text-foreground">{profName}</span>
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                    <span className="text-[11px] text-muted-foreground">
                      {apt.customer_phone || 'Sin WhatsApp'}
                    </span>
                    <Button
                      size="sm"
                      variant={isSent ? 'outline' : 'default'}
                      disabled={sendingId !== null || !whatsappNumber(apt.customer_phone)}
                      onClick={() => void handleSendReminder(apt)}
                      className={cn(
                        'h-8 gap-1.5 text-xs font-bold',
                        !isSent && 'bg-[#25D366] text-white hover:bg-[#1ebe5a]'
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {isSent ? 'Reenviar' : 'Recordar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
