import { BadgePercent, Building2, SearchCheck, Store } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminMarketplaceContentPage() {
  return (
    <SuperAdminSectionPage
      title="Marketplace"
      description="Contenido global, criterios publicos, categorias destacadas, promociones y SEO del marketplace multiempresa."
      stats={[
        { label: 'Empresas', value: 'Tenant', helper: 'Visibilidad por configuracion', icon: Building2, tone: 'blue' },
        { label: 'Categorias', value: 'Global', helper: 'Taxonomia publica', icon: Store, tone: 'emerald' },
        { label: 'Promos', value: 'Listo', helper: 'Destacados globales', icon: BadgePercent, tone: 'violet' },
        { label: 'SEO', value: 'Activo', helper: 'Busqueda publica', icon: SearchCheck, tone: 'amber' },
      ]}
      actions={[
        { title: 'Categorias destacadas', description: 'Orden y visibilidad de categorias globales del marketplace.', status: 'Diseñado' },
        { title: 'Empresas destacadas', description: 'Curadoria de tenants visibles en home marketplace.', status: 'Diseñado' },
        { title: 'Promociones globales', description: 'Espacios para campañas comerciales de plataforma.', status: 'Diseñado' },
      ]}
      tableTitle="Contenido marketplace"
      tableDescription="Vista de administracion inspirada en el ZIP y preparada para datos publicos por tenant."
      tableItems={[
        { title: 'Featured tenants', description: 'Empresas destacadas en marketplace publico.', status: 'Preparado', meta: 'organizations' },
        { title: 'Featured categories', description: 'Categorias de productos visibles globalmente.', status: 'Preparado', meta: 'categories' },
        { title: 'Global promotions', description: 'Promociones editoriales a nivel plataforma.', status: 'Preparado', meta: 'promotions' },
      ]}
    />
  )
}
