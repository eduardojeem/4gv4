import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { z } from 'zod'

const createAccountSchema = z.object({
  /** Si true, crea la cuenta con contraseña temporal y envía email de reset. 
   *  Si false, solo envía invitación por email (magic link). */
  sendInvite: z.boolean().default(true),
  /** Contraseña temporal (opcional). Si no se envía, se genera una aleatoria. */
  temporaryPassword: z.string().min(6).max(72).optional(),
})

function generateTemporaryPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * POST /api/customers/[id]/create-account
 * Crea una cuenta de auth para un cliente existente y la vincula automáticamente.
 * Puede enviar invitación por email o crear con contraseña temporal.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 403 })
    }

    const { id: customerId } = await context.params
    const body = await request.json().catch(() => ({}))
    const validation = createAccountSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { sendInvite, temporaryPassword } = validation.data
    const supabase = createAdminSupabase()

    // Verificar que el cliente existe
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, phone, profile_id')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (customer.profile_id) {
      return NextResponse.json(
        { error: 'Este cliente ya tiene una cuenta vinculada' },
        { status: 409 }
      )
    }

    if (!customer.email) {
      return NextResponse.json(
        { error: 'El cliente no tiene email. Agregá un email primero para crear su cuenta.' },
        { status: 422 }
      )
    }

    const email = customer.email.trim().toLowerCase()

    // Verificar que no exista ya un usuario auth con ese email
    const { data: usersData } = await supabase.auth.admin.listUsers()
    const existingUser = (usersData?.users ?? []).find(
      (u: { email?: string }) => u.email?.toLowerCase() === email
    )

    if (existingUser) {
      // Ya existe la cuenta → simplemente vincular
      const { error: linkError } = await supabase
        .from('customers')
        .update({ profile_id: existingUser.id, updated_at: new Date().toISOString() })
        .eq('id', customerId)
        .eq('organization_id', organization.id)

      if (linkError) {
        return NextResponse.json({ error: 'Error al vincular la cuenta existente' }, { status: 500 })
      }

      await supabase.from('organization_members').upsert(
        { organization_id: organization.id, user_id: existingUser.id, role: 'customer', status: 'active' },
        { onConflict: 'organization_id,user_id' }
      )

      return NextResponse.json({
        success: true,
        action: 'linked_existing',
        message: `Ya existía una cuenta con ${email}. Se vinculó automáticamente.`,
      })
    }

    // Crear nueva cuenta de auth
    if (sendInvite) {
      // Opción A: Invitar por email (el cliente recibe un magic link para setear contraseña)
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: customer.name,
          role: 'cliente',
        },
      })

      if (inviteError) {
        return NextResponse.json(
          { error: `No se pudo enviar la invitación: ${inviteError.message}` },
          { status: 500 }
        )
      }

      if (inviteData?.user) {
        // Vincular
        await supabase
          .from('customers')
          .update({ profile_id: inviteData.user.id, updated_at: new Date().toISOString() })
          .eq('id', customerId)
          .eq('organization_id', organization.id)

        await supabase.from('organization_members').upsert(
          { organization_id: organization.id, user_id: inviteData.user.id, role: 'customer', status: 'active' },
          { onConflict: 'organization_id,user_id' }
        )
      }

      return NextResponse.json({
        success: true,
        action: 'invited',
        message: `Se envió una invitación a ${email}. El cliente recibirá un email para crear su contraseña.`,
        email,
      })
    } else {
      // Opción B: Crear con contraseña temporal
      const password = temporaryPassword || generateTemporaryPassword()

      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: customer.name,
          role: 'cliente',
        },
      })

      if (createError) {
        return NextResponse.json(
          { error: `No se pudo crear la cuenta: ${createError.message}` },
          { status: 500 }
        )
      }

      if (createData?.user) {
        // Vincular
        await supabase
          .from('customers')
          .update({ profile_id: createData.user.id, updated_at: new Date().toISOString() })
          .eq('id', customerId)
          .eq('organization_id', organization.id)

        await supabase.from('organization_members').upsert(
          { organization_id: organization.id, user_id: createData.user.id, role: 'customer', status: 'active' },
          { onConflict: 'organization_id,user_id' }
        )

        // Enviar email de reset para que el cliente defina su propia contraseña
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
        await supabase.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: `${origin}/auth/reset-password`,
          },
        })
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        message: `Cuenta creada para ${email}. Se envió un email para que el cliente defina su contraseña.`,
        email,
        temporaryPassword: !temporaryPassword ? password : undefined,
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
