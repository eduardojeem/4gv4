'use client'

import Link from 'next/link'
import { Settings2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import type { OrganizationModule } from '@/lib/organization/business-profile'
import { PlanGate } from './PlanGate'

export function OrganizationModuleGate({
  module,
  children,
}: {
  module: OrganizationModule
  children: React.ReactNode
}) {
  const { effectiveModules, entitledModules, moduleTrials } = useSubscriptionStatus()
  if (effectiveModules.includes(module)) return <>{children}</>

  const commerciallyAvailable = entitledModules.includes(module)
    || moduleTrials.some(trial => trial.module === module)
  if (!commerciallyAvailable) {
    return <PlanGate module={module}>{children}</PlanGate>
  }

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center p-4">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SlidersHorizontal className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Módulo desactivado para esta organización</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta herramienta está incluida en tu plan, pero fue ocultada desde el perfil del negocio. Sus datos siguen guardados.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/settings">
              <Settings2 className="h-4 w-4" />
              Revisar módulos
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
