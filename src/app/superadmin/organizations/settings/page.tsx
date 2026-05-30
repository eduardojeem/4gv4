import { BadgeCheck, Cog, Palette, SlidersHorizontal } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminOrganizationSettingsPage() {
  return (
    <SuperAdminSectionPage
      title="Configuracion tenants"
      description="Parametros globales que afectan a todas las empresas: onboarding, branding permitido, defaults y limites."
      stats={[
        { label: 'Defaults', value: '4', helper: 'Plan, sucursal, moneda, idioma', icon: SlidersHorizontal, tone: 'blue' },
        { label: 'Branding', value: 'Activo', helper: 'Logo y configuracion por tenant', icon: Palette, tone: 'violet' },
        { label: 'Politicas', value: 'RLS', helper: 'Aislamiento por organization_id', icon: BadgeCheck, tone: 'emerald' },
        { label: 'Sistema', value: 'Global', helper: 'Controlado por superadmin', icon: Cog, tone: 'amber' },
      ]}
      actions={[
        { title: 'Politicas por plan', description: 'Definir limites y modulos habilitados por plan canonico.', status: 'Diseñado', href: '/superadmin/plans' },
        { title: 'Defaults onboarding', description: 'Valores iniciales para cada tenant nuevo.', status: 'Diseñado' },
        { title: 'Branding permitido', description: 'Campos publicos permitidos para marketplace y subdominio.', status: 'Diseñado' },
      ]}
      tableTitle="Configuraciones tenant"
      tableDescription="Base equivalente al ZIP para controlar defaults SaaS desde una unica vista."
      tableItems={[
        { title: 'Moneda default', description: 'PYG como default local, con posibilidad multi-moneda futura.', status: 'Activo', meta: 'settings' },
        { title: 'Registro publico', description: 'Controlar si usuarios pueden crear empresa desde registro.', status: 'Revisar', meta: 'auth' },
        { title: 'Limites globales', description: 'Fallback cuando una organizacion no tiene plan asignado.', status: 'Planificado', meta: 'plans' },
      ]}
    />
  )
}
