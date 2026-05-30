import { Globe2, LockKeyhole, Settings2, Shield } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminSettingsPage() {
  return (
    <SuperAdminSectionPage
      title="Configuracion"
      description="Parametros globales de plataforma, dominios, seguridad, feature flags, rate limiting y modo mantenimiento."
      stats={[
        { label: 'Dominio raiz', value: 'Config', helper: 'Base para subdominios tenant', icon: Globe2, tone: 'blue' },
        { label: 'Seguridad', value: 'Alta', helper: 'Middleware superadmin activo', icon: Shield, tone: 'emerald' },
        { label: 'Rate limit', value: 'Pendiente', helper: 'Capa recomendada para prod', icon: LockKeyhole, tone: 'amber' },
        { label: 'Flags', value: 'Listo', helper: 'Modulos por plan', icon: Settings2, tone: 'violet' },
      ]}
      actions={[
        { title: 'Dominio raiz', description: 'Configurar dominio base para empresa.dominio.com.', status: 'Preparado' },
        { title: 'Registro publico', description: 'Permitir o pausar creacion publica de empresas nuevas.', status: 'Preparado' },
        { title: 'Feature flags', description: 'Controlar modulos y comportamiento experimental de plataforma.', status: 'Preparado' },
      ]}
      tableTitle="Parametros globales"
      tableDescription="Equivalente visual al SystemSettings del ZIP, listo para tabla system_settings."
      tableItems={[
        { title: 'NEXT_PUBLIC_BASE_DOMAIN', description: 'Dominio usado para resolver subdominios de tenants.', status: 'Env', meta: 'Vercel' },
        { title: 'Modo mantenimiento', description: 'Bloqueo temporal para rutas no criticas.', status: 'Pendiente', meta: 'system_settings' },
        { title: 'Public signup', description: 'Habilitar creacion de empresa desde registro.', status: 'Pendiente', meta: 'onboarding' },
      ]}
    />
  )
}
