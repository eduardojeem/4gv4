import { BadgeDollarSign, HelpCircle, LayoutTemplate, Sparkles } from 'lucide-react'
import { SuperAdminSectionPage } from '@/components/superadmin/superadmin-section-page'

export default function SuperAdminLandingContentPage() {
  return (
    <SuperAdminSectionPage
      title="Landing"
      description="Contenido editorial de la pagina principal del SaaS: hero, modulos, beneficios, planes destacados y FAQs."
      stats={[
        { label: 'Hero', value: '1', helper: 'Oferta principal', icon: Sparkles, tone: 'blue' },
        { label: 'Bloques', value: '4', helper: 'Beneficios y modulos', icon: LayoutTemplate, tone: 'emerald' },
        { label: 'Planes', value: '4', helper: 'FREE a ENTERPRISE', icon: BadgeDollarSign, tone: 'violet' },
        { label: 'FAQs', value: 'Base', helper: 'Preguntas frecuentes', icon: HelpCircle, tone: 'amber' },
      ]}
      actions={[
        { title: 'Hero', description: 'Titulo, subtitulo y CTA para crear nueva empresa.', status: 'Editable' },
        { title: 'Beneficios', description: 'POS, inventario, reparaciones, ecommerce y delivery.', status: 'Editable' },
        { title: 'Planes destacados', description: 'Cards comerciales conectadas al catalogo SaaS.', status: 'Editable' },
      ]}
      tableTitle="Secciones landing"
      tableDescription="Estructura equivalente al ZIP para contenido publico, sin hardcodear logica tenant."
      tableItems={[
        { title: 'Hero SaaS', description: 'Mensaje principal enfocado en POS e inventario multiempresa.', status: 'Preparado', meta: 'hero' },
        { title: 'Modulos', description: 'Inventario, POS, repairs, ecommerce, delivery y marketplace.', status: 'Preparado', meta: 'features' },
        { title: 'FAQ', description: 'Preguntas comerciales y tecnicas para nuevos clientes.', status: 'Preparado', meta: 'faq' },
      ]}
    />
  )
}
