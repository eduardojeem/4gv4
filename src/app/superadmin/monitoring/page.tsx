import { Activity, Database, HardDrive, Server } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminMonitoringPage() {
  return (
    <SuperAdminSectionPage
      title="Monitoreo"
      description="Salud del sistema, latencia, errores, almacenamiento y uso de recursos para operar el SaaS en produccion."
      stats={[
        { label: 'API', value: 'OK', helper: 'Rutas superadmin protegidas', icon: Server, tone: 'emerald' },
        { label: 'DB', value: 'OK', helper: 'Supabase via server', icon: Database, tone: 'blue' },
        { label: 'Storage', value: 'Listo', helper: 'Medicion pendiente', icon: HardDrive, tone: 'violet' },
        { label: 'Eventos', value: '0', helper: 'Alertas activas', icon: Activity, tone: 'amber' },
      ]}
      actions={[
        { title: 'Salud de API Routes', description: 'Supervision de errores, tiempos de respuesta y endpoints criticos.', status: 'Preparado' },
        { title: 'Supabase', description: 'Panel para revisar conexion, tablas SaaS y politicas RLS importantes.', status: 'Preparado' },
        { title: 'Storage y backups', description: 'Control de consumo por plan y respaldo operativo.', status: 'Preparado' },
      ]}
      tableTitle="Servicios monitoreados"
      tableDescription="Estructura equivalente al modulo del ZIP, conectable a metricas reales por etapas."
      tableItems={[
        { title: 'Next.js App Router', description: 'Paginas y API Routes del panel administrativo.', status: 'Activo', meta: 'runtime' },
        { title: 'Supabase Postgres', description: 'Consultas, RLS, indices y aislamiento multiempresa.', status: 'Activo', meta: 'database' },
        { title: 'Supabase Storage', description: 'Uploads por tenant, cuotas y URLs firmadas.', status: 'Pendiente', meta: 'storage' },
      ]}
    />
  )
}
