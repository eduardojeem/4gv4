import { Button } from '@/components/ui/button'
export function AppointmentCheckoutNotice({ code, cashOpen, onOpenCash, onRemove }: { code: string; cashOpen: boolean; onOpenCash: () => void; onRemove: () => void }) {
 return <section aria-label="Cobro de turno" className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-4 py-3 text-sm">
  <div className="space-y-1"><p className="font-semibold">Cobrar turno {code}</p><p className="text-muted-foreground">El servicio ya está en el carrito con el precio acordado. Al confirmar el cobro, el turno quedará atendido y vinculado a la venta.</p>{!cashOpen && <p className="font-medium text-amber-700 dark:text-amber-300">Todavía no se registró el cobro. Abrí la caja y después elegí cómo paga el cliente.</p>}</div>
  <div className="flex flex-wrap gap-2">{!cashOpen && <Button type="button" size="sm" onClick={onOpenCash}>Abrir caja para cobrar</Button>}<Button type="button" size="sm" variant="ghost" onClick={onRemove}>Salir del cobro del turno</Button></div>
 </section>
}
