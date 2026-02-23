'use client'

import Link from 'next/link'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'

export function PublicFooter() {
  const { settings } = useWebsiteSettings()
  const company = settings?.company_info

  const phoneDisplay = company?.phone || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const emailDisplay = company?.email || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  const addressDisplay = company?.address || ''

  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <p className="text-sm font-bold text-foreground tracking-tight">
              4G Celulares
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Reparacion profesional de celulares con garantia. Venta de accesorios y repuestos.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Navegacion
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/inicio"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href="/productos"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Productos
                </Link>
              </li>
              <li>
                <Link
                  href="/mis-reparaciones"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mis Reparaciones
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Contacto
            </h3>
            <ul className="space-y-2.5 text-sm">
              {phoneDisplay && (
                <li className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
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
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
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
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{addressDisplay}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Horarios
            </h3>
            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div>Lun - Vie: 8:00 - 18:00</div>
                <div>Sabados: 9:00 - 13:00</div>
                <div>Domingos: Cerrado</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          <p>
            {'© '}
            {new Date().getFullYear()} 4G Celulares. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
