'use client'

import Link from 'next/link'
import { Building2, LayoutDashboard, ExternalLink, Store, Sparkles, User, ArrowRight, ShieldCheck } from 'lucide-react'
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
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-50/70 via-background to-blue-50/40 p-5 sm:p-6 shadow-xs dark:from-cyan-950/30 dark:via-background dark:to-blue-950/20 dark:border-cyan-500/20 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-cyan-600 text-white font-bold text-[11px] shadow-xs">
                  🏢 Cuenta Comercial / Empresa
                </Badge>
                {organization.plan && (
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 border-cyan-500/40">
                    Plan {organization.plan}
                  </Badge>
                )}
              </div>
              <h2 className="mt-1.5 text-lg sm:text-xl font-extrabold text-foreground">
                {organization.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
                Esta cuenta administra un negocio adherido a la red. Podés gestionar tu inventario, ventas y órdenes desde el panel, y ver tus compras personales de cliente más abajo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
            <Button asChild size="sm" className="h-9 px-4 rounded-xl font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Panel Administrativo
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 px-3.5 rounded-xl text-xs font-semibold border-cyan-500/30 hover:bg-cyan-50 dark:hover:bg-cyan-950/40">
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-semibold text-muted-foreground border-border bg-muted/40">
                👤 Cuenta de Cliente / Comprador
              </Badge>
              <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Compras y Reparaciones
              </Badge>
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-foreground">
              Tu portal personal de compras y servicios
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-xl">
              Desde acá gestionás tus pedidos, carritos guardados, favoritos y el seguimiento de tus equipos en servicio técnico en todas las tiendas de la red.
            </p>
          </div>
        </div>

        {/* Invitación a convertirse en empresa */}
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5 flex items-center justify-between gap-3 shrink-0 max-w-sm">
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              ¿Tenés un negocio o taller?
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Publicá tu catálogo en el Marketplace y controlá tu caja y stock.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold text-primary border-primary/30 shrink-0">
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
