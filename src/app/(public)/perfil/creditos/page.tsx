import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CreditsClient } from '@/components/profile/credits/credits-client'

export const metadata = {
  title: 'Mis Créditos - 4G',
  description: 'Revisa tu historial de créditos y pagos.',
}

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <main className="container max-w-4xl py-12 px-4 relative flex-1">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 group text-muted-foreground hover:text-foreground">
            <Link href="/perfil">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Volver al perfil
            </Link>
          </Button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Mis Créditos
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">
                Consulta los montos que tienes por pagar, fechas de vencimiento y tu historial.
              </p>
            </div>
          </div>
        </div>

        <CreditsClient />

      </main>
    </div>
  )
}
