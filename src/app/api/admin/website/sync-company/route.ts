import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sanitizeWebsiteSettings } from '@/lib/sanitization/html'
import { validateSetting } from '@/lib/validation/website-settings'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import { z } from 'zod'

const slugSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Solo letras, numeros y guiones permitidos')
    .min(3, 'Minimo 3 caracteres')
    .max(50, 'Maximo 50 caracteres')
    .optional()
)

const syncSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  email: z.string().trim().max(254).optional().or(z.literal('')),
  marketplacePublic: z.boolean().optional(),
  slug: slugSchema,
}).passthrough()

async function handler(request: NextRequest, context: AdminAuthContext) {
  const body = await request.json().catch(() => null)
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 })
  }

  const { name, phone, address, email, marketplacePublic, slug } = parsed.data
  const admin = createAdminSupabase()

  const orgId = await resolveWebsiteAdminOrganizationId(context)
  if (!orgId) {
    return NextResponse.json({ error: 'No se encontro organizacion activa' }, { status: 404 })
  }

  const [
    { data: defaultBranch },
    { data: currentOrganization, error: currentOrganizationError },
  ] = await Promise.all([
    admin
      .from('branches')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('slug')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  if (currentOrganizationError) {
    return NextResponse.json({ error: 'Error al cargar la organizacion actual' }, { status: 500 })
  }

  const currentSlug = currentOrganization?.slug || ''
  const canonicalSlug = slug || currentSlug
  if (!canonicalSlug) {
    return NextResponse.json({ error: 'La ruta publica es obligatoria' }, { status: 400 })
  }

  const { data: existingOrg } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', canonicalSlug)
    .neq('id', orgId)
    .maybeSingle()

  if (existingOrg) {
    return NextResponse.json({ error: 'La ruta publica ya esta en uso por otra organizacion' }, { status: 409 })
  }

  const sanitizedCompanyInfo = sanitizeWebsiteSettings({
    ...parsed.data,
    slug: canonicalSlug,
    marketplacePublic: marketplacePublic !== false,
  })
  const validation = validateSetting('company_info', sanitizedCompanyInfo)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { error: orgUpdateError } = await admin
    .from('organizations')
    .update({
      name,
      marketplace_public: marketplacePublic !== false,
      slug: canonicalSlug,
    })
    .eq('id', orgId)

  if (orgUpdateError) {
    if (orgUpdateError.code === '23505') {
      return NextResponse.json({ error: 'La ruta publica ya esta en uso por otra organizacion' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al actualizar la organizacion' }, { status: 500 })
  }

  const [{ error: settingError }] = await Promise.all([
    admin
      .from('website_settings')
      .upsert(
        {
          organization_id: orgId,
          key: 'company_info',
          value: validation.data,
          updated_by: context.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,key' }
      ),
    admin
      .from('organization_settings')
      .update({ display_name: name })
      .eq('organization_id', orgId),
    defaultBranch?.id
      ? admin
          .from('branches')
          .update({
            phone: phone || null,
            address: address || null,
            email: email || null,
          })
          .eq('id', defaultBranch.id)
      : Promise.resolve(),
  ])

  if (settingError) {
    return NextResponse.json({ error: 'Error al guardar la configuracion del sitio' }, { status: 500 })
  }

  if (currentSlug && currentSlug !== canonicalSlug) {
    await Promise.all([
      admin
        .from('organization_slug_aliases')
        .delete()
        .eq('old_slug', canonicalSlug),
      admin
        .from('organization_slug_aliases')
        .upsert(
          {
            organization_id: orgId,
            old_slug: currentSlug,
            new_slug: canonicalSlug,
            created_by: context.user.id,
          },
          { onConflict: 'old_slug' }
        ),
    ]).catch((error) => {
      console.warn('Could not persist organization slug alias', {
        organizationId: orgId,
        oldSlug: currentSlug,
        newSlug: canonicalSlug,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  return NextResponse.json({ success: true, data: validation.data })
}

export function PUT(request: NextRequest) {
  return withAdminAuth(async (req, ctx) => handler(req, ctx))(request)
}
