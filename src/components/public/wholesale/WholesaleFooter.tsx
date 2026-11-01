'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Phone, Mail, MapPin, ExternalLink, Clock, User } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { StoreSocialLinks } from '@/components/public/StoreSocialLinks'
import type { CompanyInfo } from '@/types/website-settings'

export function WholesaleFooter({ company, prefix }: { company?: CompanyInfo; prefix: string }) {
  const pathname = usePathname()
  const slug = getTenantSlugFromPathname(pathname)
  const { categories } = usePublicCategories()
  const { settings } = useWebsiteSettings()
  const accountHref = loginHrefWithReturn(slug ? prefix + '/cliente/login' : '/login', pathname, slug ? 'next' : 'redirect')
  const currentYear = new Date().getFullYear()

  const topCategories = categories.slice(0, 5)

  return (
    <footer className="border-t border-border/80 bg-muted/30 text-foreground" data-wholesale-footer>
      {/* ── Main Multi-Column Distributor Grid (Desktop: 4-5 cols, Mobile: stacked) ── */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Col 1: Empresa */}
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <p className="text-base font-bold tracking-tight text-foreground">{company?.name || 'Tienda'}</p>
            {company?.slogan && (
              <p className="text-xs leading-relaxed text-muted-foreground">{company.slogan}</p>
            )}
            <div className="pt-1">
              <StoreSocialLinks company={company} companyName={company?.name || 'Tienda'} />
            </div>
          </div>

          {/* Col 2: Catálogo */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catálogo</h4>
            <nav aria-label="Enlaces de la tienda" className="flex flex-col space-y-2 text-xs font-medium">
              <Link href={prefix + '/inicio'} className="hover:text-primary transition-colors">
                Inicio
              </Link>
              <Link href={prefix + '/productos'} className="hover:text-primary transition-colors">
                Todos los productos
              </Link>
              {settings?.offers_section?.enabled && (
                <Link
                  href={prefix + '/ofertas'}
                  className="font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Ofertas especiales
                </Link>
              )}
            </nav>
          </div>

          {/* Col 3: Categorías */}
          {topCategories.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Departamentos</h4>
              <nav aria-label="Categorías principales" className="flex flex-col space-y-2 text-xs text-muted-foreground">
                {topCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={prefix + '/productos?category_id=' + encodeURIComponent(cat.id)}
                    className="hover:text-foreground transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Col 4: Atención & Cuenta */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Atención comercial</h4>
            <div className="flex flex-col space-y-2 text-xs text-muted-foreground">
              <Link href={accountHref} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span>Mi cuenta / Acceso</span>
              </Link>
              {company?.hours && (company.hours.weekdays || company.hours.saturday) && (
                <div className="flex items-start gap-1.5 pt-1 text-[11px]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                  <span className="leading-snug">
                    {company.hours.weekdays && `Lun-Vie: ${company.hours.weekdays}`}
                    {company.hours.saturday && ` · Sáb: ${company.hours.saturday}`}
                  </span>
                </div>
              )}
              {company?.phone && (
                <a
                  href={'https://wa.me/' + company.phone.replace(/\D/g, '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 pt-1 font-semibold text-primary hover:underline"
                >
                  <span>WhatsApp comercial</span>
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          </div>

          {/* Col 5: Contacto */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacto</h4>
            <address className="space-y-2 text-xs not-italic text-muted-foreground">
              {company?.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                  <span>{company.address}</span>
                </div>
              )}
              {company?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={'tel:' + company.phone.replace(/[^+0-9]/g, '')} className="hover:text-foreground font-medium">
                    {company.phone}
                  </a>
                </div>
              )}
              {company?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={'mailto:' + company.email} className="break-all hover:text-foreground">
                    {company.email}
                  </a>
                </div>
              )}
            </address>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar: Legal & Copyright ── */}
      <div className="border-t border-border/60 bg-muted/50 px-4 py-4 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <p>© {currentYear} {company?.name || 'Tienda'}. Todos los derechos reservados.</p>
          <LegalFooterLinks />
        </div>
      </div>
    </footer>
  )
}
