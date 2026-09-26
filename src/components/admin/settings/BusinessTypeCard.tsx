'use client'

import { useState } from 'react'
import { Check, Loader2, Save, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'retail', label: 'Minorista (tienda física)' },
  { value: 'repair', label: 'Reparaciones técnicas' },
  { value: 'wholesale', label: 'Mayorista / distribución' },
  { value: 'service', label: 'Servicios profesionales' },
  { value: 'mixed', label: 'Mixto (venta + servicio)' },
] as const

/**
 * Tipo de negocio. Vive en Configuración pero se guarda donde siempre:
 * `website_settings.company_info`.
 *
 * Es importante que siga ahí: el resto de Configuración persiste en
 * `system_settings`, otra tabla. Si este campo se mudara junto con la UI, se
 * guardaria en un lugar que ni el onboarding ni el sitio publico leen, y
 * pareceria guardarse sin efecto.
 */
export function BusinessTypeCard() {
  const { settings, isLoading, error, isSaving, updateSetting, refetch } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<string | null>(null)

  const saved = settings?.company_info?.businessType ?? ''
  const current = draft ?? saved
  const hasChanges = draft !== null && draft !== saved

  const handleSave = async () => {
    if (!hasChanges || !settings?.company_info) return

    // Se manda company_info completo: el PUT reemplaza el objeto entero.
    const result = await updateSetting('company_info', {
      ...settings.company_info,
      businessType: current,
    })

    if (!result.success) {
      toast.error(result.error || 'No se pudo guardar el tipo de negocio')
      return
    }
    toast.success('Tipo de negocio actualizado', { icon: <Check className="h-4 w-4" /> })
    setDraft(null)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando tipo de negocio...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-semibold">No se pudo cargar el tipo de negocio</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-muted-foreground" />
          Tipo de negocio
        </CardTitle>
        <CardDescription>
          Define el rubro de la empresa. Se usa para adaptar textos y sugerencias del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="businessType">Rubro</Label>
          <Select value={current} onValueChange={(value) => setDraft(value)}>
            <SelectTrigger id="businessType" className="h-11">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar tipo de negocio
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
