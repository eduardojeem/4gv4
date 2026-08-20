'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Search,
  ListChecks,
  Copy,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Eye,
  X,
  Compass,
  LayoutTemplate,
  SlidersHorizontal,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
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
  locationTag: string
  steps: Array<{
    number: string
    title: string
    description: string
    highlight?: string
    actionLabel?: string
  }>
  proTips: string[]
  publicImpact: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  relatedTab: string
}

export interface ChecklistItem {
  id: string
  tabKey: string
  title: string
  description: string
  recommendation: string
}

const WEBSITE_GUIDES: WebsiteSectionGuide[] = [
  {
    id: 'company',
    tabKey: 'company',
    label: 'Empresa & Marca',
    badge: 'Identidad y Contacto',
    title: 'Información de Empresa e Identidad de Marca',
    subtitle: 'Define el aspecto general de tu tienda, logo oficial, colores institucionales y canales de contacto directo.',
    icon: Building2,
    color: 'text-cyan-600 dark:text-cyan-400',
    gradient: 'from-cyan-600 via-blue-600 to-indigo-900',
    locationTag: 'Encabezado y Pie de página',
    steps: [
      {
        number: '1',
        title: 'Nombre Comercial y Subtítulo / Eslogan',
        description: 'Escribe el nombre oficial de tu negocio y el subtítulo que se mostrará justo debajo del logo (ej. "Reparaciones y Servicios", "Venta y Soporte Especializado").',
        highlight: 'Visible permanentemente en el encabezado principal de todo el sitio web.',
        actionLabel: 'Completar nombre y subtítulo',
      },
      {
        number: '2',
        title: 'Logo Oficial y Color Institucional',
        description: 'Sube el archivo de tu logo en formato PNG o WebP con fondo transparente. Elige el color primario de tu marca o introduce tu código HEX personalizado.',
        highlight: 'Tiñe botones, barras de navegación, insignias y enlaces de toda la tienda.',
        actionLabel: 'Subir logo y color',
      },
      {
        number: '3',
        title: 'WhatsApp Comercial, Horarios y Ubicación',
        description: 'Introduce tu número de WhatsApp con código de país para que los clientes te contacten con 1 clic. Agrega tus horarios de atención y el enlace de Google Maps.',
        highlight: 'Aparecen en la barra superior y en el pie de página (footer).',
        actionLabel: 'Configurar WhatsApp y ubicación',
      },
    ],
    proTips: [
      'Agrega tu número de WhatsApp comercial con código de país para que los clientes inicien chats con un solo toque desde su celular.',
      'Un logo en formato PNG o WebP con fondo transparente evita recuadros blancos sobre fondos de colores u oscuros.',
    ],
    publicImpact: 'Afecta: Encabezado superior, botones de contacto directo, pie de página (footer) y paleta de colores global.',
  },
  {
    id: 'hero',
    tabKey: 'hero',
    label: 'Hero (Portada)',
    badge: 'Primera Impresión',
    title: 'Portada Principal y Estadísticas Clave',
    subtitle: 'El primer bloque visual que ven los visitantes al entrar a tu tienda. Diseñado para generar confianza inmediata y compras rápidas.',
    icon: Sparkles,
    color: 'text-amber-500 dark:text-amber-400',
    gradient: 'from-amber-600 via-orange-600 to-slate-900',
    locationTag: 'Banner principal de bienvenida',
    steps: [
      {
        number: '1',
        title: 'Insignia (Badge) y Título Principal',
        description: 'Escribe una propuesta de valor directa y llamativa (ej. "Servicio técnico especializado" y "Reparación profesional para tu equipo").',
        highlight: 'Es el texto de mayor tamaño e impacto visual en la página principal.',
        actionLabel: 'Personalizar título y badge',
      },
      {
        number: '2',
        title: 'Insignias de Confianza (Trust Badges)',
        description: 'Agrega hasta 3 garantías o credenciales clave (ej. "Garantía escrita", "Repuestos de calidad", "Técnicos certificados").',
        highlight: 'Reducen la duda de compra y aumentan la confianza del comprador.',
        actionLabel: 'Configurar garantías',
      },
      {
        number: '3',
        title: 'Botones de Acción (CTAs) y Métricas',
        description: 'Configura el texto de los botones principales (ej. "Ver productos", "Escribinos") y las estadísticas de satisfacción o tiempos de entrega.',
        highlight: 'Guían al cliente hacia el catálogo de productos o a iniciar una conversación.',
        actionLabel: 'Ajustar botones y métricas',
      },
    ],
    proTips: [
      'Mantén el título en menos de 10 palabras enfocado en el beneficio principal que ofreces al cliente.',
      'Si tienes botón de rastreo de reparaciones, déjalo activo para que tus clientes consulten el avance de sus órdenes.',
    ],
    publicImpact: 'Afecta: Sección superior de la página de inicio (banner principal y botones de acción rápida).',
  },
  {
    id: 'carousel',
    tabKey: 'carousel',
    label: 'Carrusel de Promociones',
    badge: 'Banners Publicitarios',
    title: 'Carrusel de Ofertas y Banners Destacados',
    subtitle: 'Crea anuncios visuales deslizables para promocionar lanzamientos, combos, marcas destacadas o descuentos temporales.',
    icon: GalleryHorizontalEnd,
    color: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-600 via-fuchsia-600 to-slate-900',
    locationTag: 'Banners superiores del catálogo',
    steps: [
      {
        number: '1',
        title: 'Activar y Crear Diapositivas',
        description: 'Activa el carrusel y añade hasta 6 diapositivas con título, mensaje promocional, texto del botón y enlace de destino.',
        highlight: 'Puedes enlazar a categorías de productos, WhatsApp directo o páginas de servicio.',
        actionLabel: 'Crear nueva diapositiva',
      },
      {
        number: '2',
        title: 'Cargar Imágenes Horizontales (12:5)',
        description: 'Sube imágenes de alta calidad (mínimo 1200 × 500 px). El sistema ajusta automáticamente el encuadre para computadoras y celulares.',
        highlight: 'Usa imágenes con fondo nítido para que el texto resalte con claridad.',
        actionLabel: 'Subir imágenes de banners',
      },
      {
        number: '3',
        title: 'Contraste, Alineación y Orden',
        description: 'Elige si el texto debe ser claro u oscuro según tu imagen, alinea el contenido (izquierda, centro, derecha) y reordena las diapositivas.',
        highlight: 'Verifica la vista previa en modo Celular para asegurar máxima legibilidad.',
        actionLabel: 'Alinear y ordenar diapositivas',
      },
    ],
    proTips: [
      'Usa las plantillas prediseñadas (Accesorios, Servicio Técnico, Promociones) para crear banners en pocos segundos.',
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
    subtitle: 'Destaca automáticamente los productos que tienen precios promocionales o descuentos activos en tu inventario.',
    icon: Tag,
    color: 'text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-600 via-pink-600 to-slate-900',
    locationTag: 'Sección de ofertas y /ofertas',
    steps: [
      {
        number: '1',
        title: 'Título y Mensaje del Bloque',
        description: 'Personaliza el encabezado del bloque de rebajas (ej. "Ofertas por tiempo limitado" o "Precios especiales de la semana").',
        highlight: 'Captura el interés de los compradores que buscan oportunidades y descuentos.',
        actionLabel: 'Personalizar título de ofertas',
      },
      {
        number: '2',
        title: 'Color de Énfasis (Accent Color)',
        description: 'Elige un color llamativo (Rosa, Ámbar, Esmeralda, Violeta) para que la sección de ofertas resalte con fuerza visual.',
        highlight: 'Diferencia el bloque de rebajas del resto de secciones de la página.',
        actionLabel: 'Elegir color de acento',
      },
      {
        number: '3',
        title: 'Sincronización Automática con el Inventario',
        description: 'Cualquier producto que tenga configurado un "Precio de Oferta" en tu inventario aparecerá automáticamente en este bloque.',
        highlight: 'No necesitas cargar productos dos veces: todo se sincroniza con tu stock.',
        actionLabel: 'Gestionar productos con oferta',
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
    subtitle: 'Publica los servicios técnicos que ofreces, precios referenciales y tiempos estimados de entrega.',
    icon: Briefcase,
    color: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-600 via-teal-600 to-slate-900',
    locationTag: 'Grilla de servicios y /servicios',
    steps: [
      {
        number: '1',
        title: 'Publicar Servicios y Reparaciones',
        description: 'Crea tarjetas de servicios (ej. "Cambio de Pantalla", "Mantenimiento Preventivo", "Microsoldadura") con descripciones claras.',
        highlight: 'Muestra a tus clientes todo lo que puedes solucionar en tu taller.',
        actionLabel: 'Agregar nuevo servicio',
      },
      {
        number: '2',
        title: 'Tiempos Estimados y Precios Base',
        description: 'Indica el tiempo habitual de trabajo (ej. "En el día", "24 a 48 hs") y el precio desde el cual arranca el servicio.',
        highlight: 'Evita consultas repetitivas de precios y agiliza las solicitudes de presupuesto.',
        actionLabel: 'Definir precios y tiempos',
      },
      {
        number: '3',
        title: 'Botón de Consulta Directa por WhatsApp',
        description: 'Cada servicio incluye un botón que redirige al cliente a consultar por WhatsApp mencionando el servicio específico.',
        highlight: 'Facilita que el cliente pregunte de inmediato por su equipo o problema.',
        actionLabel: 'Habilitar consultas directas',
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
    subtitle: 'Explica a tus clientes cómo es el proceso desde que dejan su equipo o hacen su pedido hasta la entrega final.',
    icon: Footprints,
    color: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-600 via-indigo-600 to-slate-900',
    locationTag: 'Bloque "Cómo trabajamos"',
    steps: [
      {
        number: '1',
        title: 'Definir las Etapas del Trabajo',
        description: 'Configura 3 o 4 pasos claros (ej. 1. Diagnóstico Gratuito -> 2. Presupuesto Claro -> 3. Reparación con Repuestos Originales -> 4. Entrega con Garantía).',
        highlight: 'Demuestra profesionalismo y orden en tu metodología de trabajo.',
        actionLabel: 'Configurar pasos del proceso',
      },
      {
        number: '2',
        title: 'Descripciones Claras y Concisas',
        description: 'Explica en una frase qué ocurre en cada etapa para que el cliente se sienta seguro y conozca los tiempos esperados.',
        highlight: 'Reduce la ansiedad y llamadas de consulta sobre el estado del trabajo.',
        actionLabel: 'Redactar descripciones',
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
    subtitle: 'Elige cómo tus clientes realizan pedidos, qué métodos de pago aceptas y las modalidades de entrega disponibles.',
    icon: ShoppingCart,
    color: 'text-teal-600 dark:text-teal-400',
    gradient: 'from-teal-600 via-cyan-600 to-slate-900',
    locationTag: 'Carrito y pasarela de checkout',
    steps: [
      {
        number: '1',
        title: 'Modalidad de Compra o Consultas',
        description: 'Configura si los clientes pueden hacer pedidos completos con carrito de compras o si prefieren enviar consultas directas por WhatsApp.',
        highlight: 'Adapta la tienda al modelo de atención más cómodo para tu negocio.',
        actionLabel: 'Elegir modalidad de compra',
      },
      {
        number: '2',
        title: 'Métodos de Pago Aceptados',
        description: 'Habilita efectivo al recibir, transferencias bancarias, tarjetas o cobros QR con instrucciones claras de pago.',
        highlight: 'Ofrece facilidades de pago para no perder ventas.',
        actionLabel: 'Activar métodos de pago',
      },
      {
        number: '3',
        title: 'Zonas de Delivery y Retiro en Local',
        description: 'Define si ofreces retiro en tu local comercial y configura costos fijos o variables para envíos a domicilio.',
        highlight: 'Claridad en los costos de envío antes de que el cliente confirme su compra.',
        actionLabel: 'Configurar delivery y retiro',
      },
    ],
    proTips: [
      'Si tienes local físico, mantén activa la opción de "Retiro en tienda" sin costo adicional para atraer clientes a tu mostrador.',
    ],
    publicImpact: 'Afecta: Carrito de compras, pasarela de confirmación de pedido y modalidades de cobro.',
  },
]

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Imágenes y Banners',
    relatedTab: 'carousel',
    question: '¿Qué tamaño y formato de imagen debo usar para los banners del carrusel?',
    answer: 'La proporción ideal es horizontal (12:5), con un tamaño mínimo de 1200 × 500 px (recomendado 1920 × 800 px). Formatos compatibles: WebP (más rápido), JPG o PNG de hasta 5 MB.',
  },
  {
    id: 'faq-2',
    category: 'Productos & Ofertas',
    relatedTab: 'offers',
    question: '¿Cómo hago para que un producto aparezca en el bloque de Ofertas?',
    answer: 'No tienes que agregarlo a mano. Ve a "Productos", edita el artículo que deseas y completa el campo "Precio de Oferta". El sistema lo incluirá automáticamente en la sección de Ofertas destacadas.',
  },
  {
    id: 'faq-3',
    category: 'Ventas y WhatsApp',
    relatedTab: 'checkout',
    question: '¿Puedo recibir pedidos por WhatsApp en lugar de carrito tradicional?',
    answer: 'Sí. En la pestaña "Pagos y entregas", puedes configurar la modalidad de pedido para que al hacer clic en un producto se genere un mensaje de WhatsApp automático con el nombre y precio del artículo.',
  },
  {
    id: 'faq-4',
    category: 'Reparaciones & Clientes',
    relatedTab: 'hero',
    question: '¿Dónde y cómo pueden mis clientes rastrear el estado de su reparación?',
    answer: 'En el encabezado y en el Hero existe el botón "¿Tenés una reparación? Rastreá tu equipo". El cliente solo ingresa su número de orden o teléfono y ve el avance en tiempo real.',
  },
  {
    id: 'faq-5',
    category: 'Marca & Logo',
    relatedTab: 'company',
    question: '¿Cómo cambio el texto o eslogan que aparece debajo de mi nombre/logo?',
    answer: 'En la pestaña "Empresa", dentro de la sección "Identidad", edita el campo "Subtítulo / Eslogan" y guarda los cambios.',
  },
  {
    id: 'faq-6',
    category: 'Visibilidad Web',
    relatedTab: 'company',
    question: '¿Cómo comparto el enlace de mi tienda en Instagram o WhatsApp?',
    answer: 'Tu enlace web público tiene la estructura: tu-dominio.com/tu-empresa/inicio. Puedes copiarlo directamente con el botón "Copiar enlace de tienda" en este panel.',
  },
]

const CHECKLIST: ChecklistItem[] = [
  {
    id: 'chk-1',
    tabKey: 'company',
    title: '1. Nombre, Logo y WhatsApp',
    description: 'Verifica que tu logo esté cargado y tu número de WhatsApp configurado para recibir consultas.',
    recommendation: 'Esencial para que los clientes te reconozcan y te escriban.',
  },
  {
    id: 'chk-2',
    tabKey: 'hero',
    title: '2. Título de Portada e Insignias',
    description: 'Personaliza el mensaje principal de bienvenida y tus garantías (ej. Garantía escrita, Repuestos de calidad).',
    recommendation: 'Genera confianza inmediata al primer contacto.',
  },
  {
    id: 'chk-3',
    tabKey: 'carousel',
    title: '3. Al menos 1 Banner o Promoción',
    description: 'Sube un banner atractivo para destacar novedades, accesorios o tus mejores servicios.',
    recommendation: 'Aumenta el interés visual y clics a tu catálogo.',
  },
  {
    id: 'chk-4',
    tabKey: 'services',
    title: '4. Servicios Principales Publicados',
    description: 'Crea 2 o 3 servicios habituales con sus tiempos estimados de trabajo.',
    recommendation: 'Permite que te pidan presupuestos directamente.',
  },
  {
    id: 'chk-5',
    tabKey: 'checkout',
    title: '5. Métodos de Pago y Entregas',
    description: 'Habilita si aceptas transferencias, efectivo o delivery a domicilio.',
    recommendation: 'Facilita el cierre de ventas sin fricciones.',
  },
]

interface WebsiteHowItWorksDialogProps {
  onNavigateToTab?: (tabKey: string) => void
  currentTab?: string
  orgSlug?: string | null
}

export function WebsiteHowItWorksDialog({
  onNavigateToTab,
  currentTab,
  orgSlug,
}: WebsiteHowItWorksDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeView, setActiveView] = useState<'sections' | 'faq' | 'checklist'>('sections')
  const [searchQuery, setSearchQuery] = useState('')
  const initialGuide = WEBSITE_GUIDES.find(g => g.tabKey === currentTab) || WEBSITE_GUIDES[0]
  const [selectedGuide, setSelectedGuide] = useState<WebsiteSectionGuide>(initialGuide)

  // Filtrado de secciones según búsqueda
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return WEBSITE_GUIDES
    const q = searchQuery.toLowerCase()
    return WEBSITE_GUIDES.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.subtitle.toLowerCase().includes(q) ||
        g.steps.some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    )
  }, [searchQuery])

  // Filtrado de FAQs según búsqueda
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS
    const q = searchQuery.toLowerCase()
    return FAQS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const handleSelectTab = (guide: WebsiteSectionGuide) => {
    setSelectedGuide(guide)
    setActiveView('sections')
  }

  const handleGoToSection = (tabKey: string) => {
    if (onNavigateToTab) {
      onNavigateToTab(tabKey)
    }
    setOpen(false)
  }

  const handleCopyStoreLink = async () => {
    const host = typeof window !== 'undefined' ? window.location.host : 'app.4g.com.py'
    const slug = orgSlug || 'mi-tienda'
    const url = `https://${host}/${slug}/inicio`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('¡Enlace copiado al portapapeles!', {
        description: url,
      })
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 font-bold text-xs border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs transition-all h-9 px-3.5"
        >
          <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>¿Cómo funciona el Sitio Web?</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl xl:max-w-6xl w-[96vw] h-[92vh] max-h-[94vh] p-0 overflow-hidden rounded-3xl border-border shadow-2xl flex flex-col">
        {/* Cabecera Principal Compacta (Achicada para dar más espacio a los pasos) */}
        <div className={cn('bg-gradient-to-r px-5 py-3.5 sm:px-6 sm:py-4 text-white shrink-0 relative overflow-hidden transition-all duration-300', selectedGuide.gradient)}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner text-white shrink-0">
                <selectedGuide.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                    {selectedGuide.badge}
                  </Badge>
                  <span className="text-[11px] text-white/80 font-medium hidden sm:inline flex items-center gap-1">
                    <LayoutTemplate className="h-3 w-3" />
                    {selectedGuide.locationTag}
                  </span>
                </div>
                <DialogTitle className="text-base sm:text-lg font-extrabold text-white tracking-tight mt-0.5">
                  {selectedGuide.title}
                </DialogTitle>
              </div>
            </div>

            {/* Acciones rápidas de cabecera compactas */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyStoreLink}
                className="gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm shadow-xs h-8 px-2.5"
                title="Copiar enlace público de tu tienda para WhatsApp o redes"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copiar Enlace</span>
              </Button>
              {orgSlug && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  asChild
                  className="gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm shadow-xs h-8 px-2.5"
                >
                  <a href={`/${orgSlug}/inicio`} target="_blank" rel="noreferrer">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ver Tienda</span>
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Selector de modo compacto */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveView('sections')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeView === 'sections'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/15 hover:text-white'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Secciones ({WEBSITE_GUIDES.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('faq')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeView === 'faq'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/15 hover:text-white'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Preguntas Frecuentes ({FAQS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('checklist')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeView === 'checklist'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:bg-white/15 hover:text-white'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Checklist de Lanzamiento</span>
            </button>
          </div>
        </div>

        {/* Buscador Rápido Compacto */}
        <div className="py-2 px-5 sm:px-6 border-b bg-muted/25 flex items-center gap-2.5 shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la guía: ej. WhatsApp, logo, tamaño de banner, delivery, ofertas..."
            className="h-8 text-xs sm:text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Contenedor Principal con Guía Paso a Paso Ampliada y Destacada */}
        {activeView === 'sections' && (
          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden bg-background">
            {/* Navegación por pestañas laterales */}
            <div className="md:col-span-4 border-r border-border/80 p-3 space-y-1.5 overflow-y-auto bg-muted/15">
              <p className="px-2 py-1 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Secciones del Sitio Web
              </p>
              {filteredGuides.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground italic">No se encontraron secciones para &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                filteredGuides.map((guide) => {
                  const isSelected = selectedGuide.id === guide.id
                  const GuideIcon = guide.icon
                  return (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => handleSelectTab(guide)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-2xl text-left text-xs sm:text-sm font-semibold transition-all',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-xl shrink-0',
                          isSelected ? 'bg-white/20 text-white' : 'bg-muted text-foreground'
                        )}>
                          <GuideIcon className={cn('h-3.5 w-3.5', isSelected ? 'text-primary-foreground' : guide.color)} />
                        </div>
                        <div className="truncate leading-tight">
                          <span className="block truncate font-bold">{guide.label}</span>
                          <span className={cn('block text-[10px] truncate', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                            {guide.badge}
                          </span>
                        </div>
                      </div>
                      {isSelected && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-90" />}
                    </button>
                  )
                })
              )}
            </div>

            {/* Panel de detalles de la sección: Guía Paso a Paso Ampliada */}
            <div className="md:col-span-8 p-5 sm:p-7 overflow-y-auto space-y-6">
              {/* Descripción de la sección */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-1">
                <h3 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-2">
                  <selectedGuide.icon className={cn('h-4.5 w-4.5', selectedGuide.color)} />
                  <span>{selectedGuide.title}</span>
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {selectedGuide.subtitle}
                </p>
              </div>

              {/* Pasos explicados con gran tamaño y detalle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4.5 w-4.5 text-primary" />
                    <span>Guía de Configuración Paso a Paso</span>
                  </h4>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selectedGuide.steps.length} pasos sencillos
                  </span>
                </div>

                <div className="space-y-3.5">
                  {selectedGuide.steps.map((step) => (
                    <div
                      key={step.number}
                      className="p-5 rounded-2xl border-2 border-border/70 bg-card hover:border-primary/50 transition-all space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-sm font-black shadow-xs shrink-0">
                            {step.number}
                          </span>
                          <h5 className="text-sm sm:text-base font-extrabold text-foreground">
                            {step.title}
                          </h5>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-foreground/90 pl-11 leading-relaxed font-normal">
                        {step.description}
                      </p>

                      {step.highlight && (
                        <div className="ml-11 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-xs text-primary font-semibold">
                          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="leading-snug">{step.highlight}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Consejos Pro */}
              {selectedGuide.proTips.length > 0 && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <h5 className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Lightbulb className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                    <span>Consejos prácticos para maximizar tus ventas</span>
                  </h5>
                  <ul className="space-y-2 pl-5 list-disc text-xs sm:text-sm text-muted-foreground">
                    {selectedGuide.proTips.map((tip, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Indicador de impacto público */}
              <div className="p-4 rounded-2xl bg-muted/40 border text-xs sm:text-sm text-muted-foreground flex items-center gap-3">
                <Store className="h-4.5 w-4.5 text-primary shrink-0" />
                <span>{selectedGuide.publicImpact}</span>
              </div>
            </div>
          </div>
        )}

        {/* Vista de Preguntas Frecuentes (FAQ) */}
        {activeView === 'faq' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1 bg-background">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="text-xs sm:text-sm font-extrabold text-foreground uppercase tracking-wider">
                Respuestas a Dudas Habituales
              </h4>
              <span className="text-xs text-muted-foreground">
                Mostrando {filteredFaqs.length} de {FAQS.length} preguntas
              </span>
            </div>

            <div className="space-y-3.5">
              {filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/30 transition-all space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-black shrink-0 mt-0.5">
                        ?
                      </span>
                      <h5 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                        {faq.question}
                      </h5>
                    </div>
                    <Badge variant="outline" className="text-[11px] shrink-0 font-medium px-2 py-0.5">
                      {faq.category}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground pl-9 leading-relaxed">
                    {faq.answer}
                  </p>
                  <div className="pl-9 pt-1">
                    <button
                      type="button"
                      onClick={() => handleGoToSection(faq.relatedTab)}
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>Ir a la sección correspondiente</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vista de Checklist de Lanzamiento */}
        {activeView === 'checklist' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-5 flex-1 bg-background">
            <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-start gap-3.5">
              <CheckCircle2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                  Pasos Esenciales para Publicar tu Tienda
                </h5>
                <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-300/90 leading-relaxed mt-1">
                  Completa estos 5 pasos recomendados para que tu sitio web esté 100% listo para recibir clientes y cerrar ventas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {CHECKLIST.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <h5 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                      <span>{item.title}</span>
                    </h5>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      💡 {item.recommendation}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGoToSection(item.tabKey)}
                    className="gap-2 text-xs font-bold shrink-0 self-start sm:self-auto h-9 px-3.5"
                  >
                    <span>Configurar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer con acciones */}
        <div className="p-4 sm:p-5 border-t bg-card flex flex-wrap items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs sm:text-sm"
          >
            Cerrar
          </Button>

          <div className="flex items-center gap-2.5">
            {orgSlug && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="gap-2 text-xs sm:text-sm h-9"
              >
                <a href={`/${orgSlug}/inicio`} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" />
                  <span>Ver web en vivo</span>
                </a>
              </Button>
            )}

            {onNavigateToTab && activeView === 'sections' && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleGoToSection(selectedGuide.tabKey)}
                className="gap-2 font-bold text-xs sm:text-sm bg-primary text-primary-foreground shadow-sm h-9 px-4"
              >
                <span>Ir a editar: {selectedGuide.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
