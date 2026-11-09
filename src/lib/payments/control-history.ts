import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { PaymentControl } from './control-contract'
import { COMPLETED_SALE_STATUSES } from '@/lib/sales-status'

type Evidence = { data: unknown[] | null; error: unknown }
export function paymentEvidence(results: Evidence[], detail: string): PaymentControl['history'] {
  if (results.some(result => !result.error && result.data?.length)) return { confirmed: true, detail }
  if (results.some(result => result.error)) return { confirmed: null, detail: 'No se pudo verificar todo el historial. Reintentá con Actualizar.' }
  return { confirmed: false, detail }
}

/** Only called by the administrative catalog, never by checkout/availability guards. */
export async function subscriptionControlHistory(methods: PaymentControl[]): Promise<PaymentControl[]> {
  const admin = createAdminSupabase()
  const selectors: Record<string, [string, string]> = {
    bancard_card: ['bancard', 'Bancard Tarjeta'],
    stripe: ['stripe', 'Stripe Tarjeta'], autopay: ['bancard', 'Bancard Débito automático'],
    transfer: ['bank_transfer', 'bank_transfer'], manual_cash: ['manual', 'Efectivo'],
  }
  return Promise.all(methods.map(async method => {
    const selector = selectors[method.id]
    if (!selector) return method
    try {
      const result = await admin.from('subscription_payments').select('id').eq('status', 'paid').gt('amount', 0)
        .eq('provider', selector[0]).eq('payment_method', selector[1]).limit(1)
      return { ...method, history: paymentEvidence([result], 'Pagos de suscripciones con importe mayor a cero y estado pagado. Los fallidos, pendientes, devueltos y códigos de activación no cuentan. Registros antiguos sin medio específico no se atribuyen a una pasarela.') }
    } catch {
      return { ...method, history: paymentEvidence([{ data: null, error: true }], '') }
    }
  }))
}

export async function commerceControlHistory(methods: PaymentControl[], organizationId: string): Promise<PaymentControl[]> {
  const admin = createAdminSupabase()
  return Promise.all(methods.map(async method => {
    // Credit is financing, and store credit is balance use; neither proves collection of money.
    if (['credit', 'store_credit'].includes(method.id)) return { ...method, history: { confirmed: null, detail: method.id === 'credit' ? 'Financiación: crear un crédito no equivale a cobrarlo. El historial de cuotas se consulta en Créditos.' : 'Uso de saldo existente: no representa un ingreso nuevo de dinero.' } }
    try {
      let pos = admin.from('sale_payments').select('id,sales!inner(status,organization_id)').eq('organization_id', organizationId)
        .eq('sales.organization_id', organizationId).in('sales.status', [...COMPLETED_SALE_STATUSES]).eq('status', 'completed').gt('amount', 0)
      pos = method.id === 'qr' ? pos.eq('channel', 'qr') : pos.eq('payment_method', method.id)
      const queries: PromiseLike<Evidence>[] = [pos.limit(1)]
      if (method.id !== 'qr') {
        queries.push(admin.from('repair_payments').select('id').eq('organization_id', organizationId).eq('payment_method', method.id).gt('immediate_amount', 0).limit(1))
        queries.push(admin.from('customer_order_payment_history').select('id').eq('organization_id', organizationId).eq('payment_method', method.id).gt('amount', 0).in('to_status', ['PAID', 'PARTIAL']).limit(1))
      }
      return { ...method, history: paymentEvidence(await Promise.all(queries), method.id === 'qr' ? 'Registro de cobros QR completados en POS.' : 'Registros de cobros en POS, reparaciones con medio simple y pedidos. No incluye cuotas, medios mixtos de reparaciones ni registros antiguos sin desglose. Un registro manual no certifica liquidación bancaria.') }
    } catch {
      return { ...method, history: paymentEvidence([{ data: null, error: true }], '') }
    }
  }))
}
