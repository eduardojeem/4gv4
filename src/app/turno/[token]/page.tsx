import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarCheck2, Clock, MapPin, MessageCircle, Navigation } from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/currency'
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/lib/agenda/agenda-api'
import { DEFAULT_TIMEZONE, utcToZoned, WEEKDAY_LABELS } from '@/lib/agenda/time'
import { whatsappNumber } from '@/lib/quotes/quote-math'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { siteUrl } from '@/lib/site-url'
import { ManageAppointment } from './ManageAppointment'

export const dynamic = 'force-dynamic'

// El turno de una persona: no se indexa.
export const metadata: Metadata = { title: 'Tu turno', robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

type Professional = { name: string; photo_url?: string | null; specialty?: string | null }

type Row = {
  id: string
  organization_id: string
  customer_name: string
  service_name: string
  price: number
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  agenda_professionals: Professional | Professional[] | null
}

const STATUS_COPY: Record<AppointmentStatus, { title: string; detail: string; tone: string }> = {
  pending: { title: 'Esperando confirmación', detail: 'La tienda tiene que confirmarlo. Te avisan por WhatsApp.', tone: 'bg-amber-50 text-amber-900 border-amber-200' },
  confirmed: { title: 'Turno confirmado', detail: 'Te esperamos. Si no podés venir, cambialo o cancelalo desde acá.', tone: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  completed: { title: APPOINTMENT_STATUS_LABELS.completed, detail: '¡Gracias por venir!', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
  cancelled: { title: 'Turno cancelado', detail: 'Este horario quedó libre. Podés reservar otro cuando quieras.', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
  no_show: { title: APPOINTMENT_STATUS_LABELS.no_show, detail: 'Si fue un error, escribile a la tienda.', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
}

/** Se cambia o cancela desde acá solo antes de que empiece. */
function hasNotStarted(startsAt: string) {
  return Date.parse(startsAt) > Date.now()
}

/**
 * La foto y especialidad del profesional son de una migración posterior: sin
 * ella, se pide solo el nombre en vez de romper la página.
 */
async function loadAppointment(token: string) {
  const admin = createAdminSupabase()
  const query = (professional: string) =>
    admin
      .from('appointments')
      .select(`id, organization_id, customer_name, service_name, price, starts_at, ends_at, status, agenda_professionals(${professional})`)
      .eq('public_token', token)
      .maybeSingle()
  const full = await query('name, photo_url, specialty')
  if (full.error && /photo_url|specialty/.test(full.error.message ?? '')) return (await query('name')).data as unknown as Row | null
  return full.data as unknown as Row | null
}

export default async function AppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID.test(token)) notFound()
  const appointment = await loadAppointment(token)
  if (!appointment) notFound()

  const admin = createAdminSupabase()
  const [{ data: org }, { data: settings }, { data: info }] = await Promise.all([
    admin.from('organizations').select('name, slug').eq('id', appointment.organization_id).maybeSingle(),
    admin.from('organization_settings').select('timezone, currency, company_address').eq('organization_id', appointment.organization_id).maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', appointment.organization_id).eq('key', 'company_info').maybeSingle(),
  ])
  const orgSettings = (settings ?? {}) as { timezone?: string | null; currency?: string | null; company_address?: string | null }
  const timeZone = orgSettings.timezone || DEFAULT_TIMEZONE
  const currency = orgSettings.currency || 'PYG'
  const company = ((info as { value?: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof company[key] === 'string' && (company[key] as string).trim()) || null
  const organization = (org ?? {}) as { name?: string; slug?: string }
  const storeName = text('name') || organization.name || 'la tienda'
  const logo = text('logoUrl')
  const address = text('address') || orgSettings.company_address || null
  const mapsHref = text('mapsUrl') || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null)
  const wa = whatsappNumber(text('whatsapp') || text('phone'))
  const brandColor = text('brandColor') || 'blue'
  const customBrand = brandColor === 'custom' && isValidBrandHexColor(text('customBrandColor') ?? undefined) ? text('customBrandColor') : null

  const professional = Array.isArray(appointment.agenda_professionals) ? appointment.agenda_professionals[0] : appointment.agenda_professionals
  const start = utcToZoned(appointment.starts_at, timeZone)
  const end = utcToZoned(appointment.ends_at, timeZone)
  const [, month, day] = start.date.split('-').map(Number)
  const active = appointment.status === 'pending' || appointment.status === 'confirmed'
  const changeable = active && hasNotStarted(appointment.starts_at)
  const status = STATUS_COPY[appointment.status]
  const storeHref = organization.slug ? `/${organization.slug}/inicio` : null

  return (
    <main
      className="min-h-screen bg-muted/40 px-4 py-8 text-foreground sm:py-12"
      data-color-scheme={customBrand ? undefined : brandColor}
      data-custom-brand={customBrand ? '' : undefined}
      style={customBrand ? ({ '--brand-primary': customBrand } as CSSProperties) : undefined}
    >
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-11 w-11 rounded-xl object-contain" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-serif text-xl text-primary-foreground">{storeName.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tu turno en</p>
            <h1 className="truncate text-lg font-bold">{storeName}</h1>
          </div>
        </header>

        <div className="overflow-hidden rounded-3xl bg-background shadow-sm">
          <div className={`border-b px-5 py-3 ${status.tone}`} role="status">
            <p className="text-sm font-semibold">{status.title}</p>
            <p className="text-xs opacity-80">{status.detail}</p>
          </div>

          <div className="flex items-center gap-4 p-5">
            <div className="flex w-20 shrink-0 flex-col items-center rounded-2xl bg-primary py-2 text-primary-foreground">
              <span className="text-xs uppercase tracking-wide">{WEEKDAY_LABELS[start.weekday].slice(0, 3)}</span>
              <span className="text-3xl font-bold leading-none">{day}</span>
              <span className="text-xs">{MONTHS[month - 1].slice(0, 3)}</span>
            </div>
            <div className="min-w-0">
              <p className={`text-2xl font-bold ${active ? '' : 'text-muted-foreground line-through'}`}>{start.time}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                {WEEKDAY_LABELS[start.weekday]} {day} de {MONTHS[month - 1]}, hasta las {end.time}
              </p>
            </div>
          </div>

          <dl className="space-y-3 border-t px-5 py-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Servicio</dt>
              <dd className="text-right font-semibold">
                {appointment.service_name}
                {Number(appointment.price) > 0 && <span className="block font-normal text-muted-foreground">{formatCurrency(Number(appointment.price), { currency })}</span>}
              </dd>
            </div>
            {professional?.name && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Te atiende</dt>
                <dd className="flex items-center gap-2 text-right">
                  <span>
                    <span className="block font-semibold">{professional.name}</span>
                    {professional.specialty && <span className="block text-xs text-muted-foreground">{professional.specialty}</span>}
                  </span>
                  {professional.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={professional.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  )}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">A nombre de</dt>
              <dd className="text-right">{appointment.customer_name}</dd>
            </div>
          </dl>

          {address && (
            <div className="flex items-center justify-between gap-3 border-t px-5 py-4 text-sm">
              <p className="flex min-w-0 items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{address}</span>
              </p>
              {mapsHref && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                  <Navigation aria-hidden="true" className="h-3.5 w-3.5" />
                  Cómo llegar
                </a>
              )}
            </div>
          )}
        </div>

        <ManageAppointment
          token={token}
          changeable={changeable}
          calendar={active ? {
            startsAt: appointment.starts_at,
            endsAt: appointment.ends_at,
            title: `${appointment.service_name} · ${storeName}`,
            location: address,
            url: siteUrl(`/turno/${token}`),
          } : null}
        />

        <div className="grid gap-2">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white">
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Escribir a la tienda
            </a>
          )}
          {!active && storeHref && (
            <Link href={storeHref} className="flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
              Reservar otro turno
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
