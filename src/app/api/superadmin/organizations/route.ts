import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/superadmin/auth'

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
  const superAdmin = await requireSuperAdmin()
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

  // Check slug uniqueness
  const { data: existing } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: `El slug "${slug}" ya está en uso.` }, { status: 409 })

  // Create organization
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, slug, plan })
    .select('id, name, slug, plan')
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message || 'No se pudo crear la organización.' }, { status: 500 })
  }

  // Setup in parallel: settings + branch + subscription
  const trialDays = typeof subscriptionPlan.trial_days === 'number' && Number.isFinite(subscriptionPlan.trial_days)
    ? Math.max(0, subscriptionPlan.trial_days)
    : 14
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  await Promise.allSettled([
    admin.from('organization_settings').upsert({
      organization_id: org.id,
      display_name: name,
      currency,
      timezone,
      branding: {},
      modules: { onboarding: { status: 'pending', selected_plan: plan, started_at: now } },
    }, { onConflict: 'organization_id' }),
    admin.from('branches').insert({
      organization_id: org.id,
      name: 'Sucursal principal',
      slug: 'principal',
      is_active: true,
      is_default: true,
    }),
    admin.from('subscriptions').upsert({
      organization_id: org.id,
      plan,
      status: 'trialing',
      trial_ends_at: trialEndsAt,
      cancel_at_period_end: false,
    }, { onConflict: 'organization_id' }),
    admin.from('audit_log').insert({
      user_id: superAdmin.id,
      action: 'create',
      resource: 'organizations',
      resource_id: org.id,
      new_values: { name, slug, plan, created_by: 'superadmin' },
    }),
  ])

  // Create owner if email provided
  let ownerCreated = false
  let ownerError: string | null = null

  if (ownerEmail) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const origin = request.headers.get('origin') ?? new URL(request.url).origin

      // Invite owner via Supabase auth (sends magic link)
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        data: {
          full_name: ownerName || ownerEmail.split('@')[0],
          company_name: name,
          company_slug: slug,
          selected_plan: plan,
          registration_type: 'company_owner',
        },
        redirectTo: `${origin}/auth/callback?next=/dashboard/onboarding`,
      })

      if (inviteError) {
        ownerError = inviteError.message
      } else if (inviteData?.user) {
        const userId = inviteData.user.id
        await Promise.allSettled([
          admin.from('profiles').upsert({ id: userId, email: ownerEmail, full_name: ownerName || ownerEmail.split('@')[0], role: 'admin', status: 'active' }),
          admin.from('user_roles').upsert({ user_id: userId, role: 'admin', is_active: true }, { onConflict: 'user_id' }),
          admin.from('organization_members').upsert({ organization_id: org.id, user_id: userId, role: 'owner', status: 'active' }, { onConflict: 'organization_id,user_id' }),
          admin.from('organizations').update({ owner_id: userId }).eq('id', org.id),
        ])
        ownerCreated = true
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
  const superAdmin = await requireSuperAdmin()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ available: false })

  const admin = createAdminSupabase()
  const { data } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
  return NextResponse.json({ available: !data })
}
