import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { siteUrl } from '@/lib/site-url'
import { linkPublicCustomerAccount } from '@/lib/customers/link-public-customer-account'
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

async function getCustomerId(routeContext: unknown): Promise<string | null> {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = params ? await Promise.resolve(params) : null
  return resolved?.id ?? null
}

/**
 * POST /api/customers/[id]/create-account
 * Crea una cuenta de auth para un cliente existente y la vincula automáticamente.
 * Puede enviar invitación por email o crear con contraseña temporal.
 */
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }, routeContext) => {
  try {
    const customerId = await getCustomerId(routeContext)
    if (!customerId) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
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
    const linkUser = (profileId: string) => linkPublicCustomerAccount(supabase, {
      organizationId: organization.id,
      profileId,
      fullName: customer.name,
      email,
      phone: customer.phone,
      customerId,
    })

    // Verificar que no exista ya un usuario auth con ese email
    const { data: usersData } = await supabase.auth.admin.listUsers()
    const existingUser = (usersData?.users ?? []).find(
      (u: { email?: string }) => u.email?.toLowerCase() === email
    )

    if (existingUser) {
      // La ficha y la membresía se escriben en una sola transacción de base.
      await linkUser(existingUser.id)

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
        await linkUser(inviteData.user.id)
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
        await linkUser(createData.user.id)

        // Enviar email de reset para que el cliente defina su propia contraseña
        const recovery = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: siteUrl('/auth/reset-password'),
        })
        if (recovery.error) {
          return NextResponse.json({ error: 'La cuenta fue creada, pero no se pudo enviar el correo para definir la contraseña.' }, { status: 502 })
        }
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
})
