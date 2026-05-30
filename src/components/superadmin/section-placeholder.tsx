import Link from 'next/link'
import { ArrowRight, Construction } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SectionPlaceholderProps = {
  title: string
  description: string
  items?: string[]
}

export function SectionPlaceholder({ title, description, items = [] }: SectionPlaceholderProps) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Construction className="h-4 w-4" />
          <span>Modulo plataforma</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Base adaptada</CardTitle>
              <CardDescription>
                Esta seccion existe para mantener paridad con el modulo importado y conectar endpoints seguros por etapas.
              </CardDescription>
            </div>
            <Badge variant="outline">En progreso</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item} className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          )}

          <Button asChild variant="outline">
            <Link href="/superadmin">
              Volver al resumen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
