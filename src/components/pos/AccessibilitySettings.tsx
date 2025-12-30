'use client'

import React from 'react'
import { useAccessibility } from '@/contexts/accessibility-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  Eye, 
  Type, 
  Zap, 
  Volume2, 
  Contrast,
  Settings,
  Accessibility
} from 'lucide-react'

interface AccessibilitySettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function AccessibilitySettings({ isOpen, onClose }: AccessibilitySettingsProps) {
  const {
    highContrast,
    toggleHighContrast,
    fontSize,
    setFontSize,
    reducedMotion,
    toggleReducedMotion,
    screenReaderMode,
    toggleScreenReaderMode
  } = useAccessibility()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Accessibility className="h-5 w-5" />
              <CardTitle>Configuración de Accesibilidad</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Cerrar configuración de accesibilidad"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Modo de Alto Contraste */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Contrast className="h-4 w-4" />
              <Label className="text-sm font-medium">Modo de Alto Contraste</Label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Mejora la visibilidad con colores de alto contraste
              </span>
              <Switch
                checked={highContrast}
                onCheckedChange={toggleHighContrast}
                aria-label="Activar modo de alto contraste"
              />
            </div>
          </div>

          <Separator />

          {/* Tamaño de Fuente */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              <Label className="text-sm font-medium">Tamaño de Fuente</Label>
            </div>
            <Select value={fontSize} onValueChange={setFontSize}>
              <SelectTrigger aria-label="Seleccionar tamaño de fuente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
                <SelectItem value="extra-large">Extra Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Movimiento Reducido */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <Label className="text-sm font-medium">Movimiento Reducido</Label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Reduce animaciones y transiciones
              </span>
              <Switch
                checked={reducedMotion}
                onCheckedChange={toggleReducedMotion}
                aria-label="Activar movimiento reducido"
              />
            </div>
          </div>

          <Separator />

          {/* Modo Lector de Pantalla */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <Label className="text-sm font-medium">Modo Lector de Pantalla</Label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Optimiza la interfaz para lectores de pantalla
              </span>
              <Switch
                checked={screenReaderMode}
                onCheckedChange={toggleScreenReaderMode}
                aria-label="Activar modo lector de pantalla"
              />
            </div>
          </div>

          <Separator />

          {/* Información adicional */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <Label className="text-sm font-medium">Atajos de Teclado</Label>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+H</kbd> - Mostrar atajos</div>
              <div><kbd className="px-1 py-0.5 bg-muted rounded">F1</kbd> - Ayuda de accesibilidad</div>
              <div><kbd className="px-1 py-0.5 bg-muted rounded">/</kbd> - Buscar productos</div>
              <div><kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> - Cerrar diálogos</div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cerrar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                // Resetear a valores por defecto
                setFontSize('normal')
                if (highContrast) toggleHighContrast()
                if (reducedMotion) toggleReducedMotion()
                if (screenReaderMode) toggleScreenReaderMode()
              }}
            >
              Restablecer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}