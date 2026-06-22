import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'
import { sendEmail, renderBrandedEmail } from '@/lib/email/resend'
import { canCreateResource } from '@/lib/saas/subscription-service'

type ImportUser = {
  name: string
  email: string
  role?: string
  status?: string
  phone?: string
  department?: string
}

type CanonicalRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type ProfileStatus = 'active' | 'inactive' | 'suspended'

const MAX_IMPORT_SIZE = 100
const DEFAULT_ROLE: CanonicalRole = 'cliente'
const DEFAULT_STATUS: ProfileStatus = 'active'

function genPassword(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+'
  let pass = ''
  for (let i = 0; i < len; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

function normalizeRole(role?: string): CanonicalRole {
  const mapped = mapUiRoleToDbRole(role) as CanonicalRole | undefined
  return mapped ?? DEFAULT_ROLE
}

function normalizeStatus(value?: string): ProfileStatus {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return DEFAULT_STATUS
}

async function loadExistingUsersByEmail(supabaseAdmin: ReturnType<typeof createAdminSupabase>) {
  const existingMap = new Map<string, string>()
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const batch = data?.users ?? []
    for (const existing of batch) {
      const email = existing.email?.toLowerCase()
      if (email) {
        existingMap.set(email, existing.id)
      }
    }

    if (batch.length < perPage) break
    page += 1
  }

  return existingMap
}

function mapRoleToOrgRole(role: CanonicalRole): string {
  switch (role) {
    case 'admin':       return 'admin'
    case 'vendedor':    return 'seller'
    case 'tecnico':     return 'technician'
    case 'cliente':     return 'customer'
    default:            return 'customer'
  }
}

function mapStatusToOrgMemberStatus(status: ProfileStatus): 'active' | 'suspended' {
  return status === 'active' ? 'active' : 'suspended'
}

function countsTowardUserLimit(role: CanonicalRole) {
  return role !== 'cliente' && role !== 'super_admin'
}

async function countStaffMembershipAdditions(
  supabaseAdmin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  users: Array<{ email: string | undefined; role: CanonicalRole; status: ProfileStatus }>,
  existingMap: Map<string, string>
) {
  const staffEmails = Array.from(
    new Set(
      users
        .filter((user) => user.email && user.status === 'active' && countsTowardUserLimit(user.role))
        .map((user) => user.email as string)
    )
  )

  if (staffEmails.length === 0) return 0

  const existingStaffUserIds = staffEmails
    .map((email) => existingMap.get(email))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const existingStaffMemberIds = new Set<string>()

  if (existingStaffUserIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status')
      .eq('organization_id', organizationId)
      .in('user_id', existingStaffUserIds)
      .neq('role', 'customer')
      .eq('status', 'active')

    if (error) throw error

    for (const row of data ?? []) {
      existingStaffMemberIds.add(String(row.user_id))
    }
  }

  return staffEmails.filter((email) => {
    const existingId = existingMap.get(email)
    return !existingId || !existingStaffMemberIds.has(existingId)
  }).length
}

async function handler(req: NextRequest, context: { user: { id: string; email?: string; role: string }; organizationId: string | null }) {
  try {
    const body = await req.json()
    const users: ImportUser[] = Array.isArray(body?.users) ? body.users : []

    if (!users.length) {
      return NextResponse.json({ ok: false, error: 'No users provided' }, { status: 400 })
    }

    if (users.length > MAX_IMPORT_SIZE) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_IMPORT_SIZE} users per import` },
        { status: 400 }
      )
    }

    const hasSuperAdminAttempt = users.some((u) => normalizeRole(u.role) === 'super_admin')
    if (hasSuperAdminAttempt && context.user.role !== 'super_admin') {
      logger.warn('Unauthorized super_admin creation attempt', {
        userId: context.user.id,
        userRole: context.user.role,
      })

      return NextResponse.json(
        {
          ok: false,
          error: 'Only super administrators can create super_admin users',
        },
        { status: 403 }
      )
    }

    const normalizedUsers = users.map((u) => ({
      email: u.email?.toLowerCase().trim(),
      name: u.name?.trim(),
      role: normalizeRole(u.role),
      status: normalizeStatus(u.status),
      phone: u.phone?.trim() || null,
      department: u.department?.trim() || null,
    }))

    const invalid = normalizedUsers.find((u) => !u.email || !u.name)
    if (invalid) {
      return NextResponse.json(
        { ok: false, error: 'Each imported user requires a valid name and email' },
        { status: 400 }
      )
    }

    logger.info('Starting user import', {
      importedBy: context.user.id,
      userCount: users.length,
    })

    const results: { email: string; ok: boolean; error?: string; invite_link?: string | null }[] = []

    let supabaseAdmin: ReturnType<typeof createAdminSupabase> | null = null
    try {
      supabaseAdmin = createAdminSupabase()
    } catch (err) {
      logger.warn('Service role client not available for user import, using fallback mode', {
        error: err instanceof Error ? err.message : String(err),
      })
      supabaseAdmin = null
    }

    if (supabaseAdmin) {
      const existingMap = await loadExistingUsersByEmail(supabaseAdmin)

      if (context.organizationId) {
        const staffAdditions = await countStaffMembershipAdditions(
          supabaseAdmin,
          context.organizationId,
          normalizedUsers,
          existingMap
        )

        if (staffAdditions > 0) {
          const quota = await canCreateResource(context.organizationId, 'users', staffAdditions)

          if (!quota.allowed) {
            const planName = quota.plan?.name || quota.plan?.code || 'actual'
            const limitText = quota.limit === null ? 'ilimitado' : String(quota.limit)

            return NextResponse.json(
              {
                ok: false,
                error: quota.blocked
                  ? 'No se pueden agregar usuarios porque la suscripcion de la organizacion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas accesos.'
                  : quota.expired
                    ? `No hay cupo para agregar estos usuarios. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} usuarios activos. Actualmente hay ${quota.current} activos e intentas agregar ${staffAdditions}.`
                  : `No hay cupo para agregar estos usuarios. El plan ${planName} permite ${limitText} usuarios activos. Actualmente hay ${quota.current} activos e intentas agregar ${staffAdditions}.`,
                plan: {
                  code: quota.plan?.code,
                  name: quota.plan?.name,
                  limit: quota.limit,
                  current: quota.current,
                  requested: staffAdditions,
                },
              },
              { status: quota.blocked ? 402 : 409 }
            )
          }
        }
      }

      for (const u of normalizedUsers) {
        const email = u.email as string
        const fullName = u.name as string
        const role = u.role
        const status = u.status
        const phone = u.phone
        const department = u.department

        try {
          const existingId = existingMap.get(email)

          if (existingId) {
            // ── Update existing user ──────────────────────────────────────
            const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
              user_metadata: {
                full_name: fullName,
                status,
                imported_via: 'admin_csv',
              },
            })
            if (updateUserError) throw updateUserError

            const nowIso = new Date().toISOString()
            const profilePayload: Record<string, unknown> = {
              id: existingId,
              full_name: fullName,
              email,
              role,
              status,
              updated_at: nowIso,
            }
            if (phone !== null) profilePayload.phone = phone
            if (department !== null) profilePayload.department = department

            const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
              profilePayload,
              { onConflict: 'id' }
            )
            if (profileError) throw profileError

            const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
              {
                user_id: existingId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )
            if (roleError) throw roleError

            if (context.organizationId && role !== 'super_admin') {
              await supabaseAdmin.from('organization_members').upsert(
                {
                  organization_id: context.organizationId,
                  user_id: existingId,
                  role: mapRoleToOrgRole(role),
                  status: mapStatusToOrgMemberStatus(status),
                },
                { onConflict: 'organization_id,user_id' }
              )
            }

            results.push({ email, ok: true, invite_link: null })
            continue
          }

          // ── Create new user ───────────────────────────────────────────
          const password = genPassword()
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            // Confirm email immediately so the recovery link works
            email_confirm: true,
            app_metadata: { role },
            user_metadata: {
              full_name: fullName,
              status,
              imported_via: 'admin_panel',
            },
          })
          if (createErr) throw createErr

          const userId = created?.user?.id
          let inviteLink: string | null = null

          if (userId) {
            const nowIso = new Date().toISOString()

            const profilePayload: Record<string, unknown> = {
              id: userId,
              full_name: fullName,
              email,
              role,
              status,
              updated_at: nowIso,
            }
            if (phone !== null) profilePayload.phone = phone
            if (department !== null) profilePayload.department = department

            const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
              profilePayload,
              { onConflict: 'id' }
            )
            if (profileError) throw profileError

            const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
              {
                user_id: userId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )
            if (roleError) throw roleError

            if (context.organizationId && role !== 'super_admin') {
              await supabaseAdmin.from('organization_members').upsert(
                {
                  organization_id: context.organizationId,
                  user_id: userId,
                  role: mapRoleToOrgRole(role),
                  status: mapStatusToOrgMemberStatus(status),
                },
                { onConflict: 'organization_id,user_id' }
              )
            }

            // Generate a password-recovery link so the admin can share it
            // with the new user to let them set their own password.
            try {
              const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://servix360.org'
              const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                type: 'recovery',
                email,
                options: {
                  redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
                },
              })
              inviteLink = (linkData as any)?.properties?.action_link ?? null

              // Send email automatically if we have a link
              if (inviteLink) {
                const html = renderBrandedEmail({
                  title: 'Bienvenido al sistema',
                  intro: `Hola${fullName ? ` ${fullName}` : ''}, tu cuenta ha sido creada con éxito. Por favor, configurá tu contraseña para poder acceder al sistema.`,
                  cta: { label: 'Configurar mi contraseña', url: inviteLink },
                  footerNote: 'Este enlace expira en 24 horas. Si expira, puedes solicitar uno nuevo en la página de inicio de sesión.',
                })

                await sendEmail({
                  to: email,
                  subject: 'Bienvenido al sistema — Configura tu acceso',
                  html,
                })
              }
            } catch (linkErr) {
              logger.warn('Could not generate invite link for new user', {
                email,
                error: linkErr instanceof Error ? linkErr.message : String(linkErr),
              })
            }

            existingMap.set(email, userId)
          }

          results.push({ email, ok: true, invite_link: inviteLink })
        } catch (e: any) {
          results.push({ email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    } else {
      if (context.organizationId) {
        return NextResponse.json(
          { ok: false, error: 'No se puede crear usuarios de organizacion sin cliente administrativo de Supabase' },
          { status: 500 }
        )
      }

      // ── Fallback: server client (no admin SDK) ────────────────────────
      const supabase = await createServerSupabase()

      for (const u of normalizedUsers) {
        const email = u.email as string
        const fullName = u.name as string
        const role = u.role
        const status = u.status
        const phone = u.phone
        const department = u.department
        const password = genPassword()

        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                status,
                imported_via: 'admin_panel',
              },
            },
          })
          if (error) throw error

          const userId = data?.user?.id
          if (userId) {
            const nowIso = new Date().toISOString()

            const profilePayload: Record<string, unknown> = {
              id: userId,
              full_name: fullName,
              email,
              role,
              status,
              updated_at: nowIso,
            }
            if (phone !== null) profilePayload.phone = phone
            if (department !== null) profilePayload.department = department

            await supabase.from('profiles').upsert(
              profilePayload,
              { onConflict: 'id' }
            )

            await supabase.from('user_roles').upsert(
              {
                user_id: userId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )

            if (context.organizationId && role !== 'super_admin') {
              await supabase.from('organization_members').upsert(
                {
                  organization_id: context.organizationId,
                  user_id: userId,
                  role: mapRoleToOrgRole(role),
                  status: mapStatusToOrgMemberStatus(status),
                },
                { onConflict: 'organization_id,user_id' }
              )
            }
          }

          // In fallback mode, signUp sends a confirmation email automatically
          results.push({ email, ok: true, invite_link: null })
        } catch (e: any) {
          results.push({ email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    }

    const okCount = results.filter((r) => r.ok).length
    const errorCount = results.length - okCount

    if (supabaseAdmin) {
      const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
        user_id: context.user.id,
        action: 'bulk_user_import',
        resource: 'users',
        resource_id: 'bulk',
        new_values: {
          total: users.length,
          imported: okCount,
          failed: errorCount,
          roles: normalizedUsers.map((u) => u.role),
        },
      })

      if (auditError) {
        logger.error('Failed to log user import', { error: auditError })
      }
    }

    logger.info('User import completed', {
      importedBy: context.user.id,
      total: users.length,
      imported: okCount,
      failed: errorCount,
    })

    return NextResponse.json({ ok: true, imported: okCount, failed: errorCount, results })
  } catch (e: any) {
    logger.error('User import error', { error: e?.message })
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export const POST = withAdminAuth(handler)
