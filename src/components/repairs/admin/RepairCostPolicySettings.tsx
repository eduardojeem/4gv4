'use client'

import { useState } from 'react'
import { Loader2, ReceiptText, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSharedSettings } from '@/hooks/use-shared-settings'

export function RepairCostPolicySettings() {
  const { settings, isLoading, isSaving, updateSettings, saveSettings } = useSharedSettings()
  const [touched, setTouched] = useState(false)

  const save = async () => {
    const result = await saveSettings()
    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar la política de costos')
      return
    }
    setTouched(false)
    toast.success('Política de costos actualizada')
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando política de costos…</div>
  }

  return <section className="max-w-2xl rounded-2xl border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600"><ReceiptText className="h-5 w-5" /></div>
      <div><h2 className="font-bold">Costos e impuestos</h2><p className="text-xs text-muted-foreground">Reglas aplicadas al editor y validadas nuevamente al guardar.</p></div>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="repair-max-discount">Descuento máximo sin autorización</Label><div className="relative mt-1"><Input id="repair-max-discount" type="number" min={0} max={100} value={settings.repairMaxDiscountPercent} onChange={(event) => { updateSettings({ repairMaxDiscountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }); setTouched(true) }} /><span className="absolute right-3 top-2 text-sm text-muted-foreground">%</span></div><p className="mt-1 text-xs text-muted-foreground">Un administrador puede excederlo dejando un motivo auditable.</p></div>
      <div><Label htmlFor="repair-labor-tax">IVA incluido en mano de obra</Label><select id="repair-labor-tax" value={settings.repairLaborTaxRate} onChange={(event) => { updateSettings({ repairLaborTaxRate: Number(event.target.value) as 0 | 5 | 10 }); setTouched(true) }} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value={0}>Exenta (0%)</option><option value={5}>IVA 5%</option><option value={10}>IVA 10%</option></select><p className="mt-1 text-xs text-muted-foreground">El IVA está incluido: se desglosa, no se suma otra vez.</p></div>
    </div>
    <div className="mt-5 flex justify-end"><Button type="button" disabled={!touched || isSaving} onClick={() => void save()}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar política</Button></div>
  </section>
}
