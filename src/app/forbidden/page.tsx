import Link from 'next/link'
import { Home, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ForbiddenSearchParams = Promise<{ reason?: string; from?: string }>

function getDescription(reason?: string) {
  if (reason === 'admin') {
    return 'Tu cuenta no tiene permisos administrativos para abrir esta seccion.'
  }

  if (reason === 'dashboard') {
    return 'Tu cuenta no puede acceder a esta seccion protegida del sistema.'
  }

  return 'No tienes permisos para acceder a este contenido.'
}

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: ForbiddenSearchParams
}) {
  const params = await searchParams
  const reason = typeof params.reason === 'string' ? params.reason : undefined
  const from = typeof params.from === 'string' ? params.from : undefined

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-xl border-border/60 shadow-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Acceso Denegado</CardTitle>
            <CardDescription className="text-base">
              {getDescription(reason)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {from ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Ruta solicitada: <span className="font-mono text-foreground">{from}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/inicio">
                <Home className="mr-2 h-4 w-4" />
                Ir a Inicio
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">
                <LockKeyhole className="mr-2 h-4 w-4" />
                Iniciar Sesion
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
