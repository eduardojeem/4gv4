import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRepairRouteContext, isNextResponse, fetchRepairById } from '../../_lib'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'
import { repairWhatsAppPhone, repairStatusMessage } from '@/lib/repairs/whatsapp-message'
import { generateRepairHash } from '@/lib/repair-qr-hash'
import { buildRepairTrackingUrl } from '@/lib/repairs/tracking-url'
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRepairRouteContext(request)
    if (isNextResponse(context)) return context
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success)
      return NextResponse.json({ error: 'Reparación inválida.' }, { status: 400 })
    const { data, error } = await fetchRepairById(context, id)
    if (error)
      return NextResponse.json({ error: 'No pudimos consultar el estado actual.' }, { status: 500 })
    if (!data)
      return NextResponse.json(
        { error: 'Reparación no encontrada en esta sucursal.' },
        { status: 404 },
      )
    const [org, settings] = await Promise.all([
      context.supabase
        .from('organizations')
        .select('name, slug')
        .eq('id', context.organizationId)
        .single(),
      context.supabase
        .from('organization_settings')
        .select('display_name, country_code')
        .eq('organization_id', context.organizationId)
        .maybeSingle(),
    ])
    if (org.error || settings.error || !org.data)
      return NextResponse.json({ error: 'No pudimos consultar el comercio.' }, { status: 503 })
    const repair = mapSupabaseRepairToUi(data as Parameters<typeof mapSupabaseRepairToUi>[0])
    const phone = repairWhatsAppPhone(repair.customer.phone, settings.data?.country_code)
    if (!phone)
      return NextResponse.json(
        {
          error:
            'El cliente no tiene un teléfono válido para WhatsApp. Revisá su ficha y agregá el código de país si corresponde.',
        },
        { status: 422 },
      )
    const ticket = repair.ticketNumber || id
    const hash = generateRepairHash(
      ticket,
      repair.customer.id || repair.customer.name,
      new Date(repair.createdAt),
    )
    const trackingUrl = buildRepairTrackingUrl({
      organizationSlug: org.data.slug,
      ticketNumber: ticket,
      hash,
    })
    if (!trackingUrl)
      return NextResponse.json(
        { error: 'El comercio todavía no tiene enlace de seguimiento disponible.' },
        { status: 422 },
      )
    const message = repairStatusMessage({
      customer: repair.customer.name,
      business: settings.data?.display_name || org.data.name,
      device: [repair.brand, repair.model].filter(Boolean).join(' ') || repair.device,
      ticket,
      status: repair.status,
      trackingUrl,
    })
    return NextResponse.json(
      { phone, message, status: repair.status, preparedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'No pudimos preparar el aviso. Intentá nuevamente.' },
      { status: 500 },
    )
  }
}
