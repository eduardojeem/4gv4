'use client'

import { Button } from '@/components/ui/button'
import { ChevronRight, Heart, LayoutDashboard, Settings, Shield, ShoppingCart, WalletCards, Wrench } from 'lucide-react'
import Link from 'next/link'

interface ProfileQuickActionsProps {
  role: string
  tenantPrefix?: string
  variant?: 'all' | 'marketplace' | 'account'
  showStaffPanel?: boolean
  showAuthorizedPersons?: boolean
}

import { ChangePasswordDialog } from './change-password-dialog'

export function ProfileQuickActions({
  role,
  tenantPrefix = '',
  variant = 'all',
  showStaffPanel = true,
  showAuthorizedPersons = true,
}: ProfileQuickActionsProps) {
  // 'super_admin' es mas privilegiado que 'admin' y quedaba afuera de esta
  // lista, asi que ese rol no veia el acceso al panel desde su propio perfil.
  const isStaff = role === 'admin' || role === 'super_admin' || role === 'vendedor' || role === 'tecnico'
  const repairsHref = tenantPrefix ? `${tenantPrefix}/mis-reparaciones` : '/mis-reparaciones'
  const creditsHref = tenantPrefix === '/marketplace'
    ? '#tiendas'
    : tenantPrefix
      ? `${tenantPrefix}/perfil/creditos`
      : '/perfil/creditos'
  const authorizedHref = tenantPrefix ? `${tenantPrefix}/perfil/autorizados` : '/perfil/autorizados'

  if (variant === 'marketplace') {
    const activityLinks = [
      { href: '#favoritos', label: 'Favoritos', icon: Heart, tone: 'text-rose-600 bg-rose-500/10' },
      { href: '#carritos', label: 'Carritos', icon: ShoppingCart, tone: 'text-primary bg-primary/10' },
      { href: repairsHref, label: 'Rastrear equipo', icon: Wrench, tone: 'text-amber-700 bg-amber-500/10 dark:text-amber-300' },
      { href: creditsHref, label: 'Créditos y cuotas', icon: WalletCards, tone: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300' },
      ...(showAuthorizedPersons
        ? [{ href: authorizedHref, label: 'Personas autorizadas', icon: Shield, tone: 'text-info bg-info/10' }]
        : []),
    ]

    return (
      <nav aria-label="Accesos de mi actividad" className="overflow-x-auto pb-1">
        <div className={`grid min-w-[560px] gap-2 sm:min-w-0 ${activityLinks.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {activityLinks.map(({ href, label, icon: Icon, tone }) => (
            <Link
              key={label}
              href={href}
              className="group flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main actions */}
      {variant !== 'account' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="#favoritos"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-rose-500/30 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
            <Heart className="h-5 w-5 fill-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Mis Favoritos</p>
            <p className="text-xs text-muted-foreground">Productos guardados</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="#carritos"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Carritos en tiendas</p>
            <p className="text-xs text-muted-foreground">Compras pendientes</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href={repairsHref}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Rastrear equipo</p>
            <p className="text-xs text-muted-foreground">Ver estado en tiempo real</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href={creditsHref}
          className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <WalletCards className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Créditos y cuotas</p>
            <p className="text-xs text-muted-foreground">Deudas, vencimientos y pagos</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        {showAuthorizedPersons && <Link
          href={authorizedHref}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Personas autorizadas</p>
            <p className="text-xs text-muted-foreground">Gestionar autorizaciones</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>}

      </div>}

      <div>
        <ChangePasswordDialog />
      </div>

      {/* Admin/Staff access */}
      {showStaffPanel && isStaff && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Panel de Administracion
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {role === 'admin' || role === 'super_admin'
                  ? 'Accede al panel completo del sistema'
                  : role === 'vendedor'
                  ? 'Accede al dashboard de ventas'
                  : 'Accede al panel tecnico'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="h-8">
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                </Button>
                {(role === 'admin' || role === 'super_admin') && (
                  <Button asChild variant="outline" size="sm" className="h-8">
                    <Link href="/admin">
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      Admin
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
