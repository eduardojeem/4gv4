import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { siteUrl } from '@/lib/site-url'

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function normalizePlanCode(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'basic' || normalized === 'starter') return 'BASIC'
  if (normalized === 'pro' || normalized === 'profesional' || normalized === 'professional') return 'PRO'
  if (normalized === 'enterprise') return 'ENTERPRISE'
  return 'FREE'
}

export async function POST(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : slugify(name)
  const plan = normalizePlanCode(typeof body.plan === 'string' ? body.plan : 'FREE')
  const currency = typeof body.currency === 'string' ? body.currency : 'PYG'
  const timezone = typeof body.timezone === 'string' ? body.timezone : 'America/Asuncion'
  const ownerEmail = typeof body.owner_email === 'string' ? body.owner_email.trim() : ''
  const ownerName = typeof body.owner_name === 'string' ? body.owner_name.trim() : ''

  if (!name) return NextResponse.json({ error: 'El nombre de la organización es obligatorio.' }, { status: 400 })
  if (!slug) return NextResponse.json({ error: 'El slug es obligatorio.' }, { status: 400 })
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: 'El slug solo puede contener letras, números y guiones.' }, { status: 400 })

  const admin = createAdminSupabase()

  const { data: subscriptionPlan, error: planError } = await admin
    .from('subscription_plans')
    .select('tier, name, is_active, trial_days')
    .eq('tier', plan.toLowerCase())
    .eq('is_active', true)
    .maybeSingle()

  if (planError) {
    return NextResponse.json({ error: 'No se pudo validar el plan seleccionado.' }, { status: 500 })
  }

  if (!subscriptionPlan) {
    return NextResponse.json({ error: 'El plan seleccionado no esta disponible.' }, { status: 400 })
  }

  const trialDays = typeof subscriptionPlan.trial_days === 'number' && Number.isFinite(subscriptionPlan.trial_days)
    ? Math.max(0, subscriptionPlan.trial_days)
    : 14
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: organizationRows, error: orgError } = await admin.rpc('create_superadmin_organization', {
    p_name: name,
    p_slug: slug,
    p_plan: plan,
    p_currency: currency,
    p_timezone: timezone,
    p_trial_ends_at: trialEndsAt,
  })
  const org = Array.isArray(organizationRows) ? organizationRows[0] : organizationRows

  if (orgError || !org) {
    const conflict = orgError?.code === '23505'
    return NextResponse.json(
      { error: conflict ? `El slug "${slug}" ya está en uso.` : orgError?.message || 'No se pudo crear la organización.' },
      { status: conflict ? 409 : 500 }
    )
  }

  await logSuperAdminAction({
    actorId: superAdmin.id,
    actorEmail: superAdmin.email,
    action: 'create',
    resource: 'organizations',
    resourceId: org.id,
    organizationId: org.id,
    newValues: { name, slug, plan },
    request,
  })

  // Create owner if email provided
  let ownerCreated = false
  let ownerError: string | null = null

  if (ownerEmail) {
    try {
      // Invite owner via Supabase auth (sends magic link)
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        data: {
          full_name: ownerName || ownerEmail.split('@')[0],
          company_name: name,
          company_slug: slug,
          selected_plan: plan,
          registration_type: 'company_owner',
        },
        // Pasa por /auth/confirm (no protegida) para establecer la sesion del
        // hash antes de entrar a /dashboard/onboarding (ruta protegida). Usa la
        // URL canonica para no generar enlaces a localhost desde dev.
        redirectTo: siteUrl('/auth/confirm?next=/dashboard/onboarding'),
      })

      if (inviteError) {
        ownerError = inviteError.message
      } else if (inviteData?.user) {
        const userId = inviteData.user.id
        const { error: assignmentError } = await admin.rpc('assign_superadmin_organization_owner', {
          p_organization_id: org.id,
          p_user_id: userId,
          p_email: ownerEmail,
          p_full_name: ownerName || ownerEmail.split('@')[0],
        })
        ownerError = assignmentError?.message ?? null
        ownerCreated = !assignmentError
        await logSuperAdminAction({
          actorId: superAdmin.id,
          actorEmail: superAdmin.email,
          action: 'invite_owner',
          resource: 'organizations',
          resourceId: org.id,
          organizationId: org.id,
          newValues: { owner_email: ownerEmail, owner_user_id: userId },
          request,
          severity: 'high',
        })
      }
    } catch (err) {
      ownerError = err instanceof Error ? err.message : 'Error al invitar al owner.'
    }
  }

  return NextResponse.json({
    success: true,
    organization: org,
    ownerCreated,
    ownerError,
  }, { status: 201 })
}

// Slug availability check
export async function GET(request: NextRequest) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ available: false })

  const admin = createAdminSupabase()
  const { data } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
  return NextResponse.json({ available: !data })
}
