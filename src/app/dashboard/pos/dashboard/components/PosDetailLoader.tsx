import { Button } from '@/components/ui/button'
export interface PosDetailProps { detailsLoaded?: boolean; detailsLoading?: boolean; detailsError?: Error | null; onLoadDetails?: () => void }
export function PosDetailLoader({ detailsLoading, detailsError, onLoadDetails }: PosDetailProps) {
  return <div className="rounded-xl border p-4 space-y-2">
    <p className="text-sm text-muted-foreground">El detalle del período se carga al solicitarlo.</p>
    {detailsError && <p role="alert" className="text-sm text-destructive">{detailsError.message}</p>}
    <Button variant="outline" disabled={detailsLoading} onClick={onLoadDetails}>{detailsLoading ? 'Cargando detalle completo…' : detailsError ? 'Reintentar detalle' : 'Cargar detalle del período'}</Button>
  </div>
}
