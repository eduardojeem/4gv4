import { CreditCard, FileCheck2, FileClock, Receipt } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminInvoicesPage() {
  return (
    <SuperAdminSectionPage
      title="Facturas"
      description="Historial de facturacion preparado para Stripe, Pagopar y Bancard con estados, vencimientos y reintentos."
      stats={[
        { label: 'Emitidas', value: '0', helper: 'Pendiente de provider', icon: Receipt, tone: 'blue' },
        { label: 'Pagadas', value: '0', helper: 'Pagos confirmados', icon: FileCheck2, tone: 'emerald' },
        { label: 'Pendientes', value: '0', helper: 'Esperando cobro', icon: FileClock, tone: 'amber' },
        { label: 'Pasarelas', value: '3', helper: 'Stripe, Pagopar, Bancard', icon: CreditCard, tone: 'violet' },
      ]}
      actions={[
        { title: 'Stripe', description: 'Preparado para invoices, checkout sessions y webhooks de suscripcion.', status: 'Arquitectura' },
        { title: 'Pagopar', description: 'Preparado para cobros locales y conciliacion de facturas.', status: 'Arquitectura' },
        { title: 'Bancard', description: 'Preparado para pagos con tarjetas y estados asincronos.', status: 'Arquitectura' },
      ]}
      tableTitle="Facturas recientes"
      tableDescription="Vista operacional lista para conectar billing_invoices."
      tableItems={[
        { title: 'Factura mensual', description: 'Registro por periodo de suscripcion tenant.', status: 'Pendiente de datos', meta: 'billing_invoices' },
        { title: 'Pago fallido', description: 'Reintentos y bloqueo gradual por limite de plan.', status: 'Pendiente de datos', meta: 'webhooks' },
        { title: 'Comprobante local', description: 'Integracion local Pagopar/Bancard.', status: 'Pendiente de datos', meta: 'providers' },
      ]}
    />
  )
}
