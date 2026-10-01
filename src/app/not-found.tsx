import Link from 'next/link'
import { FileQuestion, Home, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileQuestion className="h-8 w-8" />
        </div>

        <span className="mt-6 inline-block rounded-full bg-muted px-3 py-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Error 404
        </span>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Página no encontrada
        </h1>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          La página o recurso que buscas no existe, fue movido o no está disponible temporalmente.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="gap-2 shadow-xs">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Ir al Dashboard
            </Link>
          </Button>

          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ir al Inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
