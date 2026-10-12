'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { requirementForPath } from '@/lib/navigation/route-modules'
import { OrganizationModuleGate } from './OrganizationModuleGate'

/**
 * Protege toda página del admin y del dashboard según ROUTE_MODULES.
 *
 * Antes cada página ponía (o se olvidaba de poner) su propio bloqueo: Informes,
 * Monitor de caja, Clientes y Posventa no tenían ninguno, y Analítica, Finanzas,
 * Seguridad y Visitas mostraban «mejorá tu plan» aunque el plan ya incluyera el
 * módulo y solo estuviera apagado. Puesto una vez en el layout, cubre también
 * las páginas que se agreguen después.
 */
export function RouteModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { businessVertical } = useSubscriptionStatus()
  const requirement = requirementForPath(pathname ?? '')
  if (!requirement) return <>{children}</>

  const verticalBlocked = Boolean(
    requirement.verticals?.length && businessVertical && !requirement.verticals.includes(businessVertical)
  )
  const content = verticalBlocked ? <NotForThisVertical /> : children

  return requirement.module
    ? <OrganizationModuleGate module={requirement.module}>{content}</OrganizationModuleGate>
    : <>{content}</>
}

function NotForThisVertical() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center p-4">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Compass className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Esta sección no es para el rubro de tu negocio</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Se muestra a los negocios que la usan. Si cambiaste de rubro, revisalo en la configuración.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/settings">
              <Settings2 className="h-4 w-4" />
              Revisar el rubro
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
