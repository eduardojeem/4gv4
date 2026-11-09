import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarCheck2, Clock, MapPin, Phone, ArrowLeft } from 'lucide-react'
import { WhatsAppIcon } from '@/components/public/SocialIcons'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { Button } from '@/components/ui/button'

/**
 * La página «Reservá tu turno», compartida por /<tienda>/turnos, /<tienda>/reservas
 * y por la tienda en su propio subdominio (/turnos, /reservas).
 */
export async function bookingOrganization(slug: string | null | undefined) {
  if (!slug) return null
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) return null
  const config = await loadAgendaConfig(createAdminSupabase() as unknown as SupabaseClient, organization.id, { onlyActive: true })
  return config?.settings.online_booking ? organization : null
}

export async function bookingPageMetadata(slug: string | null | undefined): Promise<Metadata> {
  if (!slug) return { title: 'Turnos no disponibles' }
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  return organization
    ? { title: `Reservar Turno | ${organization.name}`, description: `Elegí servicio, día y horario en ${organization.name}.` }
    : { title: 'Página no encontrada' }
}

/** `servicio` llega desde la carta de la portada para arrancar con ese servicio elegido. */
export function serviceFromSearchParams(params: { servicio?: string | string[] } | undefined) {
  return typeof params?.servicio === 'string' ? params.servicio : undefined
}

export async function BookingPageContent({ slug, initialServiceId }: { slug: string | null | undefined; initialServiceId?: string }) {
  if (!slug) notFound()
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization) notFound()

  const admin = createAdminSupabase() as unknown as SupabaseClient
  const servicesEnabled = await isOrganizationModuleEnabled(organization.id, 'services')
  const config = servicesEnabled ? await loadAgendaConfig(admin, organization.id, { onlyActive: true }) : null
  const onlineBookingActive = Boolean(config?.settings.online_booking)

  const settings = await fetchWebsiteSettings()
  const companyInfo = settings?.company_info
  const phone = companyInfo?.phone?.trim()
  const rawWhatsapp = companyInfo?.whatsapp || companyInfo?.phone || ''
  const whatsappClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappClean
    ? `https://wa.me/${whatsappClean}?text=${encodeURIComponent(`Hola, quisiera agendar un turno en ${organization.name}`)}`
    : null
  const address = companyInfo?.address?.trim()
  const hours = companyInfo?.hours?.weekdays?.trim()

  return (
    <section aria-label="Reservas" className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-10">
      {/* Encabezado Principal */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          <CalendarCheck2 className="h-3.5 w-3.5" />
          <span>Reservas online</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tu próximo turno, a tu manera
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {organization.name} · Elegí tu servicio, encontrá tu horario y revisá los detalles antes de confirmar.
        </p>
      </div>

      <nav aria-label="Pasos de la reserva" className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        {['Servicio y profesional', 'Día y horario', 'Revisar y confirmar'].map((step, index) => <div key={step} className="rounded-xl border bg-card p-3"><span className="mb-1 block font-semibold text-primary">0{index + 1}</span>{step}</div>)}
      </nav>
      {onlineBookingActive ? (
        <div className="rounded-3xl border border-border bg-card p-2 sm:p-4 dark:border-primary/20">
          <PublicBooking slug={slug} initialServiceId={initialServiceId} />
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-10 shadow-xl text-center space-y-6 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarCheck2 className="h-7 w-7" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Coordinación de Turnos
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              En <strong className="text-foreground">{organization.name}</strong> atendemos con turnos y horarios coordinados directamente con nuestro equipo.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-all"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span>Agendar por WhatsApp</span>
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted dark:border-zinc-700 dark:bg-zinc-900 active:scale-95 transition-all"
              >
                <Phone className="h-4 w-4 text-primary" />
                <span>Llamar: {phone}</span>
              </a>
            )}
          </div>

          {(address || hours) && (
            <div className="pt-6 border-t border-border/60 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              {address && (
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Ubicación</p>
                    <p>{address}</p>
                  </div>
                </div>
              )}
              {hours && (
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-foreground">Horarios</p>
                    <p>{hours}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4">
            <Button variant="ghost" size="sm" asChild className="gap-2 text-xs">
              <Link href={`/${slug}/inicio`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a la portada de {organization.name}
              </Link>
            </Button>
          </div>
        </div>
      )}
      {onlineBookingActive && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4 text-sm"><div><p className="font-medium">¿Necesitás ayuda con tu reserva?</p><p className="text-muted-foreground">Consultá con {organization.name} antes de confirmar.</p></div>{whatsappHref && <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-medium hover:bg-muted" href={whatsappHref} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-4 w-4" />Consultar por WhatsApp</a>}</aside>}
    </section>
  )
}
