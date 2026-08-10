'use client'

import { useState, useEffect } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, Circle, Compass, ChevronDown, ChevronUp, Sparkles,
  Building2, Tag, Briefcase, Footprints, ShoppingCart, Info, GalleryHorizontalEnd
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupGuideProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function SetupGuide({ activeTab, onTabChange }: SetupGuideProps) {
  const { settings, isLoading } = useAdminWebsiteSettings()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('website-setup-guide-collapsed')
    if (stored) {
      const isTrue = stored === 'true'
      const timer = setTimeout(() => {
        setIsCollapsed(isTrue)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [])

  const toggleCollapse = () => {
    const nextState = !isCollapsed
    setIsCollapsed(nextState)
    localStorage.setItem('website-setup-guide-collapsed', String(nextState))
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
      description: 'Nombre, contacto y logo de tu negocio',
      isCompleted: !!(company?.name?.trim() && company?.phone?.trim() && company?.email?.trim() && company?.address?.trim()),
      tip: 'Completa estos datos para que los clientes puedan contactarte y ver tu logo en el cabezal del sitio.'
    },
    {
      id: 'hero',
      label: 'Presentación (Hero)',
      icon: Sparkles,
      description: 'Título principal y estadísticas clave',
      isCompleted: !!(heroContent?.title?.trim() && heroContent.title !== 'Reparación profesional para tu equipo'),
      tip: 'Personaliza el mensaje principal del banner para llamar la atención del cliente al entrar al sitio.'
    },
    {
      id: 'carousel',
      label: 'Carrusel',
      icon: GalleryHorizontalEnd,
      description: 'Mensajes promocionales destacados',
      isCompleted: carousel?.enabled !== true || carousel.slides.some(slide => slide.active),
      tip: 'El carrusel es opcional. Si lo activás, publicá al menos una diapositiva completa.'
    },
    {
      id: 'offers',
      label: 'Ofertas y Promociones',
      icon: Tag,
      description: 'Banners de ofertas del catálogo',
      isCompleted: !!(offers?.title?.trim() && offers.title !== 'Precios que vale la pena aprovechar'),
      tip: 'Puedes cambiar el título y acento del bloque de ofertas destacadas. Los productos en oferta se toman automáticamente.'
    },
    {
      id: 'services',
      label: 'Servicios',
      icon: Briefcase,
      description: 'Catálogo de servicios y reparaciones',
      isCompleted: services.length > 0 && services.some(s => s.active !== false),
      tip: 'Registra al menos un servicio activo (con su precio estimado, beneficios y tiempos) para mostrarlo en el sitio.'
    },
    {
      id: 'process',
      label: 'Proceso de Trabajo',
      icon: Footprints,
      description: 'Cómo trabajas paso a paso',
      isCompleted:
        company?.processSectionEnabled === false ||
        (
          processFlows.length > 0
            ? processFlows.some(flow => flow.active !== false && flow.steps.length > 0)
            : processSteps.length > 0
        ),
      tip: 'Esta sección es opcional. Puedes ocultarla o elegir una plantilla y personalizar sus pasos.'
    },
    {
      id: 'checkout',
      label: 'Pagos y Entregas',
      icon: ShoppingCart,
      description: 'Habilitar checkout, delivery o retiro',
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
      tip: 'Elegí si la tienda venderá con carrito, recibirá consultas por WhatsApp o funcionará como catálogo.'
    }
  ]

  const completedCount = steps.filter(s => s.isCompleted).length
  const progressPercent = Math.round((completedCount / steps.length) * 100)
  const allCompleted = completedCount === steps.length

  return (
    <Card className={cn('overflow-hidden border shadow-none', allCompleted && 'border-emerald-300 dark:border-emerald-900')}>

      <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
            allCompleted 
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" 
              : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
          )}>
            {allCompleted ? <Sparkles className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Guía de Configuración
              {allCompleted && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Listo
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {allCompleted 
                ? "¡Felicitaciones! Tu portal público tiene configurados todos sus componentes esenciales." 
                : "Sigue los pasos a continuación para configurar y poner a punto tu portal público de cara al cliente."}
            </CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleCollapse} aria-label={isCollapsed ? 'Expandir guía' : 'Contraer guía'} className="h-8 w-8 text-muted-foreground">
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Progreso de configuración</span>
            <span className="font-bold text-foreground">{progressPercent}% ({completedCount} de {steps.length})</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                allCompleted ? "bg-emerald-500" : "bg-blue-600"
              )} 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps Grid */}
        {!isCollapsed && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            {steps.map((step) => {
              const StepIcon = step.icon
              const isActive = activeTab === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onTabChange(step.id)}
                  className={cn(
                    "text-left flex items-start gap-3 rounded-md border p-3 transition-colors",
                    isActive 
                      ? "border-primary bg-primary/5 ring-1 ring-primary/10 shadow-sm" 
                      : "border-border bg-card hover:bg-muted/30 hover:border-muted-foreground/30",
                    step.isCompleted && !isActive && "border-emerald-100 dark:border-emerald-900/20 bg-emerald-50/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-100 dark:fill-transparent" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className={cn(
                      "text-xs font-bold leading-none flex items-center gap-1.5",
                      step.isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                      isActive && "text-primary"
                    )}>
                      <StepIcon className="h-3.5 w-3.5 shrink-0" />
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Selected tab tip card */}
        {!isCollapsed && (
          <div className="flex items-start gap-2.5 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground">
                Tip para pestaña {(steps.find(s => s.id === activeTab)?.label || '').toLowerCase()}:
              </span>
              <p className="leading-relaxed text-muted-foreground">
                {steps.find(s => s.id === activeTab)?.tip}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
