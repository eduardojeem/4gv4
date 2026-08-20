'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Sparkles,
  GalleryHorizontalEnd,
  Tag,
  Briefcase,
  Footprints,
  ShoppingCart,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Store,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WebsiteSectionGuide {
  id: string
  tabKey: string
  label: string
  badge: string
  title: string
  subtitle: string
  icon: React.ElementType
  color: string
  gradient: string
  steps: Array<{
    number: string
    title: string
    description: string
    highlight?: string
  }>
  proTips: string[]
  publicImpact: string
}

const WEBSITE_GUIDES: WebsiteSectionGuide[] = [
  {
    id: 'company',
    tabKey: 'company',
    label: 'Empresa & Marca',
    badge: 'Identidad y Contacto',
    title: 'Información de Empresa e Identidad de Marca',
    subtitle: 'Define el aspecto general de tu tienda, logo, colores oficiales y datos de contacto directo.',
    icon: Building2,
    color: 'text-cyan-600 dark:text-cyan-400',
    gradient: 'from-cyan-600 via-blue-600 to-indigo-900',
    steps: [
      {
        number: '1',
        title: 'Nombre y Subtítulo / Eslogan',
        description: 'Ingresa el nombre comercial de tu negocio y el subtítulo que aparece debajo del logo (ej. "Reparaciones y Servicios" o "Venta y Soporte Especializado").',
        highlight: 'Se muestra en el encabezado principal de todo el sitio web público.',
      },
      {
        number: '2',
        title: 'Logo Oficial y Color de Marca',
        description: 'Sube tu logo en formato JPG, PNG o WebP. Elige el color principal de tu marca (o un código HEX personalizado) que teñirá botones, enlaces y llamadas a la acción.',
        highlight: 'La vista previa en vivo a la derecha te muestra cómo luce en tiempo real.',
      },
      {
        number: '3',
        title: 'Datos de Contacto, Redes y Ubicación',
        description: 'Completa tu número de WhatsApp comercial (enlace directo con un clic), teléfono, correo, horarios de atención por día y enlace de Google Maps para visitas físicas.',
        highlight: 'Aparecen en la barra superior y en el pie de página para que los clientes te contacten rápido.',
      },
    ],
    proTips: [
      'Agrega un número de WhatsApp con código de país para que los clientes inicien chats con un solo toque desde el celular.',
      'Sube un logo con fondo transparente (PNG/WebP) para un acabado profesional en cualquier estilo de encabezado.',
    ],
    publicImpact: 'Afecta: Encabezado superior, botones de contacto directo, pie de página (footer) y colores globales del sitio.',
  },
  {
    id: 'hero',
    tabKey: 'hero',
    label: 'Hero (Portada)',
    badge: 'Primera Impresión',
    title: 'Portada Principal y Estadísticas Clave',
    subtitle: 'El primer bloque visual que ven los clientes al entrar a tu sitio web. Diseñado para generar impacto y confianza.',
    icon: Sparkles,
    color: 'text-amber-500 dark:text-amber-400',
    gradient: 'from-amber-600 via-orange-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Insignia (Badge) y Título Principal',
        description: 'Escribe una propuesta de valor directa y atractiva (ej. "Servicio técnico especializado" y "Reparación profesional para tu equipo").',
        highlight: 'Es el texto de mayor tamaño y visibilidad en tu página de inicio.',
      },
      {
        number: '2',
        title: 'Insignias de Confianza (Trust Badges)',
        description: 'Agrega hasta 3 garantías o credenciales clave (ej. "Garantía escrita", "Repuestos de calidad", "Técnicos certificados").',
        highlight: 'Reducen la duda de compra y aumentan la credibilidad de tu negocio.',
      },
      {
        number: '3',
        title: 'Botones de Acción (CTAs) y Métricas',
        description: 'Configura el texto de los botones principales (ej. "Ver productos", "Escribinos") y las estadísticas de satisfacción, reparaciones o tiempos de entrega.',
      },
    ],
    proTips: [
      'Mantén el título en menos de 10 palabras enfocado en el beneficio que ofreces al cliente.',
      'Si tienes botón de rastreo de reparaciones, déjalo activo para que tus clientes consulten el estado de sus órdenes sin llamar por teléfono.',
    ],
    publicImpact: 'Afecta: Sección superior de la página de inicio (banner principal y botones de acción rápida).',
  },
  {
    id: 'carousel',
    tabKey: 'carousel',
    label: 'Carrusel de Promociones',
    badge: 'Banners Publicitarios',
    title: 'Carrusel de Ofertas y Banners Destacados',
    subtitle: 'Crea anuncios visuales deslizables para promocionar lanzamientos, combos, marcas o descuentos temporales.',
    icon: GalleryHorizontalEnd,
    color: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-600 via-fuchsia-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Activar y Definir Diapositivas',
        description: 'Activa el carrusel y añade hasta 6 diapositivas con título, mensaje descriptivo, texto de botón y enlace de destino.',
        highlight: 'Puedes enlazar a categorías de productos, WhatsApp directo o páginas de servicio.',
      },
      {
        number: '2',
        title: 'Subir Imágenes Horizontales (12:5)',
        description: 'Carga imágenes de alta calidad (mínimo 1200 × 500 px). El editor ajusta automáticamente el encuadre para computadoras y celulares.',
      },
      {
        number: '3',
        title: 'Contraste, Alineación y Orden',
        description: 'Elige si el texto debe ser claro u oscuro según el fondo de tu imagen, alinea el contenido (izquierda, centro, derecha) y reordena con las flechas.',
      },
    ],
    proTips: [
      'Usa plantillas prediseñadas (Accesorios, Servicio Técnico, Promociones) para crear banners en segundos.',
      'Comprueba la vista previa en modo Celular para asegurarte de que los textos sean legibles en pantallas pequeñas.',
    ],
    publicImpact: 'Afecta: Carrusel deslizable en la parte superior del catálogo y página de inicio.',
  },
  {
    id: 'offers',
    tabKey: 'offers',
    label: 'Ofertas Especiales',
    badge: 'Descuentos Destacados',
    title: 'Bloque de Ofertas y Rebajas del Catálogo',
    subtitle: 'Destaca automáticamente los productos que tienen precios promocionales o descuentos activos.',
    icon: Tag,
    color: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-600 via-pink-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Título y Subtítulo de la Sección',
        description: 'Personaliza el encabezado del bloque de rebajas (ej. "Ofertas por tiempo limitado" o "Precios especiales de la semana").',
      },
      {
        number: '2',
        title: 'Color de Énfasis (Accent Color)',
        description: 'Elige entre tonos llamativos (Rosa, Ámbar, Esmeralda, Violeta) para que la sección de ofertas resalte visualmente sobre el resto del sitio.',
      },
      {
        number: '3',
        title: 'Vinculación con el Inventario',
        description: 'Cualquier producto que tenga un precio de oferta configurado en tu inventario aparecerá automáticamente en esta sección sin trabajo extra.',
      },
    ],
    proTips: [
      'Para que un producto aparezca aquí, simplemente colócale un "Precio de Oferta" desde la sección de Productos.',
    ],
    publicImpact: 'Afecta: Sección de ofertas en la página de inicio y página dedicada `/ofertas`.',
  },
  {
    id: 'services',
    tabKey: 'services',
    label: 'Servicios Técnicos',
    badge: 'Mano de Obra & Soporte',
    title: 'Catálogo de Servicios Profesionales y Reparaciones',
    subtitle: 'Muestra los servicios que ofreces, precios referenciales y tiempos estimados de entrega.',
    icon: Briefcase,
    color: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-600 via-teal-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Publicar Servicios',
        description: 'Crea tarjetas de servicios (ej. "Cambio de Pantalla", "Mantenimiento Preventivo", "Microsoldadura") con descripción clara.',
      },
      {
        number: '2',
        title: 'Tiempos Estimados y Precios Base',
        description: 'Indica el tiempo habitual de trabajo (ej. "En el día", "24 a 48 hs") y el costo desde el cual arranca el servicio.',
      },
      {
        number: '3',
        title: 'Botón de Consulta Directa',
        description: 'Cada servicio incluye un botón que redirige al cliente a consultar directamente por WhatsApp mencionando el servicio específico.',
      },
    ],
    proTips: [
      'Activa la página pública de servicios para tener una URL dedicada (`/servicios`) que puedes compartir en tus redes sociales.',
    ],
    publicImpact: 'Afecta: Cuadrícula de servicios en la página de inicio y portal público `/servicios`.',
  },
  {
    id: 'process',
    tabKey: 'process',
    label: 'Proceso de Atención',
    badge: 'Transparencia al Cliente',
    title: 'Flujo Paso a Paso de Cómo Trabajas',
    subtitle: 'Explica al cliente cómo es el proceso desde que deja su equipo o hace su pedido hasta la entrega final.',
    icon: Footprints,
    color: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-600 via-indigo-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Definir las Etapas',
        description: 'Configura 3 o 4 pasos claros (ej. 1. Diagnóstico Gratuito -> 2. Presupuesto Claro -> 3. Reparación con Repuestos Originales -> 4. Entrega con Garantía).',
      },
      {
        number: '2',
        title: 'Descripciones Claras',
        description: 'Explica en una frase qué ocurre en cada etapa para que el cliente se sienta seguro y conozca los tiempos.',
      },
    ],
    proTips: [
      'Tener un proceso visible reduce significativamente las preguntas y dudas de clientes primerizos.',
    ],
    publicImpact: 'Afecta: Sección "Cómo trabajamos" en la página principal del sitio web.',
  },
  {
    id: 'checkout',
    tabKey: 'checkout',
    label: 'Pagos y Entregas',
    badge: 'Comercio y Envíos',
    title: 'Configuración de Checkout, Pagos y Métodos de Entrega',
    subtitle: 'Elige cómo tus clientes realizan pedidos, métodos de pago aceptados y modalidades de entrega.',
    icon: ShoppingCart,
    color: 'text-teal-600 dark:text-teal-400',
    gradient: 'from-teal-600 via-cyan-600 to-slate-900',
    steps: [
      {
        number: '1',
        title: 'Modalidad de Pedidos',
        description: 'Configura si los clientes pueden hacer pedidos completos con carrito de compras o si prefieren enviar consultas directas por WhatsApp.',
      },
      {
        number: '2',
        title: 'Métodos de Pago Aceptados',
        description: 'Habilita efectivo al recibir, transferencias bancarias, tarjetas o cobros QR con instrucciones claras de pago.',
      },
      {
        number: '3',
        title: 'Zonas de Delivery y Retiro en Local',
        description: 'Define si ofreces retiro en tu local comercial y configura costos fijos o variables para envíos a domicilio.',
      },
    ],
    proTips: [
      'Si tienes local físico, mantén activa la opción de "Retiro en tienda" sin costo adicional para atraer clientes a tu mostrador.',
    ],
    publicImpact: 'Afecta: Carrito de compras, pasarela de confirmación de pedido y modalidades de cobro.',
  },
]

