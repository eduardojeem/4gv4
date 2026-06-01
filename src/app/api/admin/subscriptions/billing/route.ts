import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { upsertBillingProfile } from '@/lib/saas/subscription-service'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function validEmail(value: unknown) {
  const trimmed = text(value)
  return trimmed && EMAIL_RE.test(trimmed) ? trimmed : null
}

export async function PUT(request: Request) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const billing_email = validEmail(body.billing_email)

  if (body.billing_email !== undefined && body.billing_email !== '' && !billing_email) {
    return NextResponse.json({ error: 'El correo de facturación no es válido.' }, { status: 400 })
  }

  const billingProfile = await upsertBillingProfile(organization.id, {
    business_name: text(body.business_name),
    ruc: text(body.ruc),
    billing_email,
    fiscal_address: text(body.fiscal_address),
    phone: text(body.phone),
  })

  return NextResponse.json({ billingProfile })
}
