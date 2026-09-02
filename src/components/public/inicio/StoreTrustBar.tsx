import {
  CreditCard,
  ShieldCheck,
  Truck,
  MessageCircle,
  Star,
  Award,
  Zap,
  Clock,
  Wrench,
  Package,
  MapPin,
  ThumbsUp,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  LucideIcon
} from 'lucide-react'
import type { TrustBarSettings } from '@/types/website-settings'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  'credit-card': CreditCard,
  shield: ShieldCheck,
  message: MessageCircle,
  star: Star,
  award: Award,
  zap: Zap,
  clock: Clock,
  wrench: Wrench,
  package: Package,
  'map-pin': MapPin,
  'thumbs-up': ThumbsUp,
  sparkles: Sparkles,
  handshake: HeartHandshake,
  check: CheckCircle2,
}

const DEFAULT_BENEFITS = [
  {
    icon: 'truck',
    title: 'Envíos Rápidos',
    description: 'A domicilio o retiro en tienda',
    active: true,
  },
  {
    icon: 'credit-card',
    title: 'Medios de Pago',
    description: 'Tarjetas, cuotas y transferencias',
    active: true,
  },
  {
    icon: 'shield',
    title: 'Compra Segura',
    description: 'Garantía oficial en tus compras',
    active: true,
  },
  {
    icon: 'message',
    title: 'Atención Directa',
    description: 'Asesoramiento personalizado',
    active: true,
  },
]

export function StoreTrustBar({
  settings,
  className
}: {
  settings?: TrustBarSettings
  className?: string
}) {
  if (settings && settings.enabled === false) {
    return null
  }

  const items = settings?.items?.length ? settings.items : DEFAULT_BENEFITS
  const activeItems = items.filter((b) => b.active !== false && b.title.trim() !== '')

  if (activeItems.length === 0) {
    return null
  }

  const gridColsClass =
    activeItems.length === 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : activeItems.length === 2
      ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
      : activeItems.length === 3
      ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto'
      : 'grid-cols-2 md:grid-cols-4'

  return (
    <div className={cn('border-b border-border/80 bg-card/60 backdrop-blur-xs py-5 sm:py-6', className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn('grid gap-3.5 sm:gap-4 md:gap-5', gridColsClass)}>
          {activeItems.map((b, idx) => {
            const Icon = (b.icon && ICON_MAP[b.icon.toLowerCase()]) || ShieldCheck

            return (
              <div
                key={('id' in b && b.id) || idx}
                className="group flex items-center gap-3.5 rounded-2xl border border-border/60 bg-background/80 p-3.5 transition-all duration-200 hover:border-primary/40 hover:shadow-xs hover:bg-background"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {b.title}
                  </h4>
                  {b.description && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {b.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
