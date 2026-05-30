import { AlertTriangle, FileText, ShieldCheck, Users } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminAuditLogsPage() {
  return (
    <SuperAdminSectionPage
      title="Audit Logs"
      description="Trazabilidad global de accesos, cambios sensibles, facturacion, permisos y acciones criticas de la plataforma."
      stats={[
        { label: 'Eventos 24h', value: '0', helper: 'Listo para tabla audit_logs', icon: FileText, tone: 'blue' },
        { label: 'Criticos', value: '0', helper: 'Requieren revision manual', icon: AlertTriangle, tone: 'rose' },
        { label: 'Accesos admin', value: '0', helper: 'Sesiones superadmin', icon: ShieldCheck, tone: 'emerald' },
        { label: 'Actores', value: '0', helper: 'Usuarios con actividad', icon: Users, tone: 'violet' },
      ]}
      actions={[
        { title: 'Cambios de plan', description: 'Registro de upgrades, downgrades, trials y cancelaciones ejecutadas por staff.', status: 'Preparado' },
        { title: 'Seguridad', description: 'Auditoria de acceso superadmin, invitaciones, cambios de rol y bloqueo de usuarios.', status: 'Preparado' },
        { title: 'Operaciones tenant', description: 'Eventos por organizacion para diagnosticar impacto sin exponer datos cruzados.', status: 'Preparado' },
      ]}
      tableTitle="Eventos recientes"
      tableDescription="Misma estructura visual del modulo importado, adaptada a una fuente segura del proyecto."
      tableItems={[
        { title: 'Acceso superadmin', description: 'Inicio de sesion o ingreso al panel global.', status: 'Pendiente de datos', meta: 'audit_logs' },
        { title: 'Cambio de suscripcion', description: 'Modificacion de plan, periodo o estado de cobro.', status: 'Pendiente de datos', meta: 'subscriptions' },
        { title: 'Invitacion de usuario', description: 'Alta de usuario global o miembro tenant.', status: 'Pendiente de datos', meta: 'organization_members' },
      ]}
    />
  )
}
