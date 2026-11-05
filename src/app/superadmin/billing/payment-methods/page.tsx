import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { PaymentControlsPanel } from '@/components/payments/PaymentControlsPanel'

export default async function PaymentMethodsPage() {
  await requireSuperAdmin()
  return <PaymentControlsPanel scope="subscriptions" endpoint="/api/superadmin/payment-controls" title="Medios de pago de suscripciones" description="Controlá cómo los comercios pueden pagar sus planes de MiTiendaPy. Las credenciales y habilitaciones técnicas se verifican en el servidor." />
}
