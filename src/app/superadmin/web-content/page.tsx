import { Globe2, LayoutTemplate, SearchCheck, Store } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminWebContentPage() {
  return (
    <SuperAdminSectionPage
      title="Contenido web"
      description="Configuracion global de landing, marketplace, branding publico, SEO y textos visibles de la plataforma."
      stats={[
        { label: 'Landing', value: 'Base', helper: 'Contenido comercial global', icon: LayoutTemplate, tone: 'blue' },
        { label: 'Marketplace', value: 'Activo', helper: 'Empresas por subdominio', icon: Store, tone: 'emerald' },
        { label: 'SEO', value: 'Listo', helper: 'Metadatos globales', icon: SearchCheck, tone: 'violet' },
        { label: 'Dominios', value: 'Multi', helper: 'Tenant/public routes', icon: Globe2, tone: 'amber' },
      ]}
      actions={[
        { title: 'Landing principal', description: 'Contenido editorial del SaaS: hero, beneficios, modulos y planes.', status: 'Diseñado', href: '/superadmin/web-content/landing' },
        { title: 'Marketplace publico', description: 'Categorias, empresas destacadas y reglas de visibilidad.', status: 'Diseñado', href: '/superadmin/web-content/marketplace' },
        { title: 'Branding global', description: 'Marca de plataforma, textos legales y SEO default.', status: 'Diseñado' },
      ]}
      tableTitle="Bloques de contenido"
      tableDescription="Panel de contenido con la misma estetica del ZIP, preparado para web_content."
      tableItems={[
        { title: 'Hero landing', description: 'Mensaje principal y CTA de registro de empresa.', status: 'Preparado', meta: 'landing' },
        { title: 'Marketplace featured', description: 'Empresas y categorias destacadas a nivel plataforma.', status: 'Preparado', meta: 'marketplace' },
        { title: 'SEO global', description: 'Titulo, descripcion y Open Graph default.', status: 'Preparado', meta: 'metadata' },
      ]}
    />
  )
}
