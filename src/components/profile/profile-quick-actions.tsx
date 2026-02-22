'use client'

import { Button } from '@/components/ui/button'
import { ChevronRight, LayoutDashboard, Settings, Shield, Wrench } from 'lucide-react'
import Link from 'next/link'

interface ProfileQuickActionsProps {
  role: string
}

export function ProfileQuickActions({ role }: ProfileQuickActionsProps) {
  const isStaff = role === 'admin' || role === 'vendedor' || role === 'tecnico'

  return (
    <div className="flex flex-col gap-3">
      {/* Main actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/mis-reparaciones"
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
          href="/perfil/autorizados"
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
        </Link>
      </div>

      {/* Admin/Staff access */}
      {isStaff && (
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
                {role === 'admin'
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
                {role === 'admin' && (
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
