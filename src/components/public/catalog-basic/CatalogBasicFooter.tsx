'use client'

import React from 'react'
import Link from 'next/link'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { StoreSocialLinks } from '@/components/public/StoreSocialLinks'
import type { CompanyInfo } from '@/types/website-settings'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'

export function CatalogBasicFooter({
  company,
  prefix,
  branches,
}: {
  company?: CompanyInfo
  prefix: string
  branches?: BranchLocationData[]
}) {
  const currentYear = new Date().getFullYear()
  const companyName = company?.name || 'Catálogo Digital'
  const mapsHref =
    company?.mapsUrl ||
    (company?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`
      : null)

  const hasHours = Boolean(
    company?.hours?.weekdays || company?.hours?.saturday || company?.hours?.sunday
  )

  return (
    <footer
      data-catalog-basic-footer
      role="contentinfo"
      aria-label="Pie de página del catálogo"
      className="border-t border-border/80 bg-muted/30 text-foreground transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* 1. Datos de la empresa */}
          <div className="space-y-3">
            <p className="text-base font-bold tracking-tight text-foreground">{companyName}</p>
            {company?.slogan ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{company.slogan}</p>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Vitrina digital de productos y disponibilidad.
              </p>
            )}
            <div className="pt-1">
              <StoreSocialLinks company={company} companyName={companyName} />
            </div>
          </div>

          {/* 2. Navegación directa */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catálogo</h3>
            <nav aria-label="Navegación del catálogo" className="flex flex-col space-y-2 text-xs font-medium">
              <Link
                href={`${prefix}/inicio`}
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
              >
                Inicio
              </Link>
              <Link
                href={`${prefix}/productos`}
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
              >
                Todos los productos
              </Link>
            </nav>
          </div>

          {/* 3. Contacto y ubicación */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ubicación y contacto</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {company?.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      {company.address}
                    </a>
                  ) : (
                    <span>{company.address}</span>
                  )}
                </li>
              )}
              {company?.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <a
                    href={`tel:${company.phone.replace(/[^+0-9]/g, '')}`}
                    className="hover:text-foreground hover:underline transition-colors"
                  >
                    {company.phone}
                  </a>
                </li>
              )}
              {company?.email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <a
                    href={`mailto:${company.email}`}
                    className="hover:text-foreground hover:underline transition-colors"
                  >
                    {company.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* 4. Horarios de atención */}
          {hasHours && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Horario de atención</h3>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  {company?.hours?.weekdays && <div>Lun a Vie: {company.hours.weekdays}</div>}
                  {company?.hours?.saturday && <div>Sáb: {company.hours.saturday}</div>}
                  {company?.hours?.sunday && <div>Dom: {company.hours.sunday}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sucursales (si hay más de una) */}
        {branches && branches.length > 1 && (
          <div className="mt-8 border-t border-border/60 pt-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nuestras Sucursales</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((b) => (
                <div key={b.id} className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
                  <p className="font-semibold text-foreground">{b.name}</p>
                  {b.address && <p className="text-muted-foreground mt-0.5">{b.address}</p>}
                  {b.phone && (
                    <a
                      href={`tel:${b.phone.replace(/[^+0-9]/g, '')}`}
                      className="mt-1 inline-block text-primary hover:underline"
                    >
                      {b.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cierre legal y copyright */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {currentYear} {companyName}. Catálogo digital informativo.</p>
          <LegalFooterLinks />
        </div>
      </div>
    </footer>
  )
}
