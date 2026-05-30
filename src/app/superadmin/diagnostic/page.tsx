import { Database, KeyRound, ServerCog, ShieldCheck } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminDiagnosticPage() {
  return (
    <SuperAdminSectionPage
      title="Diagnostico"
      description="Centro de pruebas rapidas para validar auth, Supabase, RLS, variables de entorno y rutas criticas antes de produccion."
      stats={[
        { label: 'Auth', value: 'OK', helper: 'Proteccion superadmin activa', icon: ShieldCheck, tone: 'emerald' },
        { label: 'Supabase', value: 'OK', helper: 'Cliente admin aislado del frontend', icon: Database, tone: 'blue' },
        { label: 'Secrets', value: 'Seguro', helper: 'Service role solo server-side', icon: KeyRound, tone: 'violet' },
        { label: 'Endpoints', value: '1+', helper: 'APIs protegidas agregadas', icon: ServerCog, tone: 'amber' },
      ]}
      actions={[
        { title: 'Validar RLS', description: 'Checklist para confirmar que las tablas tenant no mezclan datos entre empresas.', status: 'Manual' },
        { title: 'Variables de entorno', description: 'Revision de URL Supabase, service role, dominio base y claves de proveedores.', status: 'Manual' },
        { title: 'Rutas sensibles', description: 'Verificacion de middleware, API Routes y paginas protegidas por rol global.', status: 'Manual' },
      ]}
      tableTitle="Pruebas recomendadas"
      tableDescription="Vista operativa alineada al ZIP para ejecutar diagnosticos por fase."
      tableItems={[
        { title: 'Auth superadmin', description: 'Confirmar acceso solo con user_roles, profiles o app_metadata super_admin.', status: 'Activo', meta: 'src/lib/superadmin/auth.ts' },
        { title: 'Conexion Supabase admin', description: 'Confirmar que el service role no se expone al cliente.', status: 'Activo', meta: 'src/lib/supabase/admin.ts' },
        { title: 'Tenant isolation', description: 'Validar organization_id en products, sales, repairs y customers.', status: 'Pendiente', meta: 'RLS SQL' },
      ]}
    />
  )
}
