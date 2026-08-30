'use client'

import Link from 'next/link'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { isPublicServicesPageAvailable, isPublicRepairsAvailable } from '@/lib/website/services'
import type { WebsiteSettings } from '@/types/website-settings'

export function PublicFooter({ initialSettings = null }: { initialSettings?: WebsiteSettings | null }) {
  const { settings } = useWebsiteSettings()
  const pathname = usePathname()
  const effectiveSettings = settings ?? initialSettings
  const company = effectiveSettings?.company_info
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const phoneDisplay = company?.phone || ''
  const emailDisplay = company?.email || ''
  const addressDisplay = company?.address || ''
  const companyName = company?.name || 'Tienda'

  const servicesEnabled = isPublicServicesPageAvailable(
    company?.servicesPageEnabled,
    effectiveSettings?.services
  )
  const repairsEnabled = isPublicRepairsAvailable(company, effectiveSettings?.services)

  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Brand */}
          <div>
            <p className="text-base font-extrabold text-foreground tracking-tight">
              {companyName}
            </p>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {company?.slogan || `${companyName} - Tienda oficial. Catálogo con stock actualizado, garantía y atención personalizada.`}
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Navegación
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link
                  href={`${tenantPrefix}/inicio`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href={`${tenantPrefix}/productos`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Productos
                </Link>
              </li>

              {servicesEnabled && (
                <li>
                  <Link
                    href={`${tenantPrefix}/servicios`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Servicios
                  </Link>
                </li>
              )}

              {repairsEnabled && (
                <li>
                  <Link
                    href={`${tenantPrefix}/mis-reparaciones`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mis Reparaciones
                  </Link>
                </li>
              )}

              <li>
                <Link
                  href={`${tenantPrefix}/track`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Rastrear Pedidos
                </Link>
              </li>

              <li>
                <Link
                  href={`${tenantPrefix}/inicio#contacto`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contacto y Ubicación
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Contacto
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {phoneDisplay && (
                <li className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <a
                    href={`tel:${phoneDisplay.replace(/\D/g, '')}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {phoneDisplay}
                  </a>
                </li>
              )}
              {emailDisplay && (
                <li className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <a
                    href={`mailto:${emailDisplay}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {emailDisplay}
                  </a>
                </li>
              )}
              {addressDisplay && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">{addressDisplay}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Horarios
            </h3>
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <div>{company?.hours?.weekdays || 'Lunes a Viernes'}</div>
                {company?.hours?.saturday && <div>Sábados: {company.hours.saturday}</div>}
                {company?.hours?.sunday && <div>Domingos: {company.hours.sunday}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {companyName}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
