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
import { useStorefrontStyle } from '@/components/public/storefront-style-context'

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

const BENEFIT_COLOR_THEMES = [
  {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-blue-500/25',
    hoverBorder: 'hover:border-blue-500/50 hover:shadow-blue-500/10',
  },
  {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-emerald-500/25',
    hoverBorder: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
  },
  {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white group-hover:shadow-amber-500/25',
    hoverBorder: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
  },
  {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white group-hover:shadow-purple-500/25',
    hoverBorder: 'hover:border-purple-500/50 hover:shadow-purple-500/10',
  },
]

export function StoreTrustBar({
  settings,
  className
}: {
  settings?: TrustBarSettings
  className?: string
}) {
  const storefrontStyle = useStorefrontStyle()

  if (!settings || settings.enabled === false) {
    return null
  }

  const items = settings.items ?? []
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
      // Con cuatro beneficios, dos columnas en un teléfono dejan 81px de texto:
      // «A domicilio o retiro en tienda» se leía «A domicilio o r…». Una
      // columna hasta sm, dos desde ahí.
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'

  return (
    <div className={cn(
      'border-b border-primary/15 bg-gradient-to-r from-primary/[0.04] via-card/85 to-primary/[0.05] backdrop-blur-xs py-5 sm:py-6',
      storefrontStyle === 'beauty' && 'border-border/60 bg-background py-4 sm:py-5',
      className,
    )}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn('grid gap-3.5 sm:gap-4 md:gap-5', gridColsClass)}>
          {activeItems.map((b, idx) => {
            const Icon = (b.icon && ICON_MAP[b.icon.toLowerCase()]) || ShieldCheck
            const theme = BENEFIT_COLOR_THEMES[idx % BENEFIT_COLOR_THEMES.length]

            return (
              <div
                key={('id' in b && b.id) || idx}
                className={cn(
                  'group flex items-center gap-3.5 rounded-2xl border border-border/80 bg-card/90 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:bg-card',
                  storefrontStyle === 'beauty' ? 'rounded-xl border-border/60 bg-card p-3 shadow-none hover:translate-y-0 hover:shadow-none' : theme.hoverBorder
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105 group-hover:shadow-xs',
                    storefrontStyle === 'beauty' ? 'border-primary/15 bg-primary/5 text-primary group-hover:scale-100 group-hover:shadow-none' : theme.bg
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Sin `truncate`: el beneficio se lee entero o no sirve. */}
                  <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                    {b.title}
                  </h4>
                  {b.description && (
                    <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">
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
