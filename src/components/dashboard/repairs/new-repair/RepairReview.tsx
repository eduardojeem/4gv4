'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'

interface RepairReviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  submitting: boolean
  customer: { name: string; phone?: string; wholesale: boolean }
  devices: Array<{ brand: string; model: string; issue: string; technician?: string }>
  parts: Array<{ name: string; quantity: number; cost: number }>
  pricing: { labor: number; discount: number; total: number; deposit: number }
  warranty: { months: number; type: 'labor' | 'parts' | 'full' }
}

const warrantyLabels = {
  labor: 'Solo mano de obra',
  parts: 'Solo repuestos',
  full: 'Mano de obra y repuestos',
}

export function RepairReview({
  open, onOpenChange, onConfirm, submitting, customer, devices, parts, pricing, warranty,
}: RepairReviewProps) {
  const partsTotal = parts.reduce((sum, part) => sum + part.cost * part.quantity, 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Revisión final de la reparación</DialogTitle>
          <DialogDescription>Verificá la información antes de crear la orden definitiva.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
          <section className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Cliente</h3>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-medium">{customer.name}</p>
              {customer.wholesale && <Badge variant="secondary">Cliente mayorista</Badge>}
            </div>
            {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
          </section>

          <section className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Garantía</h3>
            <p className="mt-2 text-sm">{warranty.months ? `${warranty.months} meses` : 'Sin garantía'}</p>
            <p className="text-sm text-muted-foreground">{warrantyLabels[warranty.type]}</p>
          </section>

          <section className="rounded-lg border p-4 md:col-span-2">
            <h3 className="text-sm font-semibold">Equipos y diagnóstico inicial</h3>
            <ul className="mt-2 divide-y">
              {devices.map((device, index) => (
                <li key={`${device.brand}-${device.model}-${index}`} className="py-2 first:pt-0 last:pb-0">
                  <p className="font-medium">{device.brand} {device.model}</p>
                  <p className="text-sm text-muted-foreground">{device.issue}{device.technician ? ` · Técnico: ${device.technician}` : ''}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border p-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Servicios y repuestos</h3>
              <span className="text-sm font-semibold">{formatCurrency(partsTotal)}</span>
            </div>
            {parts.length ? (
              <ul className="mt-2 divide-y">
                {parts.map((part, index) => (
                  <li key={`${part.name}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                    <span>{part.name} × {part.quantity}</span>
                    <span className="font-medium">{formatCurrency(part.cost * part.quantity)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">Sin repuestos cargados.</p>}
          </section>

          <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 md:col-span-2">
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Mano de obra</span><strong className="block">{formatCurrency(pricing.labor)}</strong></div>
              <div><span className="text-muted-foreground">Descuento</span><strong className="block">{formatCurrency(pricing.discount)}</strong></div>
              <div><span className="text-muted-foreground">Adelanto</span><strong className="block">{formatCurrency(pricing.deposit)}</strong></div>
              <div><span className="text-muted-foreground">Total final</span><strong className="block text-xl text-primary">{formatCurrency(pricing.total)}</strong></div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Volver y corregir</Button>
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Guardando…' : 'Confirmar reparación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
