import { KeyRound, ShieldCheck, UserCog, Users } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminUsersSuperAdminsPage() {
  return (
    <SuperAdminSectionPage
      title="Super admins"
      description="Usuarios con acceso global a la plataforma, asignacion controlada, auditoria obligatoria y MFA recomendado."
      stats={[
        { label: 'Acceso', value: '3 vias', helper: 'user_roles, profiles, app_metadata', icon: KeyRound, tone: 'blue' },
        { label: 'Rol', value: 'Global', helper: 'Fuera del tenant normal', icon: ShieldCheck, tone: 'emerald' },
        { label: 'Usuarios', value: 'Revisar', helper: 'Listar desde Auth/admin', icon: Users, tone: 'violet' },
        { label: 'Control', value: 'Alto', helper: 'Cambios auditables', icon: UserCog, tone: 'rose' },
      ]}
      actions={[
        { title: 'Asignacion controlada', description: 'Agregar super_admin solo desde server o SQL revisado.', status: 'Seguro' },
        { title: 'Auditoria obligatoria', description: 'Todo cambio de superadmin debe generar audit log.', status: 'Recomendado' },
        { title: 'MFA recomendado', description: 'Exigir segundo factor para cuentas globales.', status: 'Recomendado' },
      ]}
      tableTitle="Fuentes de autorizacion"
      tableDescription="La verificacion actual ya soporta las rutas usadas por el proyecto."
      tableItems={[
        { title: 'user_roles.role', description: 'Rol super_admin activo y no vencido.', status: 'Activo', meta: 'user_roles' },
        { title: 'profiles.role', description: 'Fallback para instalaciones existentes.', status: 'Activo', meta: 'profiles' },
        { title: 'app_metadata.role', description: 'Fallback para claims de Supabase Auth.', status: 'Activo', meta: 'auth.users' },
      ]}
    />
  )
}
