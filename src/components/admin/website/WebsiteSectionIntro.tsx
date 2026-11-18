'use client'

import {
  Award,
  Briefcase,
  Building2,
  CalendarCheck2,
  CreditCard,
  Footprints,
  GalleryHorizontalEnd,
  HelpCircle,
  Images,
  MapPin,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getSectionVisualTheme, SECTION_GROUP_THEMES } from '@/lib/website/section-visual-themes'
import { cn } from '@/lib/utils'

const SECTION_ICONS: Record<string, LucideIcon> = {
  company: Building2,
  checkout: CreditCard,
  hero: Sparkles,
  carousel: GalleryHorizontalEnd,
  trust_bar: ShieldCheck,
  offers: Tag,
  brands: Award,
  announcement: Megaphone,
  services: Briefcase,
  booking: CalendarCheck2,
  gallery: Images,
  process: Footprints,
}

export const WEBSITE_SECTION_HELP = {
  company: {
    title: 'Empresa y publicación', description: 'Controlá la publicación de tu tienda, su dirección web y los datos de tu empresa.',
    steps: ['Activá el switch Publicar tienda para poner tu tienda online.', 'Configurá tu dirección web (slug) y el nombre de tu empresa.', 'Completá logo, contacto y horarios para brindar confianza a tus clientes.'],
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
  announcement: {
    title: 'Aviso al entrar a tu tienda', description: 'Un cartel para avisar algo puntual: un horario especial, una promoción o una demora en las entregas.',
    steps: ['Escribí el título y el mensaje.', 'Si querés, sumá una imagen, un botón y las fechas en que se muestra.', 'Activalo y guardá.'],
    examples: ['Ropa: “Cambios hasta el 30” con un botón a las condiciones.', 'Almacén: “El sábado atendemos de 8 a 12”.'],
    note: 'Cada cliente lo ve una vez por día. Si lo editás, vuelve a aparecer.',
  },
  brands: {
    title: 'Marquesina de marcas', description: 'Elegí qué marcas mostrar en la portada y su visibilidad pública.',
    steps: ['Activá o desactivá marcas sugeridas con el switch Público.', 'Agregá tus propias marcas si vendés otras líneas.', 'Guardá los cambios para actualizar la portada.'],
    examples: ['Ropa: Nike, Adidas, Zara o marcas propias que comercialices.', 'Deportes: marcas de calzado y accesorios oficiales.'],
    note: 'Ocultar una marca no borra sus productos del catálogo, solo la quita de la marquesina de portada.',
  },
  carousel: {
    title: 'Banners del inicio', description: 'Campañas visuales e imágenes destacadas en la portada principal (/inicio).',
    steps: ['Agregá una imagen y un mensaje.', 'Revisá el destino del enlace y el orden.', 'Activá los banners que quieras mostrar y guardá.'],
    examples: ['Ropa: un banner de nueva temporada que lleva a la colección.', 'Ferretería: una campaña de herramientas destacadas.'],
    note: 'Estos banners se exhiben en la portada principal de tu tienda. Para diseñar banners exclusivos de la página /ofertas o crear cupones, visitá la sección de Promociones.',
  },
  offers: {
    title: 'Ofertas del catálogo', description: 'Personalizá cómo se presentan los productos en oferta en la portada y en /ofertas.',
    steps: ['Cargá precios de oferta en Gestión de productos o creá reglas en Promociones.', 'Elegí el título, descripción y color de acento de esta sección.', 'Si no hay productos en rebaja cargados, la portada se auto-oculta para proteger el diseño.'],
    examples: ['Cosméticos: “Ofertas de la semana” con productos que tengan precio de oferta.', 'Ferretería: “Precios especiales” para herramientas seleccionadas.'],
    note: 'Esta sección recopila automáticamente los productos con precio de oferta activo. Para diseñar banners publicitarios de campañas o crear cupones, visitá la sección de Promociones.',
  },
  services: {
    title: 'Servicios que ofrecés', description: 'Explicá el alcance, precio y tiempo de tus servicios.',
    steps: ['Agregá o editá un servicio.', 'Describí qué incluye y revisá su precio.', 'Activá solo los servicios que realmente ofrecés.'],
    examples: ['Taller: cambio de pantalla con plazo estimado y condiciones.', 'Belleza: asesoramiento o un tratamiento, indicando qué incluye.'],
    note: 'Si solo vendés productos, podés mantener esta sección oculta. Publicar un servicio no genera una orden de reparación ni una venta.',
  },
  gallery: {
    title: 'Galería de trabajos', description: 'Mostrá lo que hacés: es lo que más convence a un cliente nuevo.',
    steps: ['Subí fotos de tus mejores trabajos (hasta 12).', 'Ordenalas y, si querés, poneles un texto corto.', 'Activá la galería y guardá.'],
    examples: ['Barbería: fades, diseños y barbas.', 'Peluquería: color, mechas y peinados de fiesta.'],
    note: 'Usá fotos propias y con permiso de tus clientes. Cuentan para el límite de 20 imágenes del sitio.',
  },
  booking: {
    title: 'Reservas online en tu inicio', description: 'Tus clientes reservan su turno sin salir de la tienda.',
    steps: ['En la agenda cargá servicios con duración, quién atiende y el horario.', 'Activá «Aceptar reservas desde la tienda» en la agenda.', 'Acá activá la sección, escribí el título y guardá.'],
    examples: ['Barbería: «Reservá tu corte» con el equipo a la vista.', 'Estética: «Elegí tu tratamiento y horario».'],
    note: 'Los turnos reservados aparecen en la agenda. Si pedís confirmación, quedan pendientes hasta que los confirmes.',
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
    note: 'Las tiendas nuevas empiezan con consultas por WhatsApp si tienen un número cargado; si no, con carrito, efectivo y retiro en el local. El envío a domicilio necesita el módulo Entregas. Una consulta no registra por sí sola una venta ni descuenta stock.',
  },
} as const

export function WebsiteSectionIntro({ section }: { section: keyof typeof WEBSITE_SECTION_HELP }) {
  const help = WEBSITE_SECTION_HELP[section]
  const theme = getSectionVisualTheme(section)
  const group = SECTION_GROUP_THEMES[theme.group] ?? SECTION_GROUP_THEMES.overview
  const Icon = SECTION_ICONS[section] ?? Sparkles

  return (
    <div className={cn(
      'mb-5 rounded-2xl border bg-gradient-to-r p-4 sm:p-5 shadow-2xs transition-all duration-300 backdrop-blur-xs',
      theme.gradientBg
    )}>
      {/* Barra superior de categoría y ubicación en la tienda */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 mb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border', group.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', group.dot)} />
            <span>{group.label}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <MapPin className="h-3 w-3 text-muted-foreground/70" />
            <span>{theme.location}</span>
          </span>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 rounded-full bg-background/80 hover:bg-background border-border/70"
            >
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              <span>Cómo funciona</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl border', theme.iconBg, theme.iconColor, theme.borderTone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <DialogTitle>{help.title}</DialogTitle>
                  <span className={cn('text-[11px] font-semibold', group.pill)}>{group.label}</span>
                </div>
              </div>
              <DialogDescription>{help.description}</DialogDescription>
            </DialogHeader>
            <h3 className="font-semibold text-sm">Paso a paso</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/90">
              {help.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
              <h3 className="mb-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ejemplos por rubro</h3>
              <ul className="list-disc space-y-1.5 pl-4 text-xs sm:text-sm text-foreground/80">
                {help.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{help.note}</p>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contenido principal con ícono colorido destacado y textos */}
      <div className="flex items-start gap-3.5">
        <div className={cn(
          'flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-300 hover:scale-105',
          theme.iconBg,
          theme.iconColor,
          theme.borderTone
        )}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
            {help.title}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {help.description}
          </p>
        </div>
      </div>
    </div>
  )
}
