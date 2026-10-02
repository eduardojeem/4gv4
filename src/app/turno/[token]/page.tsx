import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/currency'
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/lib/agenda/agenda-api'
import { appointmentWhen } from '@/lib/agenda/messages'
import { DEFAULT_TIMEZONE, utcToZoned } from '@/lib/agenda/time'
import { whatsappNumber } from '@/lib/quotes/quote-math'
import { CancelAppointmentButton } from './CancelAppointmentButton'

export const dynamic = 'force-dynamic'

// El turno de una persona: no se indexa.
export const metadata: Metadata = { title: 'Tu turno', robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Se cancela desde acá solo antes de que empiece. */
function hasNotStarted(startsAt: string) {
  return Date.parse(startsAt) > Date.now()
}

type Row = {
  organization_id: string
  customer_name: string
  service_name: string
  price: number
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  agenda_professionals: { name: string } | Array<{ name: string }> | null
}

export default async function AppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID.test(token)) notFound()
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('appointments')
    .select('organization_id, customer_name, service_name, price, starts_at, ends_at, status, agenda_professionals(name)')
    .eq('public_token', token)
    .maybeSingle()
  if (!data) notFound()
  const appointment = data as unknown as Row
  const [{ data: org }, { data: settings }, { data: info }] = await Promise.all([
    admin.from('organizations').select('name').eq('id', appointment.organization_id).maybeSingle(),
    admin.from('organization_settings').select('timezone, currency, company_address').eq('organization_id', appointment.organization_id).maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', appointment.organization_id).eq('key', 'company_info').maybeSingle(),
  ])
  const orgSettings = (settings ?? {}) as { timezone?: string | null; currency?: string | null; company_address?: string | null }
  const timeZone = orgSettings.timezone || DEFAULT_TIMEZONE
  const currency = orgSettings.currency || 'PYG'
  const company = ((info as { value?: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>
  const storeName = (org as { name?: string } | null)?.name ?? 'la tienda'
  const address = (typeof company.address === 'string' && company.address) || orgSettings.company_address || null
  const wa = whatsappNumber(typeof company.whatsapp === 'string' ? company.whatsapp : null)
  const professional = Array.isArray(appointment.agenda_professionals) ? appointment.agenda_professionals[0]?.name : appointment.agenda_professionals?.name
  const active = appointment.status === 'pending' || appointment.status === 'confirmed'
  const upcoming = active && hasNotStarted(appointment.starts_at)

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Turno en</p>
          <h1 className="text-xl font-bold">{storeName}</h1>
        </div>
        <p className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${appointment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : appointment.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {appointment.status === 'pending' ? 'Esperando confirmación de la tienda' : APPOINTMENT_STATUS_LABELS[appointment.status]}
        </p>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-slate-500">Cuándo</dt><dd className="text-base font-semibold first-letter:uppercase">{appointmentWhen(appointment.starts_at, timeZone)} — {utcToZoned(appointment.ends_at, timeZone).time}</dd></div>
          <div><dt className="text-slate-500">Servicio</dt><dd>{appointment.service_name}{Number(appointment.price) > 0 && ` · ${formatCurrency(Number(appointment.price), { currency })}`}</dd></div>
          {professional && <div><dt className="text-slate-500">Te atiende</dt><dd>{professional}</dd></div>}
          <div><dt className="text-slate-500">A nombre de</dt><dd>{appointment.customer_name}</dd></div>
          {address && <div><dt className="text-slate-500">Dirección</dt><dd>{address}</dd></div>}
        </dl>
        <div className="flex flex-col gap-2 border-t pt-4">
          {wa && <a href={`https://wa.me/${wa}`} className="rounded-lg bg-[#25D366] px-4 py-2 text-center text-sm font-semibold text-white">Escribir a la tienda</a>}
          {upcoming && <CancelAppointmentButton token={token} />}
        </div>
      </div>
    </main>
  )
}
