'use client'

import { CatalogManager } from '@/components/dashboard/catalog-manager'
import { useCatalogSync } from '@/hooks/use-catalog-sync'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

export default function CatalogPage() {
  const { catalogData, ready, isLoading, error, refresh, exportData } = useCatalogSync()
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Gestión de Catálogo</h1>
        <p className="text-muted-foreground">Categorías, marcas y proveedores del negocio actual.</p></div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={isLoading} onClick={refresh}>{isLoading ? 'Cargando…' : 'Actualizar'}</Button>
        <Button variant="outline" disabled={!ready} onClick={() => { try { exportData() } catch { toast.error('No se pudo exportar el catálogo') } }}>Exportar</Button>
      </div>
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <CatalogManager data={catalogData} ready={ready} />
    <p className="text-sm text-muted-foreground">Gestiona los registros en sus pantallas correspondientes y actualiza este resumen al regresar. La exportación contiene los mismos registros cargados. Los conteos de productos y órdenes no están disponibles en este resumen.</p>
  </div>
}
