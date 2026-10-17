import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CatalogData } from '@/hooks/use-catalog-sync'

export function CatalogManager({ data, ready }: { data: CatalogData; ready: boolean }) {
  return <div className="grid gap-4 md:grid-cols-3">
    {([['categories', 'Categorías'], ['brands', 'Marcas'], ['suppliers', 'Proveedores']] as const).map(([kind, label]) => (
      <Card key={kind}>
        <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-3xl font-bold">{ready ? data[kind].length : '—'}</p>
          <p className="text-sm text-muted-foreground">{ready ? `${data[kind].filter(item => item.is_active).length} activos` : 'Datos no disponibles'}</p>
          <Link className="inline-block text-primary underline" href={`/dashboard/${kind}`}>Gestionar {label.toLowerCase()}</Link>
        </CardContent>
      </Card>
    ))}
  </div>
}
