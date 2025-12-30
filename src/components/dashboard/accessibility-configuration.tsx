'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Accessibility, 
  Eye, 
  Keyboard, 
  Volume2, 
  Monitor, 
  Palette,
  AlertCircle,
  CheckCircle,
  Info,
  Lightbulb,
  Settings,
  Zap
} from 'lucide-react'
import { useAccessibility } from '@/hooks/use-accessibility'
import { toast } from 'sonner'

export function AccessibilityConfiguration() {
  const {
    settings,
    isLoading,
    hasUnsavedChanges,
    updateSetting,
    saveSettings,
    resetSettings,
    detectSystemPreferences,
    getRecommendations,
    checkBrowserSupport
  } = useAccessibility()

  const handleSave = async () => {
    const result = await saveSettings()
    if (result.success) {
      toast.success('Configuraciones de accesibilidad guardadas')
    } else {
      toast.error('Error al guardar configuraciones')
    }
  }

  const handleDetectPreferences = () => {
    const detected = detectSystemPreferences()
    const detectedCount = Object.keys(detected).length
    
    if (detectedCount > 0) {
      toast.success(`Se detectaron ${detectedCount} preferencia(s) del sistema`)
    } else {
      toast.info('No se detectaron preferencias específicas del sistema')
    }
  }

  const recommendations = getRecommendations()
  const browserSupport = checkBrowserSupport()

  const fontSizeOptions = [
    { value: 'small', label: 'Pequeño', description: '14px' },
    { value: 'medium', label: 'Mediano', description: '16px' },
    { value: 'large', label: 'Grande', description: '18px' },
    { value: 'extra-large', label: 'Extra Grande', description: '20px' }
  ]

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Accessibility className="h-6 w-6" />
            Configuración de Accesibilidad
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Personaliza la interfaz para mejorar la accesibilidad y usabilidad
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Cambios sin guardar
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDetectPreferences}
          >
            <Zap className="h-4 w-4 mr-2" />
            Detectar Preferencias
          </Button>
        </div>
      </div>

      {/* Recomendaciones */}
      {recommendations.length > 0 && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Recomendaciones de accesibilidad:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuraciones Visuales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Configuraciones Visuales
            </CardTitle>
            <CardDescription>
              Ajustes para mejorar la visibilidad y legibilidad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alto Contraste */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="high-contrast">Alto Contraste</Label>
                <p className="text-sm text-muted-foreground">
                  Aumenta el contraste para mejor visibilidad
                </p>
              </div>
              <Switch
                id="high-contrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSetting('highContrast', checked)}
              />
            </div>

            <Separator />

            {/* Tamaño de Fuente */}
            <div className="space-y-3">
              <Label>Tamaño de Fuente</Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value) => updateSetting('fontSize', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {fontSizeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{option.label}</span>
                        <span className="text-muted-foreground ml-2">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Indicadores de Foco */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="focus-indicator">Indicadores de Foco Mejorados</Label>
                <p className="text-sm text-muted-foreground">
                  Resalta elementos enfocados para navegación por teclado
                </p>
              </div>
              <Switch
                id="focus-indicator"
                checked={settings.focusIndicator}
                onCheckedChange={(checked) => updateSetting('focusIndicator', checked)}
              />
            </div>

            <Separator />

            {/* Amigable para Daltonismo */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="color-blind-friendly">Amigable para Daltonismo</Label>
                <p className="text-sm text-muted-foreground">
                  Usa patrones y símbolos además de colores
                </p>
              </div>
              <Switch
                id="color-blind-friendly"
                checked={settings.colorBlindFriendly}
                onCheckedChange={(checked) => updateSetting('colorBlindFriendly', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuraciones de Interacción */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Configuraciones de Interacción
            </CardTitle>
            <CardDescription>
              Ajustes para mejorar la navegación e interacción
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Movimiento Reducido */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reduced-motion">Movimiento Reducido</Label>
                <p className="text-sm text-muted-foreground">
                  Reduce animaciones y transiciones
                </p>
              </div>
              <Switch
                id="reduced-motion"
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
              />
            </div>

            <Separator />

            {/* Navegación por Teclado */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="keyboard-navigation">Navegación por Teclado</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita navegación completa por teclado
                </p>
              </div>
              <Switch
                id="keyboard-navigation"
                checked={settings.keyboardNavigation}
                onCheckedChange={(checked) => updateSetting('keyboardNavigation', checked)}
              />
            </div>

            <Separator />

            {/* Optimización para Lectores de Pantalla */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="screen-reader">Optimización para Lectores de Pantalla</Label>
                <p className="text-sm text-muted-foreground">
                  Mejora la compatibilidad con tecnologías asistivas
                </p>
              </div>
              <Switch
                id="screen-reader"
                checked={settings.screenReaderOptimized}
                onCheckedChange={(checked) => updateSetting('screenReaderOptimized', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Soporte del Navegador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Soporte del Navegador
          </CardTitle>
          <CardDescription>
            Estado de compatibilidad con características de accesibilidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Movimiento Reducido</p>
                <p className="text-sm text-muted-foreground">prefers-reduced-motion</p>
              </div>
              {browserSupport.reducedMotion ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Alto Contraste</p>
                <p className="text-sm text-muted-foreground">prefers-contrast</p>
              </div>
              {browserSupport.highContrast ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Esquema de Color</p>
                <p className="text-sm text-muted-foreground">prefers-color-scheme</p>
              </div>
              {browserSupport.colorScheme ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={resetSettings}
        >
          <Settings className="h-4 w-4 mr-2" />
          Restablecer
        </Button>

        <Button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Guardar Configuraciones
        </Button>
      </div>
    </div>
  )
}