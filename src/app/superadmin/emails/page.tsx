import { Mail, Send, ShieldAlert, UserPlus } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminEmailsPage() {
  return (
    <SuperAdminSectionPage
      title="Plantillas de Email"
      description="Plantillas transaccionales para onboarding, invitaciones, facturacion, seguridad y comunicaciones globales."
      stats={[
        { label: 'Plantillas', value: '4', helper: 'Base recomendada del ZIP', icon: Mail, tone: 'blue' },
        { label: 'Onboarding', value: '1', helper: 'Bienvenida a empresa', icon: UserPlus, tone: 'emerald' },
        { label: 'Billing', value: '1', helper: 'Factura y renovacion', icon: Send, tone: 'violet' },
        { label: 'Seguridad', value: '1', helper: 'Alertas sensibles', icon: ShieldAlert, tone: 'rose' },
      ]}
      actions={[
        { title: 'Bienvenida', description: 'Email inicial para owner con pasos de configuracion y acceso al dashboard.', status: 'Template' },
        { title: 'Invitacion', description: 'Mensaje para invitar usuarios a una organizacion con rol y sucursal.', status: 'Template' },
        { title: 'Facturacion', description: 'Avisos de prueba, renovacion, pago fallido y factura emitida.', status: 'Template' },
      ]}
      tableTitle="Catalogo de templates"
      tableDescription="Diseño y estructura listos para conectar tabla email_templates."
      tableItems={[
        { title: 'welcome_owner', description: 'Bienvenida al owner despues de crear empresa.', status: 'Diseñado', meta: 'onboarding' },
        { title: 'member_invitation', description: 'Invitacion segura para usuarios de una organizacion.', status: 'Diseñado', meta: 'auth' },
        { title: 'billing_invoice', description: 'Factura o comprobante desde Stripe, Pagopar o Bancard.', status: 'Diseñado', meta: 'billing' },
      ]}
    />
  )
}
