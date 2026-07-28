import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { upsertBillingProfile } from '@/lib/saas/subscription-service'

const billingProfileSchema = z.object({
  business_name: z.string().trim().min(1, 'Ingresa la razón social.').max(200),
  ruc: z.string().trim().min(1, 'Ingresa el RUC o CI.').max(30)
    .refine((value) => /\d/.test(value), 'El RUC o CI no es válido.'),
  billing_email: z.string().trim().email('El correo de facturación no es válido.').max(254),
  fiscal_address: z.string().trim().min(1, 'Ingresa la dirección fiscal.').max(500),
  phone: z.string().trim().min(1, 'Ingresa el teléfono.').max(50),
}).strict()

export async function PUT(request: Request) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = billingProfileSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Los datos de facturación no son válidos.' },
      { status: 400 },
    )
  }

  try {
    const billingProfile = await upsertBillingProfile(organization.id, parsed.data)
    return NextResponse.json({ billingProfile })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron guardar los datos de facturación.' },
      { status: 500 },
    )
  }
}
