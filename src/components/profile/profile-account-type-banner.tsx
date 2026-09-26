'use client'

import Link from 'next/link'
import { Building2, LayoutDashboard, ExternalLink, Store, User, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface UserOrganizationInfo {
  id: string
  name: string
  slug: string
  role: string
  plan?: string
  logoUrl?: string | null
}

interface ProfileAccountTypeBannerProps {
  organization?: UserOrganizationInfo | null
  userRole?: string
}

export function ProfileAccountTypeBanner({ organization, userRole = 'cliente' }: ProfileAccountTypeBannerProps) {
  const isBusiness = Boolean(
    organization ||
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'tecnico' ||
    userRole === 'vendedor'
  )

  if (isBusiness && organization) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-semibold text-[11px]">
                  Cuenta comercial
                </Badge>
                {organization.plan && (
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 border-cyan-500/40">
                    Plan {organization.plan}
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 text-lg font-bold text-foreground">
                {organization.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
                Gestioná el catálogo, las ventas y la operación de tu tienda desde el panel administrativo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            <Button asChild size="sm" className="h-9 px-4 rounded-lg font-semibold">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Administrar tienda
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 px-3.5 rounded-lg text-xs font-semibold">
              <Link href={`/${organization.slug}/inicio`} target="_blank" rel="noopener noreferrer">
                <Store className="mr-1.5 h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                Ver Mi Tienda
                <ExternalLink className="ml-1.5 h-3 w-3 opacity-60" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Usuario 100% Cliente / Comprador
  return (
      <div className="rounded-xl border border-border bg-card p-5 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-semibold">
                Cuenta personal
              </Badge>
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-foreground">
              Tus compras y servicios, en un solo perfil
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
              Tus pedidos, favoritos, carritos y reparaciones se reúnen acá, aunque pertenezcan a tiendas diferentes.
            </p>
          </div>
        </div>

        {/* Invitación a convertirse en empresa */}
        <div className="flex items-center justify-between gap-3 shrink-0 max-w-sm">
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              ¿Tenés un negocio o taller?
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Publicá tu catálogo en el Marketplace y controlá tu caja y stock.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold shrink-0">
            <Link href="/saas">
              Conocer SaaS
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
