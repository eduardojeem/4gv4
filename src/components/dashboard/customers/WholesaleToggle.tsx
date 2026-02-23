'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ShoppingBag, Loader2, ShieldCheck, ShieldOff, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface WholesaleToggleProps {
  /** UUID del perfil del usuario (profiles.id) */
  profileId: string
  customerName: string
}

export function WholesaleToggle({ profileId, customerName }: WholesaleToggleProps) {
  const [isWholesale, setIsWholesale] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${profileId}/set-wholesale`)
      if (!res.ok) throw new Error('No se pudo obtener el estado')
      const data = await res.json()
      setIsWholesale(data.isWholesale)
    } catch (e) {
      setError('Error al cargar el estado de acceso mayorista')
      setIsWholesale(false)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    if (profileId) fetchStatus()
  }, [profileId, fetchStatus])

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${profileId}/set-wholesale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: checked }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al cambiar el acceso')

      setIsWholesale(checked)
      toast.success(data.message, {
        description: checked
          ? `${customerName} ahora verá precios mayoristas en la tienda.`
          : `${customerName} ahora verá precios regulares en la tienda.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inesperado'
      setError(msg)
      toast.error('Error al cambiar el acceso mayorista', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-t-lg">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-800 dark:text-violet-200">
          <ShoppingBag className="h-4 w-4" />
          Acceso Mayorista
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando acceso...
          </div>
        ) : (
          <>
            {/* Estado actual */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isWholesale ? (
                  <ShieldCheck className="h-5 w-5 text-violet-600" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    Estado actual
                  </p>
                  {isWholesale ? (
                    <Badge className="mt-0.5 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200 border-violet-200 text-xs">
                      Mayorista activo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-0.5 text-xs">
                      Sin acceso mayorista
                    </Badge>
                  )}
                </div>
              </div>

              {/* Toggle */}
              <div className="flex items-center gap-3">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id={`wholesale-toggle-${profileId}`}
                  checked={isWholesale ?? false}
                  onCheckedChange={handleToggle}
                  disabled={saving || loading}
                  className="data-[state=checked]:bg-violet-600"
                />
                <Label
                  htmlFor={`wholesale-toggle-${profileId}`}
                  className="text-sm cursor-pointer select-none"
                >
                  {isWholesale ? 'Habilitado' : 'Deshabilitado'}
                </Label>
              </div>
            </div>

            {/* Descripción */}
            <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
              Al habilitar el acceso mayorista, este cliente verá los{' '}
              <span className="font-medium">precios de por mayor</span> en la tienda cuando ingrese
              con su cuenta. El cambio es inmediato.
            </p>

            {/* Error inline */}
            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
