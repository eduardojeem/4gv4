'use client'

import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export const WEBSITE_SECTION_HELP = {
  company: {
    title: 'Empresa y publicación', description: 'Primero completá tu identidad y contacto. Publicá cuando esté listo.',
    steps: ['Completá nombre, logo y contacto.', 'Revisá el enlace y la modalidad comercial en Pagos y entregas.', 'Activá Publicar tienda y confirmá el resumen. Marketplace es una opción independiente.'],
    examples: ['Ropa: publicá tu catálogo para recibir consultas de talles por WhatsApp, sin aparecer todavía en Marketplace.', 'Cosméticos: completá horarios, dirección y WhatsApp antes de compartir el enlace.'],
    note: 'Ocultar la tienda bloquea sus páginas y API públicas, incluido el seguimiento público. No borra productos, ventas, pedidos ni reparaciones del sistema. Los enlaces compartidos dejan de estar disponibles mientras esté oculta.',
  },
  hero: {
    title: 'Portada principal', description: 'Presentá qué ofrecés y cuál es el próximo paso para el visitante.',
    steps: ['Escribí un título breve y una descripción.', 'Definí los textos de los botones.', 'Revisá la vista previa y guardá.'],
    examples: ['Ropa: “Encontrá tu próximo look” y “Ver colección”.', 'Ferretería: “Todo para tus proyectos” y “Consultar disponibilidad”.'],
    note: 'Las plantillas son ejemplos editables. Usá cifras y beneficios reales de tu negocio. Mostrar esta sección no publica una tienda que está oculta.',
  },
  trust_bar: {
    title: 'Beneficios de comprar en tu tienda', description: 'Destacá pocas ventajas concretas y fáciles de entender.',
    steps: ['Elegí beneficios reales.', 'Ordená los más importantes primero.', 'Revisá los textos y guardá.'],
    examples: ['Cosméticos: “Productos originales”, “Asesoramiento” y “Retiro en tienda”.', 'Ropa: “Cambios según condiciones” y “Envíos disponibles”.'],
    note: 'Estos textos son informativos: no configuran automáticamente envíos, garantías ni formas de pago.',
  },
  carousel: {
    title: 'Banners promocionales', description: 'Mostrá campañas con imágenes y mensajes breves.',
    steps: ['Agregá una imagen y un mensaje.', 'Revisá el destino del enlace y el orden.', 'Activá los banners que quieras mostrar y guardá.'],
    examples: ['Ropa: un banner de nueva temporada que lleva a la colección.', 'Ferretería: una campaña de herramientas destacadas.'],
    note: 'Un banner no cambia el precio de un producto. El descuento debe configurarse en el catálogo o en promociones.',
  },
  offers: {
    title: 'Ofertas del catálogo', description: 'Personalizá cómo se presentan los productos en promoción.',
    steps: ['Configurá primero los precios de oferta en el catálogo.', 'Elegí el título y la presentación de esta sección.', 'Comprobá qué productos aparecen en la tienda publicada.'],
    examples: ['Cosméticos: “Ofertas de la semana” con productos que tengan precio de oferta.', 'Ferretería: “Precios especiales” para herramientas seleccionadas.'],
    note: 'Cambiar el título de esta sección no aplica descuentos a los productos.',
  },
  services: {
    title: 'Servicios que ofrecés', description: 'Explicá el alcance, precio y tiempo de tus servicios.',
    steps: ['Agregá o editá un servicio.', 'Describí qué incluye y revisá su precio.', 'Activá solo los servicios que realmente ofrecés.'],
    examples: ['Taller: cambio de pantalla con plazo estimado y condiciones.', 'Belleza: asesoramiento o un tratamiento, indicando qué incluye.'],
    note: 'Si solo vendés productos, podés mantener esta sección oculta. Publicar un servicio no genera una orden de reparación ni una venta.',
  },
  process: {
    title: 'Cómo atendés a tus clientes', description: 'Describí el recorrido desde la consulta hasta la entrega.',
    steps: ['Elegí el flujo que querés explicar.', 'Ordená los pasos con instrucciones breves.', 'Ocultá la sección si no aporta información a tu negocio.'],
    examples: ['Ropa: elegí el producto → consultá talle → coordiná pago y entrega.', 'Reparaciones: diagnóstico → aprobación del presupuesto → reparación → entrega.'],
    note: 'Los pasos son informativos; no cambian los estados de pedidos o reparaciones.',
  },
  checkout: {
    title: 'Modalidad comercial, pagos y entregas', description: 'Elegí cómo querés recibir las consultas o los pedidos.',
    steps: ['Consulta por WhatsApp: el visitante coordina la compra por mensaje.', 'Solo catálogo: mostrás productos sin compra por carrito.', 'Carrito: configurá los métodos de pago y al menos una opción de entrega o retiro.'],
    examples: ['Ropa: WhatsApp para confirmar talle y stock antes del pago.', 'Ferretería: carrito con retiro en local y pago en efectivo.'],
    note: 'Las nuevas organizaciones empiezan con WhatsApp. Una consulta no registra por sí sola una venta ni descuenta stock. Activar una modalidad no publica automáticamente la tienda.',
  },
} as const

export function WebsiteSectionIntro({ section }: { section: keyof typeof WEBSITE_SECTION_HELP }) {
  const help = WEBSITE_SECTION_HELP[section]
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-muted/20 p-4">
    <div className="min-w-0 flex-1"><h2 className="text-base font-semibold">{help.title}</h2><p className="mt-1 text-sm text-muted-foreground">{help.description}</p></div>
    <Dialog>
      <DialogTrigger asChild><Button type="button" size="sm" variant="outline"><HelpCircle className="mr-2 h-4 w-4" />Cómo funciona</Button></DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{help.title}</DialogTitle><DialogDescription>{help.description}</DialogDescription></DialogHeader>
        <h3 className="font-medium">Paso a paso</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm">{help.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <div className="rounded-lg bg-muted p-4"><h3 className="mb-2 font-medium">Ejemplos</h3><ul className="list-disc space-y-2 pl-4 text-sm">{help.examples.map(example => <li key={example}>{example}</li>)}</ul></div>
        <p className="text-sm text-muted-foreground">{help.note}</p>
      </DialogContent>
    </Dialog>
  </div>
}
