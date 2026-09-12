'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, Circle, Compass, ChevronDown, ChevronUp, Sparkles,
  Building2, Tag, Briefcase, Footprints, ShoppingCart, Info, GalleryHorizontalEnd,
  ArrowRight, Lightbulb, ShieldCheck
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

  const trustBar = settings.trust_bar
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
      id: 'trust_bar',
      label: 'Beneficios y Garantías',
      icon: ShieldCheck,
      description: 'Barra de confianza: envíos, garantía y soporte',
      isCompleted: trustBar?.enabled !== false && (trustBar?.items?.length ?? 0) > 0,
      tip: 'La barra de confianza destaca que ofreces garantía, envíos seguros y atención personalizada para transmitir seguridad.',
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
      isCompleted:
        company?.servicesPageEnabled === false ||
        (services.length > 0 && services.some(s => s.active !== false)),
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
      <CardHeader className="p-3 sm:p-3.5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-colors",
              allCompleted 
                ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" 
                : "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
            )}>
              {allCompleted ? <Sparkles className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs sm:text-sm font-bold text-foreground truncate">
                  Guía de Configuración
                </CardTitle>
                {allCompleted ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[9px] font-black uppercase px-1.5 py-0">
                    100%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] font-semibold text-muted-foreground border-border px-1.5 py-0">
                    {completedCount}/{steps.length}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Indicador de % compacto en el header */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    allCompleted ? "bg-emerald-500" : "bg-primary"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-bold text-[11px] text-muted-foreground">{progressPercent}%</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? 'Expandir guía' : 'Contraer guía'}
              aria-expanded={!isCollapsed}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-3.5 pt-0 space-y-2.5">
        {/* Barra de Progreso Móvil cuando está colapsado */}
        <div className="sm:hidden">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                allCompleted ? "bg-emerald-500" : "bg-primary"
              )} 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Grilla de Pasos Compacta */}
        {!isCollapsed && (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 pt-0.5">
            {steps.map((step) => {
              const StepIcon = step.icon
              const isActive = activeTab === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onTabChange(step.id)}
                  className={cn(
                    "text-left flex flex-col justify-between gap-1.5 rounded-xl border p-2 transition-all relative group",
                    isActive 
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-2xs" 
                      : "border-border/70 bg-card hover:bg-muted/40 hover:border-primary/40",
                    step.isCompleted && !isActive && "border-emerald-200/50 dark:border-emerald-900/20 bg-emerald-50/5"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "p-1 rounded-md",
                      isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                    )}>
                      <StepIcon className="h-3.5 w-3.5" />
                    </div>
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="min-w-0 w-full">
                    <p className={cn(
                      "text-[11px] font-semibold leading-tight truncate",
                      step.isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                      isActive && "text-primary font-bold"
                    )}>
                      {step.label}
                    </p>
                    <span className={cn(
                      "text-[9px] block",
                      step.isCompleted ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-amber-600 dark:text-amber-400 font-medium"
                    )}>
                      {step.isCompleted ? 'Listo' : 'Pendiente'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Consejo contextual compacto */}
        {!isCollapsed && activeStepObj && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/30 dark:bg-indigo-950/20 px-3 py-2 text-[11px] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <p className="truncate">
              <strong className="text-foreground">{activeStepObj.label}:</strong> {activeStepObj.tip}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
