import Link from 'next/link'
import { CalendarCheck2, CalendarClock, ChevronRight, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { APPOINTMENT_STATUS_LABELS } from '@/lib/agenda/agenda-api'
import { appointmentWhen } from '@/lib/agenda/messages'
import type { CustomerAppointments } from '@/lib/agenda/customer-appointments'

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  confirmed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show: 'bg-muted text-muted-foreground',
}

/**
 * Los turnos del cliente en esta tienda: los próximos, con su enlace para
 * cambiarlos o cancelarlos, y los últimos que tuvo.
 */
export function ProfileAppointments({ appointments, bookingHref }: { appointments: CustomerAppointments; bookingHref: string }) {
  const { upcoming, past, timeZone } = appointments

  return (
    <section id="turnos" aria-labelledby="profile-appointments-title" className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 id="profile-appointments-title" className="text-sm font-semibold text-foreground">Mis turnos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {upcoming.length === 0 ? 'No tenés turnos próximos.' : `${upcoming.length} ${upcoming.length === 1 ? 'turno próximo' : 'turnos próximos'}`}
          </p>
        </div>
        <Button asChild size="sm" className="min-h-9">
          <Link href={bookingHref}><CalendarCheck2 className="h-4 w-4" /> Reservar turno</Link>
        </Button>
      </div>

      {upcoming.length > 0 && (
        <ul className="divide-y divide-border">
          {upcoming.map((appointment) => (
            <li key={appointment.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarClock aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{appointment.serviceName}</p>
                <p className="text-xs capitalize text-muted-foreground">{appointmentWhen(appointment.startsAt, timeZone)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className={cn('rounded-full px-2 py-0.5 font-semibold', STATUS_TONE[appointment.status])}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</span>
                  {appointment.professionalName && <span className="inline-flex items-center gap-1"><User aria-hidden="true" className="h-3 w-3" />{appointment.professionalName}</span>}
                  {appointment.price != null && appointment.price > 0 && <span>{formatCurrency(appointment.price)}</span>}
                </p>
              </div>
              {appointment.token && (
                <Button asChild variant="outline" size="sm" className="min-h-9">
                  <Link href={`/turno/${appointment.token}`} aria-label={`Ver, cambiar o cancelar el turno de ${appointment.serviceName}`}>
                    Cambiar o cancelar <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground sm:px-5">
            Anteriores ({past.length})
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {past.map((appointment) => (
              <li key={appointment.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{appointment.serviceName}</span>
                  <span className="block text-xs capitalize text-muted-foreground">{appointmentWhen(appointment.startsAt, timeZone)}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE[appointment.status])}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">Cuando reserves, tus turnos aparecen acá con su enlace para cambiarlos o cancelarlos.</p>
      )}
    </section>
  )
}
