'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Save, AlertTriangle, Check, Eye, Power } from 'lucide-react'
import { MaintenanceMode } from '@/types/website-settings'
import Link from 'next/link'

export function MaintenanceModeToggle() {
  const { settings, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Inicializar con datos actuales
  if (!maintenanceMode && settings?.maintenance_mode) {
    setMaintenanceMode(settings.maintenance_mode)
  }

  const handleSave = async () => {
    if (!maintenanceMode) return

    // Validaciones
    if (maintenanceMode.enabled) {
      if (maintenanceMode.title.trim().length < 5) {
        toast.error('Título muy corto', {
          description: 'El título debe tener al menos 5 caracteres'
        })
        return
      }

      if (maintenanceMode.message.trim().length < 10) {
        toast.error('Mensaje muy corto', {
          description: 'El mensaje debe tener al menos 10 caracteres'
        })
        return
      }
    }

    const result = await updateSetting('maintenance_mode', maintenanceMode)
    if (result.success) {
      toast.success(
        maintenanceMode.enabled 
          ? 'Modo mantenimiento activado' 
          : 'Modo mantenimiento desactivado',
        {
          description: maintenanceMode.enabled
            ? 'El sitio público ahora muestra la página de mantenimiento'
            : 'El sitio público está nuevamente disponible',
          icon: <Check className="h-4 w-4" />
        }
      )
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleToggle = (enabled: boolean) => {
    if (!maintenanceMode) return
    
    setMaintenanceMode({ ...maintenanceMode, enabled })
    setHasChanges(true)
  }

  const handleChange = (field: keyof MaintenanceMode, value: string) => {
    if (!maintenanceMode) return
    
    setMaintenanceMode({ ...maintenanceMode, [field]: value })
    setHasChanges(true)
  }

  if (!maintenanceMode) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerta de estado actual */}
      {maintenanceMode.enabled && (
        <div className="rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6 border-2 border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                ⚠️ Modo Mantenimiento Activo
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                El sitio web público está mostrando la página de mantenimiento. Los usuarios no pueden acceder al contenido normal.
              </p>
              <Link href="/inicio" target="_blank">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Página de Mantenimiento
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Card principal */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className={`bg-gradient-to-r ${
          maintenanceMode.enabled 
            ? 'from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20'
            : 'from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                maintenanceMode.enabled
                  ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400'
                  : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
              }`}>
                <Power className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Modo Mantenimiento</CardTitle>
                <CardDescription>
                  {maintenanceMode.enabled 
                    ? 'El sitio está en mantenimiento' 
                    : 'El sitio está disponible públicamente'}
                </CardDescription>
              </div>
            </div>

            {/* Toggle principal */}
            <div className="flex items-center gap-3">
              <Label 
                htmlFor="maintenance-toggle" 
                className={`text-sm font-medium ${
                  maintenanceMode.enabled ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'
                }`}
              >
                {maintenanceMode.enabled ? 'Activado' : 'Desactivado'}
              </Label>
              <Switch
                id="maintenance-toggle"
                checked={maintenanceMode.enabled}
                onCheckedChange={handleToggle}
                className="data-[state=checked]:bg-orange-600"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Título de la Página
            </Label>
            <Input
              id="title"
              value={maintenanceMode.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Sitio en Mantenimiento"
              maxLength={100}
              disabled={!maintenanceMode.enabled}
              className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
            />
            <p className="text-xs text-muted-foreground">
              Título principal que verán los visitantes
            </p>
          </div>

          {/* Mensaje */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">
              Mensaje para los Visitantes
            </Label>
            <Textarea
              id="message"
              value={maintenanceMode.message}
              onChange={(e) => handleChange('message', e.target.value)}
              placeholder="Estamos realizando mejoras en nuestro sitio. Volveremos pronto."
              rows={4}
              maxLength={500}
              disabled={!maintenanceMode.enabled}
              className="border-gray-200 focus:border-orange-500 focus:ring-orange-500 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Mensaje explicativo sobre el mantenimiento
            </p>
          </div>

          {/* Tiempo estimado */}
          <div className="space-y-2">
            <Label htmlFor="estimatedEnd" className="text-sm font-medium">
              Tiempo Estimado (Opcional)
            </Label>
            <Input
              id="estimatedEnd"
              value={maintenanceMode.estimatedEnd || ''}
              onChange={(e) => handleChange('estimatedEnd', e.target.value)}
              placeholder="Estaremos de vuelta en 2 horas"
              maxLength={100}
              disabled={!maintenanceMode.enabled}
              className="border-gray-200 focus:border-orange-500 focus:ring-orange-500"
            />
            <p className="text-xs text-muted-foreground">
              Información sobre cuándo estará disponible nuevamente
            </p>
          </div>

          {/* Información adicional */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Nota importante:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>El panel de administración seguirá funcionando normalmente</li>
                  <li>Solo la página pública (/inicio) mostrará el mensaje de mantenimiento</li>
                  <li>Los usuarios autenticados podrán acceder al dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón de guardar */}
      <div className="sticky bottom-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasChanges}
          size="lg"
          className={`shadow-lg transition-all duration-300 ${
            maintenanceMode.enabled
              ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'
              : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