interface WebsiteHowItWorksDialogProps {
  onNavigateToTab?: (tabKey: string) => void
  currentTab?: string
}

export function WebsiteHowItWorksDialog({ onNavigateToTab, currentTab }: WebsiteHowItWorksDialogProps) {
  const [open, setOpen] = useState(false)
  const initialGuide = WEBSITE_GUIDES.find(g => g.tabKey === currentTab) || WEBSITE_GUIDES[0]
  const [selectedGuide, setSelectedGuide] = useState<WebsiteSectionGuide>(initialGuide)

  const handleSelectTab = (guide: WebsiteSectionGuide) => {
    setSelectedGuide(guide)
  }

  const handleGoToSection = () => {
    if (onNavigateToTab) {
      onNavigateToTab(selectedGuide.tabKey)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 font-bold text-xs border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs transition-all"
        >
          <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>¿Cómo funciona el Sitio Web?</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera Principal */}
        <div className={cn('bg-gradient-to-r p-6 text-white shrink-0 relative overflow-hidden transition-all duration-300', selectedGuide.gradient)}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-white shrink-0">
                <selectedGuide.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-extrabold uppercase tracking-wider">
                    {selectedGuide.badge}
                  </Badge>
                  <span className="text-[11px] text-white/80 font-medium hidden sm:inline">
                    Guía de Configuración Web
                  </span>
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                  {selectedGuide.title}
                </DialogTitle>
              </div>
            </div>
          </div>

          <DialogDescription className="text-white/90 text-xs sm:text-sm leading-relaxed mt-2 max-w-2xl">
            {selectedGuide.subtitle}
          </DialogDescription>
        </div>

        {/* Contenido dividido: Barra lateral de secciones + Detalle */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden bg-background">
          {/* Navegación por pestañas laterales */}
          <div className="md:col-span-4 border-r border-border/80 p-3 space-y-1.5 overflow-y-auto bg-muted/20">
            <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Secciones del Sitio Web
            </p>
            {WEBSITE_GUIDES.map((guide) => {
              const isSelected = selectedGuide.id === guide.id
              const GuideIcon = guide.icon
              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => handleSelectTab(guide)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <GuideIcon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary-foreground' : guide.color)} />
                    <span className="truncate">{guide.label}</span>
                  </div>
                  {isSelected && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                </button>
              )
            })}
          </div>

          {/* Panel de detalles del tema seleccionado */}
          <div className="md:col-span-8 p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Pasos explicados */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>¿Cómo configurarlo paso a paso?</span>
              </h4>

              <div className="space-y-2.5">
                {selectedGuide.steps.map((step) => (
                  <div
                    key={step.number}
                    className="p-3.5 rounded-2xl border border-border/70 bg-card hover:border-primary/30 transition-colors space-y-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-black shrink-0">
                        {step.number}
                      </span>
                      <h5 className="text-xs font-bold text-foreground">
                        {step.title}
                      </h5>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8 leading-relaxed">
                      {step.description}
                    </p>
                    {step.highlight && (
                      <p className="text-[11px] font-medium text-primary pl-8 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span>{step.highlight}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Consejos Pro */}
            {selectedGuide.proTips.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <h5 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Consejos para maximizar tus ventas</span>
                </h5>
                <ul className="space-y-1.5 pl-5 list-disc text-xs text-muted-foreground">
                  {selectedGuide.proTips.map((tip, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Impacto público */}
            <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-primary shrink-0" />
              <span>{selectedGuide.publicImpact}</span>
            </div>
          </div>
        </div>

        {/* Footer con botón para saltar directo a la sección */}
        <div className="p-4 border-t bg-card flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            Cerrar
          </Button>

          {onNavigateToTab && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleGoToSection}
              className="gap-2 font-bold text-xs bg-primary text-primary-foreground shadow-md"
            >
              <span>Editar sección: {selectedGuide.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
