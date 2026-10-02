import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { normalizeOpeningHours } from '@/lib/agenda/slots'

export const dynamic = 'force-dynamic'

export const GET = withTenantAuth({ permission: 'pos.sales.read', module: 'services' }, async (_request, { organization }) => {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const config = await loadAgendaConfig(supabase, organization.id)
  if (!config) return NextResponse.json({ available: false })
  return NextResponse.json({ available: true, ...config, bookingUrl: siteUrl(`/${organization.slug}/turnos`) })
})

const settingsSchema = z.object({
  slot_minutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  opening_hours: z.record(z.string(), z.array(z.tuple([z.string(), z.string()])).max(4)),
  online_booking: z.boolean(),
  require_confirmation: z.boolean(),
  min_notice_minutes: z.number().int().min(0).max(10080),
  max_days_ahead: z.number().int().min(1).max(180),
  booking_message: z.string().trim().max(500).nullable().optional(),
  services: z.array(z.object({
    product_id: z.string().uuid(),
    duration_minutes: z.number().int().min(5).max(600),
    online: z.boolean(),
  })).max(500).default([]),
})

export const PUT = withTenantAuth({ permission: 'settings.manage', module: 'services' }, async (request, { organization }) => {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá la configuración de la agenda' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { services, ...settings } = parsed.data

  const { error } = await supabase.from('agenda_settings').upsert({
    ...settings,
    opening_hours: normalizeOpeningHours(settings.opening_hours),
    booking_message: settings.booking_message || null,
    organization_id: organization.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' })
  if (error) {
    logger.error('No se pudo guardar la configuración de la agenda', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar la configuración' }, { status: 500 })
  }

  if (services.length) {
    const { error: servicesError } = await supabase
      .from('agenda_services')
      .upsert(services.map((service) => ({ ...service, organization_id: organization.id })), { onConflict: 'organization_id,product_id' })
    if (servicesError) {
      logger.error('No se pudieron guardar las duraciones', { error: servicesError.message })
      return NextResponse.json({ error: 'Se guardó el horario, pero no las duraciones de los servicios' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, ...(await loadAgendaConfig(supabase, organization.id)) })
})
