import { Building2, MapPin, ShieldCheck, UserPlus } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminCreateOrganizationPage() {
  return (
    <SuperAdminSectionPage
      title="Nueva organizacion"
      description="Alta asistida de tenant desde plataforma, con owner, plan inicial, branding, configuracion y sucursal default."
      stats={[
        { label: 'Paso 1', value: 'Empresa', helper: 'Nombre, slug y logo', icon: Building2, tone: 'blue' },
        { label: 'Paso 2', value: 'Owner', helper: 'Usuario administrador', icon: UserPlus, tone: 'emerald' },
        { label: 'Paso 3', value: 'Sucursal', helper: 'Branch principal', icon: MapPin, tone: 'violet' },
        { label: 'Paso 4', value: 'Permisos', helper: 'Rol owner y plan', icon: ShieldCheck, tone: 'amber' },
      ]}
      actions={[
        { title: 'Datos de empresa', description: 'Formulario futuro para crear organization con slug unico y branding inicial.', status: 'Diseñado' },
        { title: 'Usuario owner', description: 'Creacion o invitacion del primer usuario con rol owner.', status: 'Diseñado' },
        { title: 'Onboarding default', description: 'Sucursal, settings y limites segun plan inicial.', status: 'Diseñado' },
      ]}
      tableTitle="Checklist de creacion"
      tableDescription="Replica visual del flujo del ZIP, preparado para conectar actions seguras."
      tableItems={[
        { title: 'Crear organization', description: 'Insert en organizations con plan FREE/BASIC/PRO/ENTERPRISE.', status: 'Pendiente', meta: 'organizations' },
        { title: 'Crear membership owner', description: 'Insert en organization_members con role owner y status active.', status: 'Pendiente', meta: 'organization_members' },
        { title: 'Crear branch default', description: 'Sucursal inicial vinculada a organization_id.', status: 'Pendiente', meta: 'branches' },
      ]}
    />
  )
}
