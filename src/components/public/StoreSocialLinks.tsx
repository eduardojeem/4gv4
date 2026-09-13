'use client'

import { getSocialLinks, type SocialPlatform } from '@/lib/public/social-links'
import { SOCIAL_ICONS } from '@/components/public/SocialIcons'
import { cn } from '@/lib/utils'

/**
 * Las redes de la tienda, con el color de cada una.
 *
 * Estaban dentro de la columna de la marca en el pie, en gris y sin nombre:
 * se perdian. El color propio de cada red es lo que las hace reconocibles de
 * un vistazo, asi que vive aca y no repetido en cada pantalla.
 */

type SocialCompany = {
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
} | null | undefined

/** Tinte suave para el icono en reposo. Pensado para fondo claro y oscuro. */
const BRAND_TINT: Record<SocialPlatform, string> = {
  instagram: 'bg-[#E1306C]/10 text-[#C13584] dark:text-[#F77BA0]',
  facebook: 'bg-[#1877F2]/10 text-[#1877F2] dark:text-[#5DA0FF]',
  tiktok: 'bg-foreground/10 text-foreground',
}

/** Al pasar el mouse se llena con el color de la red. */
const BRAND_FILL: Record<SocialPlatform, string> = {
  instagram: 'hover:border-transparent hover:bg-[#E1306C] hover:text-white',
  facebook: 'hover:border-transparent hover:bg-[#1877F2] hover:text-white',
  tiktok: 'hover:border-transparent hover:bg-foreground hover:text-background',
}

export function StoreSocialLinks({
  company,
  companyName,
  variant = 'card',
  className,
}: {
  company: SocialCompany
  /** Para que el lector de pantalla diga de quien es cada red. */
  companyName: string
  /** `card`: icono, red y usuario. `icon`: solo el icono, para el cierre del pie. */
  variant?: 'card' | 'icon'
  className?: string
}) {
  const socialLinks = getSocialLinks(company)
  if (socialLinks.length === 0) return null

  return (
    <ul
      className={cn(
        variant === 'card'
          ? 'grid w-full gap-2.5 sm:grid-cols-2 lg:grid-cols-3'
          : 'flex flex-wrap items-center gap-2',
        className
      )}
    >
      {socialLinks.map((social) => {
        const Icon = SOCIAL_ICONS[social.platform]
        const shared =
          'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

        return (
          <li key={social.platform}>
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${social.label}: ${social.handle}`}
              aria-label={`${social.label} de ${companyName}: ${social.handle}`}
              className={cn(
                shared,
                variant === 'card'
                  ? 'group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-3 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'
                  : cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:-translate-y-0.5',
                      BRAND_FILL[social.platform]
                    )
              )}
            >
              {variant === 'card' ? (
                <>
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                      BRAND_TINT[social.platform]
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {social.label}
                    </span>
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {social.handle}
                    </span>
                  </span>
                </>
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
