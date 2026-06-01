import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getCurrentOrganizationSubscription } from '@/lib/saas/subscription-service'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createPagoparOrder, getPagoparAmountInPyg, isPagoparConfigured } from '@/lib/payments/pagopar'

function getMissingBillingFields(profile: Awaited<ReturnType<typeof getCurrentOrganizationSubscription>>['billingProfile']) {
  const missing: string[] = []
  const ruc = profile?.ruc?.replace(/[^\d]/g, '') || ''

  if (!profile?.business_name?.trim()) missing.push('Razon social')
  if (!ruc) missing.push('RUC o CI')
  if (!profile?.billing_email?.trim()) missing.push('Correo de facturacion')
  if (!profile?.phone?.trim()) missing.push('Telefono')
  if (!profile?.fiscal_address?.trim()) missing.push('Direccion fiscal')

  return missing
}

export async function POST(request: Request) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(auth.user.id)

  if (!organization || !['owner', 'admin'].includes(organization.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isPagoparConfigured()) {
    return NextResponse.json(
      { error: 'Pagopar no configurado. Faltan PAGOPAR_PUBLIC_KEY y/o PAGOPAR_PRIVATE_KEY.' },
      { status: 501 }
    )
  }

  const state = await getCurrentOrganizationSubscription(organization.id)
  let amountPyg: number

  try {
    amountPyg = getPagoparAmountInPyg(state.currentPlan.price_monthly, state.currentPlan.currency)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo convertir el monto para Pagopar.' },
      { status: 500 }
    )
  }

  if (amountPyg <= 0) {
    return NextResponse.json({ error: 'El plan actual no tiene monto para cobrar.' }, { status: 400 })
  }

  const missingBillingFields = getMissingBillingFields(state.billingProfile)

  if (missingBillingFields.length > 0) {
    return NextResponse.json(
      {
        error: `Completa los datos de facturacion antes de pagar con Pagopar: ${missingBillingFields.join(', ')}.`,
        missingFields: missingBillingFields,
      },
      { status: 400 }
    )
  }

  const admin = createAdminSupabase()
  const externalReference = `SUB${Date.now()}${organization.id.slice(0, 8).replace(/-/g, '')}`
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .insert({
      organization_id: organization.id,
      subscription_id: state.subscription?.id || null,
      plan_id: state.currentPlan.code,
      amount: amountPyg,
      currency: 'PYG',
      status: 'pending',
      payment_method: 'Pagopar',
      provider: 'pagopar',
      external_reference: externalReference,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message || 'No se pudo crear el pago.' }, { status: 500 })
  }

  try {
    const order = await createPagoparOrder({
      amountPyg,
      buyer: {
        businessName: state.billingProfile?.business_name || organization.name,
        document: state.billingProfile?.ruc || null,
        email: state.billingProfile?.billing_email || auth.user.email || null,
        name: state.billingProfile?.business_name || organization.name,
        phone: state.billingProfile?.phone || null,
        ruc: state.billingProfile?.ruc || null,
        address: state.billingProfile?.fiscal_address || '',
      },
      description: `Suscripcion ${state.currentPlan.name} - ${organization.name}`,
      externalReference,
      itemId: Number.parseInt(payment.id.replace(/[^\d]/g, '').slice(0, 9), 10) || 1,
    })

    await admin
      .from('subscription_payments')
      .update({
        provider_payment_id: order.providerOrderId,
        receipt_url: order.checkoutUrl,
        external_reference: order.hash,
      })
      .eq('id', payment.id)

    const { data: subscription } = await admin
      .from('subscriptions')
      .upsert({
        organization_id: organization.id,
        plan: state.currentPlan.code,
        status: state.subscription?.status || 'past_due',
        provider: 'pagopar',
        provider_subscription_id: order.hash,
        external_reference: order.hash,
        last_payment_method: 'Pagopar',
        payment_status: 'pending',
        cancel_at_period_end: state.subscription?.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })
      .select('id')
      .single()

    if (!state.subscription?.id && subscription?.id) {
      await admin
        .from('subscription_payments')
        .update({ subscription_id: subscription.id })
        .eq('id', payment.id)
    }

    return NextResponse.json({ checkoutUrl: order.checkoutUrl })
  } catch (error) {
    await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)

    const message = error instanceof Error ? error.message : 'No se pudo iniciar el pago con Pagopar.'

    return NextResponse.json(
      { error: message },
      { status: message.includes('Pagopar rechazo el pago') ? 400 : 502 }
    )
  }
}
