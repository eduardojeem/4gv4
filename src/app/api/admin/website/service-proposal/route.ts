import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { ServiceWebsiteOptionsSchema } from '@/lib/website/service-website-proposal'
import { prepareServiceWebsiteProposal } from '@/lib/website/service-website-proposal-server'
import { revalidatePath, revalidateTag } from 'next/cache'

const ApplySchema = ServiceWebsiteOptionsSchema.extend({ revision: z.string().regex(/^[a-f0-9]{32}$/) }).strict()
async function handle(request: NextRequest, context: TenantAuthContext, apply: boolean) {
  const body = await request.json().catch(() => null)
  const parsed = (apply ? ApplySchema : ServiceWebsiteOptionsSchema).safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Revisá la plantilla, el color y los textos.' }, { status: 422 })
  try {
    const options = ServiceWebsiteOptionsSchema.parse({ variant: parsed.data.variant, specialties: parsed.data.specialties,
      accentColor: parsed.data.accentColor, title: parsed.data.title, subtitle: parsed.data.subtitle })
    const prepared = await prepareServiceWebsiteProposal(context.organization.id, options)
    if (!apply) return NextResponse.json({ success: true, proposal: prepared.proposal, revision: prepared.revision, services: prepared.services, agenda: prepared.agenda })
    const revision = (parsed.data as z.infer<typeof ApplySchema>).revision
    if (prepared.revision !== revision) throw new Error('PROPOSAL_STALE')
    const { error } = await createAdminSupabase().rpc('apply_service_website_proposal', {
      p_organization_id: context.organization.id, p_actor_user_id: context.user.id,
      p_expected_revision: revision, p_values: prepared.proposal.values,
    })
    if (error) throw new Error(error.message.includes('PROPOSAL_STALE') ? 'PROPOSAL_STALE' : 'PROPOSAL_UNAVAILABLE')
    // Cache failure cannot turn a committed publication into a reported failure.
    try {
      revalidateTag('marketplace:organizations', 'max')
      if (prepared.organizationSlug) revalidatePath(`/${prepared.organizationSlug}`, 'layout')
      revalidatePath('/admin/website')
    } catch { console.warn('Service website applied; cache refresh unavailable.') }
    return NextResponse.json({ success: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROPOSAL_UNAVAILABLE'
    if (code === 'PROPOSAL_STALE') return NextResponse.json({ success: false, code, error: 'La configuración cambió. Generá una nueva vista previa antes de aplicar.' }, { status: 409 })
    if (code === 'SERVICES_UNAVAILABLE') return NextResponse.json({ success: false, code, error: 'Activá el módulo de servicios incluido en tu plan para preparar esta página.' }, { status: 403 })
    return NextResponse.json({ success: false, code: 'PROPOSAL_UNAVAILABLE', error: 'No se pudo preparar o aplicar la página. Verificá las migraciones y volvé a intentar.' }, { status: 503 })
  }
}
export const POST = withTenantAuth({ permission: 'settings.manage' }, (request, context) => handle(request, context, false))
export const PATCH = withTenantAuth({ permission: 'settings.manage' }, (request, context) => handle(request, context, true))
