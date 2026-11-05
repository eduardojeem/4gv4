import { PaymentControlsPanel } from '@/components/payments/PaymentControlsPanel'
export default function CommercePaymentMethodsPage() {
  return <PaymentControlsPanel scope="commerce" endpoint="/api/admin/payment-controls" title="Medios de cobro" description="Controlá nuevos cobros del comercio. La tienda web aplica además sus restricciones de checkout. Deshabilitar un medio conserva historial, saldos y devoluciones." />
}
