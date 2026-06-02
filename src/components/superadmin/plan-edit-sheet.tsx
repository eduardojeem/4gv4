'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SubscriptionPlan, updateSubscriptionPlan } from '@/services/subscription-plans'
import { toast } from 'sonner'
import { Clock, Loader2, Star } from 'lucide-react'

type PlanEditSheetProps = {
  plan: SubscriptionPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function PlanEditSheet({ plan, open, onOpenChange, onSuccess }: PlanEditSheetProps) {
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [isPopular, setIsPopular] = useState(false)

  useEffect(() => {
    if (plan) {
      setIsActive(plan.is_active)
      setIsPopular(plan.is_popular)
    }
  }, [plan])

  if (!plan) return null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)

      const limits = { ...plan?.limits }
      limits.users = formData.get('limit_users') as string
      limits.products = formData.get('limit_products') as string
      limits.branches = formData.get('limit_branches') as string
      limits.repairs = formData.get('limit_repairs') as string

      // Update highlights from textarea (one per line)
      const highlightsRaw = formData.get('highlights') as string
      const highlights = highlightsRaw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      await updateSubscriptionPlan(plan!.id, {
        name: formData.get('name') as string,
        price: Number(formData.get('price')),
        price_note: formData.get('price_note') as string,
        description: formData.get('description') as string,
        is_active: isActive,
        is_popular: isPopular,
        trial_days: Number(formData.get('trial_days')) || 0,
        limits,
        highlights,
      })

      toast.success('Plan actualizado correctamente')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el plan')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Plan {plan.name}</SheetTitle>
          <SheetDescription>
            Modifica la información comercial y los límites de este plan.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b pb-2">
              Información Comercial
            </h3>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre público</Label>
              <Input id="name" name="name" defaultValue={plan.name} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio (PYG)</Label>
                <Input id="price" name="price" type="number" step="1" min="0" defaultValue={plan.price} required />
                <p className="text-xs text-slate-400">En guaraníes — ej: 70000</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_note">Nota de precio</Label>
                <Input id="price_note" name="price_note" defaultValue={plan.price_note || ''} placeholder="por mes" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={plan.description || ''}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="highlights">Highlights (1 por línea)</Label>
              <Textarea
                id="highlights"
                name="highlights"
                defaultValue={(plan.highlights || []).join('\n')}
                rows={4}
                placeholder="POS completo&#10;Reparaciones&#10;Gestión de clientes"
              />
              <p className="text-xs text-slate-400">Bullets de venta visibles en cards públicas</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="flex items-center gap-1.5">
                    Plan activo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Los planes inactivos quedan ocultos para nuevas contrataciones.
                  </p>
                </div>
                <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_popular" className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-violet-500" /> Marcar como popular
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Destacado en la página pública. Solo un plan puede ser popular a la vez.
                  </p>
                </div>
                <Switch id="is_popular" checked={isPopular} onCheckedChange={setIsPopular} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trial_days" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-cyan-500" /> Días de prueba
              </Label>
              <Input
                id="trial_days"
                name="trial_days"
                type="number"
                min="0"
                max="365"
                defaultValue={plan.trial_days ?? 14}
              />
              <p className="text-xs text-slate-400">Cuánto dura el trial de este plan al registrarse</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b pb-2">
              Límites del Sistema
            </h3>
            <p className="text-xs text-slate-500">
              Usá <code className="rounded bg-muted px-1 text-[10px]">Ilimitado</code> para cuotas sin tope.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit_users">Usuarios</Label>
                <Input id="limit_users" name="limit_users" defaultValue={String(plan.limits?.users ?? '')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit_products">Productos</Label>
                <Input id="limit_products" name="limit_products" defaultValue={String(plan.limits?.products ?? '')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit_branches">Sucursales</Label>
                <Input id="limit_branches" name="limit_branches" defaultValue={String(plan.limits?.branches ?? '')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit_repairs">Reparaciones</Label>
                <Input id="limit_repairs" name="limit_repairs" defaultValue={String(plan.limits?.repairs ?? '')} />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-background pb-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
