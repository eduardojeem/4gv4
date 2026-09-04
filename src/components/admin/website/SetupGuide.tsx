'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, Circle, Compass, ChevronDown, ChevronUp, Sparkles,
  Building2, Tag, Briefcase, Footprints, ShoppingCart, Info, GalleryHorizontalEnd,
  ArrowRight, Lightbulb
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupGuideProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function SetupGuide({ activeTab, onTabChange }: SetupGuideProps) {
  const { settings, isLoading } = useAdminWebsiteSettings()
  const [isCollapsed, setIsCollapsed] = useState(true)

  const toggleCollapse = () => {
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
  }

  if (isLoading || !settings) {
    return null
  }

  const company = settings.company_info
  const heroContent = settings.hero_content
  const offers = settings.offers_section
  const carousel = settings.promotional_carousel
  const services = settings.services || []
  const processSteps = settings.process_steps || []
  const processFlows = settings.process_flows || []
  const checkout = settings.checkout

  // Completion logic
  const steps = [
    {
      id: 'company',
      label: 'Datos de Empresa',
      icon: Building2,
      description: 'Nombre, eslogan, logo y WhatsApp comercial',
      isCompleted: !!(company?.name?.trim() && company?.phone?.trim() && company?.email?.trim() && company?.address?.trim()),
      tip: 'Completa estos datos para que los clientes puedan contactarte directamente y ver tu logo oficial en el encabezado.',
    },
    {
      id: 'hero',
      label: 'Portada (Hero)',
      icon: Sparkles,
      description: 'Título principal y garantías de confianza',
      isCompleted: !!(heroContent?.title?.trim() && heroContent.title !== 'Reparación profesional para tu equipo'),
      tip: 'Personaliza el mensaje principal del banner para llamar la atención del cliente al entrar al sitio.',
    },
    {
      id: 'carousel',
      label: 'Carrusel de Promos',
      icon: GalleryHorizontalEnd,
      description: 'Banners promocionales destacados',
      isCompleted: carousel?.enabled !== true || carousel.slides.some(slide => slide.active),
      tip: 'El carrusel es opcional. Si lo activas, publica al menos un banner con imagen horizontal de alta calidad (12:5).',
    },
    {
      id: 'offers',
      label: 'Ofertas Especiales',
      icon: Tag,
      description: 'Bloque de rebajas del catálogo',
      isCompleted: !!(offers?.title?.trim() && offers.title !== 'Precios que vale la pena aprovechar'),
      tip: 'Puedes cambiar el título y color de acento. Los productos con precio de oferta configurado se mostrarán automáticamente.',
    },
    {
      id: 'services',
      label: 'Servicios Técnicos',
      icon: Briefcase,
      description: 'Catálogo de reparaciones y mano de obra',
      isCompleted: services.length > 0 && services.some(s => s.active !== false),
      tip: 'Registra al menos un servicio activo (con su precio estimado, beneficios y tiempos de entrega) para mostrarlo en el sitio.',
    },
    {
      id: 'process',
      label: 'Proceso de Atención',
      icon: Footprints,
      description: 'Flujo de trabajo paso a paso',
      isCompleted:
        company?.processSectionEnabled === false ||
        (
          processFlows.length > 0
            ? processFlows.some(flow => flow.active !== false && flow.steps.length > 0)
            : processSteps.length > 0
        ),
      tip: 'Esta sección es opcional. Puedes ocultarla o personalizar los pasos para generar máxima confianza al cliente.',
    },
    {
      id: 'checkout',
      label: 'Pagos y Entregas',
      icon: ShoppingCart,
      description: 'Métodos de pago, delivery o retiro en local',
      isCompleted: !!(
        checkout &&
        (
          checkout.commerceMode !== 'cart' ||
          (
            (checkout.payment.cash.enabled ||
              checkout.payment.card.enabled ||
              checkout.payment.transfer.enabled ||
              checkout.payment.digital_wallet.enabled) &&
            (checkout.delivery.enabled || checkout.pickup.enabled)
          )
        )
      ),
      tip: 'Elige si la tienda venderá con carrito tradicional, recibirá pedidos automáticos por WhatsApp o funcionará como catálogo.',
    }
  ]

  const completedCount = steps.filter(s => s.isCompleted).length
  const progressPercent = Math.round((completedCount / steps.length) * 100)
  const allCompleted = completedCount === steps.length

  const activeStepObj = steps.find(s => s.id === activeTab) || steps[0]

  return (
    <Card className={cn(
      'overflow-hidden rounded-2xl border transition-all shadow-xs',
      allCompleted 
        ? 'border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/10' 
        : 'border-border/80 bg-card'
    )}>
      <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-colors",
            allCompleted 
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" 
              : "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
          )}>
            {allCompleted ? <Sparkles className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <span>Guía de Configuración de la Tienda</span>
              {allCompleted ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] font-black uppercase px-2 py-0.5">
                  100% Lista
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border px-2 py-0.5">
                  {completedCount} de {steps.length} completados
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {allCompleted 
                ? "¡Excelente trabajo! Tu portal público tiene todos sus componentes esenciales listos para recibir clientes." 
                : "Haz clic en cada sección a continuación para completarla y dejar tu sitio web impecable."}
            </CardDescription>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expandir guía' : 'Contraer guía'}
          aria-expanded={!isCollapsed}
          className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl shrink-0"
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
        {/* Barra de Progreso Mejorada */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Avance general de tu sitio</span>
            <span className="font-extrabold text-foreground">{progressPercent}% completado</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden p-0.5">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                allCompleted 
                  ? "bg-emerald-500 shadow-sm" 
                  : "bg-gradient-to-r from-blue-600 via-indigo-600 to-primary shadow-xs"
              )} 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Grilla de Pasos / Secciones */}
        {!isCollapsed && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-1">
            {steps.map((step) => {
              const StepIcon = step.icon
              const isActive = activeTab === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onTabChange(step.id)}
                  className={cn(
                    "text-left flex items-start gap-3 rounded-2xl border p-3 sm:p-3.5 transition-all relative overflow-hidden group",
                    isActive 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs" 
                      : "border-border/80 bg-card hover:bg-muted/40 hover:border-primary/30",
                    step.isCompleted && !isActive && "border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/10"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-100 dark:fill-transparent" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className={cn(
                        "text-xs font-bold leading-tight flex items-center gap-1.5 truncate",
                        step.isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                        isActive && "text-primary"
                      )}>
                        <StepIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{step.label}</span>
                      </p>
                      {step.isCompleted ? (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full shrink-0">
                          Listo
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                          Configurar
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Tarjeta de Consejo contextual para la pestaña activa */}
        {!isCollapsed && activeStepObj && (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 text-xs text-muted-foreground">
            <Lightbulb className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-foreground">
                Consejo para la sección {activeStepObj.label}:
              </span>
              <p className="leading-relaxed text-muted-foreground text-[11px] sm:text-xs">
                {activeStepObj.tip}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
