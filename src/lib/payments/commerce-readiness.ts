import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { PaymentControlError } from './control-contract'
export async function commercePaymentControlsReady(): Promise<boolean> {
  const { data, error } = await createAdminSupabase().rpc('commerce_payment_controls_version')
  return !error && data === 2
}
export async function requireCommercePaymentControlsReady() {
  if (!await commercePaymentControlsReady()) throw new PaymentControlError('Falta aplicar y verificar la migración de protección de medios de cobro. No se guardó el cambio.', 409, 'PAYMENT_CONTROLS_MIGRATION_REQUIRED')
}
