import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { siteUrl } from '@/lib/site-url'
import { findAuthUserByEmail } from '@/lib/superadmin/find-auth-user'
import { provisionOrganizationOwner } from '@/lib/superadmin/provision-owner'
import { normalizeTenantSlug, suggestTenantSlug, validateTenantSlug } from '@/lib/saas/reserved-slugs'
import {
  OWNER_EMAIL_PATTERN,
  parseCreateOrganizationInput,
  trialDaysFrom,
  trialEndDate,
  type OwnerLookup,
  type OwnerOutcome,
  type SlugAvailability,
} from '@/lib/superadmin/create-organization'

/**
 * Pasa por /auth/confirm (no protegida) para establecer la sesion del hash
 * antes de entrar a /dashboard/onboarding. Usa la URL canonica para no generar
 * enlaces a localhost desde dev.
 */
const OWNER_INVITE_REDIRECT = '/auth/confirm?next=/dashboard/onboarding'

export async function POST(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { data: activePlans, error: plansError } = await admin
    .from('subscription_plans')
    .select('tier, trial_days')
    .eq('is_active', true)

  if (plansError) {
    return NextResponse.json({ error: 'No se pudieron cargar los planes activos.' }, { status: 500 })
  }

  const planRows = (activePlans ?? []) as Array<{ tier: string; trial_days: number | null }>
  const parsed = parseCreateOrganizationInput(body, planRows.map((row) => row.tier))
  if (parsed.ok === false) {
    return NextResponse.json({ error: parsed.message, field: parsed.field }, { status: 400 })
  }

  const input = parsed.value
  const planRow = planRows.find((row) => String(row.tier).toUpperCase() === input.plan)
  const trialDays = trialDaysFrom(planRow?.trial_days)
  const trialEndsAt = trialEndDate(trialDays).toISOString()

  const { data: organizationRows, error: orgError } = await admin.rpc('create_superadmin_organization', {
    p_name: input.name,
    p_slug: input.slug,
    p_plan: input.plan,
    p_currency: input.currency,
    p_timezone: input.timezone,
    p_trial_ends_at: trialEndsAt,
  })
  const org = (Array.isArray(organizationRows) ? organizationRows[0] : organizationRows) as
    | { id: string; name: string; slug: string; plan: string }
    | null

  if (orgError || !org) {
    if (orgError?.code === '23505') {
      return NextResponse.json(
        { error: `La dirección «${input.slug}» ya está en uso.`, field: 'slug' },
        { status: 409 }
      )
    }
    // El mensaje crudo de Postgres no le sirve a quien usa la pantalla y
    // describe el esquema: queda en el log del servidor.
    console.error('[superadmin/organizations] create failed', orgError)
    return NextResponse.json({ error: 'No se pudo crear la organización.' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'create',
    resource: 'organizations',
    resourceId: org.id,
    organizationId: org.id,
    newValues: {
      name: input.name,
      slug: input.slug,
      plan: input.plan,
      currency: input.currency,
      timezone: input.timezone,
      trial_ends_at: trialEndsAt,
      owner_email: input.ownerEmail,
    },
    request,
  })

  let owner: OwnerOutcome = { status: 'none' }

  if (input.ownerEmail) {
    const provisioned = await provisionOrganizationOwner(admin, {
      organizationId: org.id,
      organizationName: input.name,
      organizationSlug: input.slug,
      plan: input.plan,
      email: input.ownerEmail,
      fullName: input.ownerName,
      redirectTo: siteUrl(OWNER_INVITE_REDIRECT),
    })
    owner = provisioned.outcome

    await logSuperAdminAction({
      actorId: superAdmin.id,
      actorEmail: superAdmin.email,
      action:
        owner.status === 'invited'
          ? 'invite_owner'
          : owner.status === 'assigned_existing'
            ? 'assign_owner'
            : 'assign_owner_failed',
      resource: 'organizations',
      resourceId: org.id,
      organizationId: org.id,
      newValues: {
        owner_email: input.ownerEmail,
        owner_user_id: provisioned.userId,
        outcome: owner.status,
        reason: owner.status === 'failed' ? owner.reason : null,
      },
      request,
      severity: 'high',
    })
  }

  return NextResponse.json(
    {
      success: true,
      organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      subscription: { status: 'trialing', trialDays, trialEndsAt },
      owner,
    },
    { status: 201 }
  )
}

/**
 * Consultas del formulario mientras se completa: disponibilidad del
 * subdominio (`?slug=`) y si el correo del propietario ya tiene cuenta
 * (`?owner_email=`).
 */
export async function GET(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const admin = createAdminSupabase()
  const ownerEmail = request.nextUrl.searchParams.get('owner_email')

  if (ownerEmail !== null) {
    const email = ownerEmail.trim().toLowerCase()
    if (!OWNER_EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 })
    }

    let lookup: Awaited<ReturnType<typeof findAuthUserByEmail>>
    try {
      lookup = await findAuthUserByEmail(admin, email)
    } catch {
      return NextResponse.json({ error: 'No se pudo verificar el correo.' }, { status: 503 })
    }

    if (!lookup.user) {
      return NextResponse.json<OwnerLookup>({
        email,
        exists: false,
        suspended: false,
        superAdmin: false,
        organizations: 0,
        lookupIncomplete: lookup.scanTruncated,
      })
    }

    const userId = lookup.user.id
    const [{ data: profile }, { data: role }, { count }] = await Promise.all([
      admin.from('profiles').select('status').eq('id', userId).maybeSingle(),
      admin.from('user_roles').select('role, is_active').eq('user_id', userId).maybeSingle(),
      admin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('role', 'customer'),
    ])

    return NextResponse.json<OwnerLookup>({
      email,
      exists: true,
      suspended: profile?.status === 'inactive' || profile?.status === 'suspended',
      superAdmin: role?.role === 'super_admin' && role?.is_active !== false,
      organizations: count ?? 0,
      lookupIncomplete: false,
    })
  }

  // Se normaliza y valida igual que al crear, con las mismas reservas que el
  // registro publico. Antes solo se preguntaba si el slug estaba tomado, asi
  // que `admin` o `marketplace` figuraban como disponibles.
  const slug = normalizeTenantSlug(request.nextUrl.searchParams.get('slug') ?? '')
  const formato = validateTenantSlug(slug)
  if (formato.ok === false) {
    return NextResponse.json<SlugAvailability>({
      slug,
      available: false,
      reason: formato.reason,
      message: formato.message,
      suggestion: formato.reason === 'reserved' ? `${slug}-tienda` : null,
    })
  }

  const candidatos = [slug, ...Array.from({ length: 12 }, (_, i) => `${slug}-${i + 2}`)]
  const { data, error } = await admin.from('organizations').select('slug').in('slug', candidatos)

  // Antes el error se ignoraba y `!data` daba «disponible»: una consulta caida
  // afirmaba que el subdominio estaba libre.
  if (error) {
    return NextResponse.json({ error: 'No se pudo verificar la dirección.' }, { status: 503 })
  }

  const tomados = new Set((data ?? []).map((row) => String(row.slug)))
  if (!tomados.has(slug)) {
    return NextResponse.json<SlugAvailability>({ slug, available: true })
  }

  return NextResponse.json<SlugAvailability>({
    slug,
    available: false,
    reason: 'taken',
    message: 'Esa dirección ya está en uso.',
    suggestion: suggestTenantSlug(slug, (candidato) => tomados.has(candidato)),
  })
}
