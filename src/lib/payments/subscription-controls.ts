import 'server-only'
import { isBancardConfigured, isBancardRecurringEnabled } from './bancard'
import { isStripeCheckoutEnabled } from './stripe'
import { readPaymentControlPolicy, updatePaymentControlPolicy } from './control-store'
import { PaymentControlError, requireControlEnabled, type PaymentControl, type PaymentControlSnapshot, type SubscriptionControlId } from './control-contract'
import { getBankTransferSettings } from '@/lib/saas/bank-transfers'
import { bankTransferSettingsSchema } from '@/lib/saas/bank-transfer-contract'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { commercePaymentControlsReady, requireCommercePaymentControlsReady } from './commerce-readiness'

export type SubscriptionPaymentAvailability = Record<SubscriptionControlId | 'transfer', boolean>
function readiness(): Record<SubscriptionControlId, boolean> {
  return { bancard_card: isBancardConfigured(), stripe: isStripeCheckoutEnabled(), autopay: isBancardRecurringEnabled(), promo: true }
}
const descriptions: Record<SubscriptionControlId, [string, string]> = {
  bancard_card: ['Tarjeta · Bancard', 'Pago del plan con tarjeta de crédito o débito en el formulario seguro de Bancard (vPOS).'],
  stripe: ['Tarjeta · Stripe', 'Requiere las claves y la habilitación técnica de Stripe en el servidor.'],
  autopay: ['Débito automático · nuevas adhesiones', 'Pausa nuevas adhesiones. Los débitos previamente autorizados y la baja de tarjetas continúan funcionando.'],
  promo: ['Códigos de activación y promociones', 'Controla nuevos canjes. No modifica beneficios o descuentos ya aplicados.'],
}

export async function getSubscriptionPaymentControls(): Promise<PaymentControlSnapshot> {
  const [policy, bank] = await Promise.all([readPaymentControlPolicy('subscriptions'), getBankTransferSettings()])
  const configured = readiness()
  const methods: PaymentControl[] = (Object.keys(descriptions) as SubscriptionControlId[]).map(id => ({
    id, title: descriptions[id][0], description: descriptions[id][1], channels: ['Suscripciones'],
    enabled: policy.flags[id], configured: configured[id], available: policy.flags[id] && configured[id], editable: true,
    implementation: 'implemented',
    nextSteps: configured[id] ? [] : id === 'stripe' ? ['Configurar las claves de Stripe y el secreto del webhook.', 'Habilitar Stripe para suscripciones en el servidor y verificar un cobro completo.'] : id === 'autopay' ? ['Configurar Bancard y solicitar la habilitación de tarjetas guardadas (pagos recurrentes).', 'Activar BANCARD_RECURRING_ENABLED en el servidor y verificar adhesión y débito.'] : ['Configurar BANCARD_PUBLIC_KEY y BANCARD_PRIVATE_KEY en el servidor.', 'Cargar la URL de confirmación (/api/payments/bancard/webhook) en el portal de Bancard y verificar un pago completo.'],
  }))
  // The schema is strict: construct only editable fields, never leak account details in this catalog.
  const transferConfigured = bankTransferSettingsSchema.safeParse({
    enabled: true, bankName: bank.bankName, accountHolder: bank.accountHolder, accountNumber: bank.accountNumber,
    accountAlias: bank.accountAlias, currency: bank.currency, instructions: bank.instructions,
  }).success
  methods.push({ id: 'transfer', title: 'Transferencia bancaria', description: 'Cuenta receptora y comprobantes administrados en Pagos por transferencia.', channels: ['Suscripciones'], enabled: bank.enabled, configured: transferConfigured, available: bank.enabled && transferConfigured, editable: true, settingsHref: '/superadmin/billing/transfers', revision: bank.updatedAt })
  methods[methods.length - 1].implementation = 'implemented'
  methods[methods.length - 1].nextSteps = transferConfigured ? [] : ['Completar banco, titular, cuenta y moneda en Pagos por transferencia.']
  methods.push({ id: 'manual_cash', title: 'Efectivo · registro manual', description: 'Registro administrativo de un pago recibido fuera de una pasarela. Su habilitación no se controla desde esta pantalla.', channels: ['Superadministración'], enabled: false, configured: true, available: false, editable: false, implementation: 'implemented', nextSteps: ['Registrar y revisar estos pagos desde la administración de suscripciones.'] })
  for (const title of ['Apple In-App Purchase', 'Google Play Billing', 'Mercado Pago', 'PayPal', 'Square', 'Wompi', 'PayU']) {
    methods.push({ id: `pending_${title}`, title, description: 'Sin un circuito de cobro operativo conectado a suscripciones.', channels: ['Suscripciones'], enabled: false, configured: false, available: false, editable: false, implementation: 'pending', nextSteps: ['Desarrollar la integración con el proveedor y configurar sus credenciales.', 'Implementar confirmaciones verificadas, devoluciones y pruebas del circuito completo antes de habilitar cobros.'] })
  }
  const ready = await commercePaymentControlsReady()
  return { scope: 'subscriptions', revision: policy.revision, methods, configurationNotice: ready ? undefined : 'Falta aplicar y verificar la protección de medios de pago en la base de datos para guardar cambios.' }
}

export async function getSubscriptionPaymentAvailability(): Promise<SubscriptionPaymentAvailability> {
  const catalog = await getSubscriptionPaymentControls()
  return Object.fromEntries(catalog.methods.filter(method => method.editable).map(method => [method.id, method.available])) as SubscriptionPaymentAvailability
}

/** Guard only the new operation. Confirmations, refunds and existing autopay mandates do not call this. */
export async function assertSubscriptionPaymentEnabled(id: SubscriptionControlId) {
  const { flags } = await readPaymentControlPolicy('subscriptions')
  requireControlEnabled(flags, id)
}

export async function updateSubscriptionPaymentControl(input: { id: string; enabled: boolean; revision: string | null }, actorId: string) {
  await requireCommercePaymentControlsReady()
  if (input.id !== 'transfer') {
    const ready = readiness()[input.id as SubscriptionControlId]
    if (ready === undefined) throw new PaymentControlError('El medio de pago no es configurable.', 400)
    if (input.enabled && !ready) throw new PaymentControlError('Completá las credenciales y la habilitación técnica antes de activar este medio.', 409)
    await updatePaymentControlPolicy({ ...input, scope: 'subscriptions', actorId })
    return
  }
  const bank = await getBankTransferSettings()
  if (bank.updatedAt !== input.revision) throw new PaymentControlError('La cuenta receptora cambió. Actualizá antes de guardar.', 409)
  bankTransferSettingsSchema.parse({ enabled: input.enabled, bankName: bank.bankName, accountHolder: bank.accountHolder, accountNumber: bank.accountNumber, accountAlias: bank.accountAlias, currency: bank.currency, instructions: bank.instructions })
  const updatedAt = new Date(Math.max(Date.now(), new Date(bank.updatedAt ?? 0).getTime() + 1)).toISOString()
  let query = createAdminSupabase().from('subscription_bank_transfer_settings')
    .update({ enabled: input.enabled, updated_at: updatedAt, updated_by: actorId }).eq('id', true)
  query = bank.updatedAt === null ? query.is('updated_at', null) : query.eq('updated_at', bank.updatedAt)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw new PaymentControlError('No se pudo actualizar la transferencia.')
  if (!data) throw new PaymentControlError('La cuenta receptora cambió. Actualizá y reintentá.', 409)
}
