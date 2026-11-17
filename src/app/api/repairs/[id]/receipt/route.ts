import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRepairRouteContext, isNextResponse, fetchRepairById } from '../../_lib'
import { mapSupabaseRepairToUi } from '@/utils/repair-mapping'
import { buildRepairPrintPayload } from '@/lib/repairs/print-payload'
import { generateRepairReceiptHTML } from '@/lib/repair-receipt'
import { normalizeRepairReceiptSettings } from '@/lib/repairs/receipt-settings'
import { resolveTenantEffectiveSettings } from '@/lib/organization/tenant-effective-settings'
import { generateRepairHash } from '@/lib/repair-qr-hash'
import { buildRepairTrackingUrl, buildStoreHomeUrl } from '@/lib/repairs/tracking-url'
const querySchema = z.object({
  type: z.enum(['customer', 'technician']).default('customer'),
  paper: z.enum(['configured', '58mm', '80mm', 'A4']).default('configured'),
})
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRepairRouteContext(request)
    if (isNextResponse(context)) return context
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success)
      return NextResponse.json({ error: 'Reparación inválida.' }, { status: 400 })
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success)
      return NextResponse.json({ error: 'Formato de comprobante inválido.' }, { status: 400 })
    const { data, error } = await fetchRepairById(context, id)
    if (error)
      return NextResponse.json({ error: 'No pudimos consultar la reparación.' }, { status: 500 })
    if (!data)
      return NextResponse.json(
        { error: 'No encontramos la reparación en esta sucursal.' },
        { status: 404 },
      )
    const db = context.supabase
    const [org, settings, branch] = await Promise.all([
      db
        .from('organizations')
        .select('name, slug, logo_url')
        .eq('id', context.organizationId)
        .single(),
      db
        .from('organization_settings')
        .select('display_name, modules, currency, timezone, repair_receipt_settings')
        .eq('organization_id', context.organizationId)
        .maybeSingle(),
      db
        .from('branches')
        .select('phone, email, address, city')
        .eq('organization_id', context.organizationId)
        .eq('is_default', true)
        .maybeSingle(),
    ])
    if (org.error || settings.error || branch.error || !org.data)
      return NextResponse.json(
        { error: 'No pudimos cargar los datos del comercio.' },
        { status: 503 },
      )
    const effective = resolveTenantEffectiveSettings({
      globalRow: {},
      orgSettings: settings.data,
      organizationName: org.data.name,
      defaultBranch: branch.data,
    })
    const repair = mapSupabaseRepairToUi(data as Parameters<typeof mapSupabaseRepairToUi>[0])
    // Un ticket ausente usa el UUID completo; nunca se firma un número ficticio.
    repair.ticketNumber = repair.ticketNumber || id
    const hash = generateRepairHash(
      repair.ticketNumber,
      repair.customer.id || repair.customer.name,
      new Date(repair.createdAt),
    )
    const payload = buildRepairPrintPayload(
      repair,
      {
        name: effective.companyName || org.data.name,
        phone: effective.companyPhone,
        address: effective.companyAddress,
        email: effective.companyEmail,
        logo: org.data.logo_url ?? undefined,
      },
      {
        hash,
        trackingUrl: buildRepairTrackingUrl({
          organizationSlug: org.data.slug,
          ticketNumber: repair.ticketNumber,
          hash,
        })!,
        storeUrl: buildStoreHomeUrl({ organizationSlug: org.data.slug }) ?? undefined,
      },
    )
    const receiptSettings = normalizeRepairReceiptSettings(settings.data?.repair_receipt_settings)
    const paper =
      parsed.data.paper === 'configured' ? receiptSettings.paperFormat : parsed.data.paper
    const html = generateRepairReceiptHTML(
      parsed.data.type,
      payload,
      paper,
      receiptSettings,
    ).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    return NextResponse.json(
      {
        html,
        paper,
        width: paper === '58mm' ? 164 : paper === '80mm' ? 227 : 595,
        ...(paper === 'A4' ? { height: 842 } : {}),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'No pudimos preparar el comprobante. Intentá nuevamente.' },
      { status: 500 },
    )
  }
}
