'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createSubscriptionPlan } from '@/services/subscription-plans'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  existingTiers: string[]
}

export function PlanCreateSheet({ open, onOpenChange, onSuccess, existingTiers }: Props) {
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState<'free' | 'basic' | 'pro' | 'enterprise'>('basic')

  // Tiers ya tomados
  const availableTiers = (['free', 'basic', 'pro', 'enterprise'] as const).filter((t) => !existingTiers.includes(t))

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!availableTiers.length) {
      toast.error('Todos los tiers ya existen')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      const highlightsRaw = (fd.get('highlights') as string) || ''
      const highlights = highlightsRaw.split('\n').map((s) => s.trim()).filter(Boolean)

      await createSubscriptionPlan({
        tier,
        name: (fd.get('name') as string).trim(),
        price: Number(fd.get('price') || 0),
        price_note: (fd.get('price_note') as string) || 'por mes',
        description: (fd.get('description') as string) || '',
        trial_days: Number(fd.get('trial_days') || 14),
        highlights,
        limits: {
          users: fd.get('limit_users') || '',
          products: fd.get('limit_products') || '',
          branches: fd.get('limit_branches') || '',
          repairs: fd.get('limit_repairs') || '',
        },
      })
      toast.success('Plan creado correctamente')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Nuevo plan
          </SheetTitle>
          <SheetDescription>
            Creá un nuevo plan de suscripción. Podrás editar features y color luego.
          </SheetDescription>
        </SheetHeader>

        {availableTiers.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-slate-500">
            Todos los tiers (free, basic, pro, enterprise) ya están creados.
            <br />Editá los existentes en lugar de crear nuevos.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tier</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTiers.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium uppercase transition-colors ${
                        tier === t
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">Identificador interno del plan (no editable después)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre público</Label>
                <Input id="name" name="name" defaultValue={tier.toUpperCase()} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (PYG)</Label>
                  <Input id="price" name="price" type="number" step="1" min="0" defaultValue={0} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_note">Nota</Label>
                  <Input id="price_note" name="price_note" defaultValue="por mes" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" name="description" rows={2} placeholder="Para quién está pensado este plan" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial_days">Días de prueba</Label>
                <Input id="trial_days" name="trial_days" type="number" min="0" max="365" defaultValue={14} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="highlights">Highlights (1 por línea)</Label>
                <Textarea id="highlights" name="highlights" rows={3} placeholder="POS completo&#10;Gestión de clientes" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="border-b pb-2 text-sm font-medium">Límites</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limit_users">Usuarios</Label>
                  <Input id="limit_users" name="limit_users" defaultValue="5" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit_products">Productos</Label>
                  <Input id="limit_products" name="limit_products" defaultValue="100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit_branches">Sucursales</Label>
                  <Input id="limit_branches" name="limit_branches" defaultValue="1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit_repairs">Reparaciones</Label>
                  <Input id="limit_repairs" name="limit_repairs" defaultValue="20/mes" />
                </div>
              </div>
              <p className="text-xs text-slate-500">Usá <code className="rounded bg-muted px-1 text-[10px]">Ilimitado</code> para cuotas sin tope.</p>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 bg-background pt-4 pb-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear plan
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
