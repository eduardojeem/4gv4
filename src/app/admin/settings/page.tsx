'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Settings, Save, RotateCcw, AlertCircle, HelpCircle,
  Loader2, Globe, Package, Bell, Shield, Palette, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  getSystemColorSchemeOption,
  isSystemColorScheme,
  type SystemColorScheme,
} from '@/lib/theme/color-schemes'
import { SystemColorSchemePicker } from '@/components/system/system-color-scheme-picker'

export default function AdminSettingsPage() {
  const {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    isSaving,
    error,
    settingsSource,
    updateSetting,
    saveSettings,
    resetSettings
  } = useSharedSettings()
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth()
  const { setTheme, setColorScheme } = useTheme()

  const [activeTab, setActiveTab] = useState('company')

  const changedFields = useMemo(() => {
    return Object.keys(settings).reduce((count, key) => {
      const typedKey = key as keyof typeof settings
      return JSON.stringify(settings[typedKey]) === JSON.stringify(originalSettings[typedKey])
        ? count
        : count + 1
    }, 0)
  }, [settings, originalSettings])

  // Sync theme on first load
  const initialSyncDone = useRef(false)
  useEffect(() => {
    if (isLoading || initialSyncDone.current) return
    setTheme(settings.theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(settings.primaryColor) ? settings.primaryColor : DEFAULT_SYSTEM_COLOR_SCHEME)
    initialSyncDone.current = true
  }, [isLoading, settings.theme, settings.primaryColor, setTheme, setColorScheme])

  const handleThemeChange = (value: string) => {
    updateSetting('theme', value)
    setTheme(value as 'light' | 'dark' | 'system')
  }

  const handleColorChange = (value: SystemColorScheme) => {
    updateSetting('primaryColor', value)
    setColorScheme(value)
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {authLoading ? 'Verificando permisos...' : 'Cargando configuración...'}
          </p>
        </div>
      </div>
    )
  }

  const canRenderFallback = settingsSource === 'cache'

  if (error && !canRenderFallback) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Error al cargar</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSave = async () => {
    const result = await saveSettings()
    if (result.success) {
      toast.success('Configuración guardada')
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleReset = () => {
    resetSettings()
    setTheme(originalSettings.theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(originalSettings.primaryColor) ? originalSettings.primaryColor : DEFAULT_SYSTEM_COLOR_SCHEME)
    toast.info('Cambios descartados')
  }

  const selectedColorScheme = getSystemColorSchemeOption(settings.primaryColor)
  const quickColorValue = ['blue', 'green', 'purple', 'orange', 'red'].includes(settings.primaryColor)
    ? settings.primaryColor
    : '__catalog__'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajustes generales del sistema y la empresa
          </p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="self-start sm:self-auto text-xs gap-1">
            <AlertCircle className="h-3 w-3" />
            {changedFields} cambio{changedFields !== 1 ? 's' : ''} sin guardar
          </Badge>
        )}
      </div>

      {/* Cache warning */}
      {error && canRenderFallback && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Usando datos en caché</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
          <span className="text-sm font-medium text-primary">
            Hay cambios sin guardar
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-9 w-full justify-start">
          <TabsTrigger value="company" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Apariencia
          </TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>Estos datos aparecen en tickets, facturas y la página pública</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre <span className="text-destructive">*</span></Label>
                  <Input id="companyName" value={settings.companyName} onChange={(e) => updateSetting('companyName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRuc">RUC</Label>
                  <Input id="companyRuc" value={settings.companyRuc} onChange={(e) => updateSetting('companyRuc', e.target.value)} placeholder="80012345-6" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input id="companyEmail" type="email" value={settings.companyEmail} onChange={(e) => updateSetting('companyEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Teléfono</Label>
                  <Input id="companyPhone" value={settings.companyPhone} onChange={(e) => updateSetting('companyPhone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input id="city" value={settings.city} onChange={(e) => updateSetting('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={settings.currency} onValueChange={(v) => updateSetting('currency', v)}>
                    <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PYG">PYG - Guaraní</SelectItem>
                      <SelectItem value="USD">USD - Dólar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate" className="flex items-center gap-1.5">
                    IVA (%)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent><p>Se muestra en tickets y se usa para cálculos</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input id="taxRate" type="number" min="0" max="100" value={settings.taxRate} onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Sesión (minutos)</Label>
                  <Input id="sessionTimeout" type="number" min="5" max="480" value={settings.sessionTimeout} onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 60)} />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="companyAddress">Dirección</Label>
                <Textarea id="companyAddress" value={settings.companyAddress} onChange={(e) => updateSetting('companyAddress', e.target.value)} rows={2} className="resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Regional */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Regional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select value={settings.timeZone} onValueChange={(v) => updateSetting('timeZone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Asuncion">Asunción (GMT-4)</SelectItem>
                      <SelectItem value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato de Fecha</Label>
                  <Select value={settings.dateFormat} onValueChange={(v) => updateSetting('dateFormat', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-violet-500" />
                Apariencia
              </CardTitle>
              <CardDescription>Tema y colores del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select value={settings.theme} onValueChange={handleThemeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color rápido</Label>
                  <Select value={quickColorValue} onValueChange={(v) => { if (v !== '__catalog__') handleColorChange(v as SystemColorScheme) }}>
                    <SelectTrigger><SelectValue placeholder="Elegir color" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__catalog__">Catálogo completo</SelectItem>
                      <SelectItem value="blue">Azul</SelectItem>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="purple">Púrpura</SelectItem>
                      <SelectItem value="orange">Naranja</SelectItem>
                      <SelectItem value="red">Rojo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
                <Label>Catálogo de esquemas</Label>
                <SystemColorSchemePicker value={settings.primaryColor} onChange={handleColorChange} />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{selectedColorScheme.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedColorScheme.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Primario</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">Superficie</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Registros por página</Label>
                <Select value={String(settings.itemsPerPage)} onValueChange={(v) => updateSetting('itemsPerPage', parseInt(v))}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-500" />
                Inventario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Umbral de stock bajo</Label>
                <Input type="number" min="1" value={settings.lowStockThreshold} onChange={(e) => updateSetting('lowStockThreshold', parseInt(e.target.value) || 10)} />
                <p className="text-xs text-muted-foreground">Cantidad mínima antes de alertar</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Respaldo automático</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Crear respaldos del sistema</p>
                </div>
                <Switch checked={settings.autoBackup} onCheckedChange={(v) => updateSetting('autoBackup', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-500" />
                Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Notificaciones por correo</p>
                </div>
                <Switch checked={settings.emailNotifications} onCheckedChange={(v) => updateSetting('emailNotifications', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">SMS</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Alertas críticas por mensaje</p>
                </div>
                <Switch checked={settings.smsNotifications} onCheckedChange={(v) => updateSetting('smsNotifications', v)} />
              </div>
              {isSuperAdmin && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <div>
                    <Label className="text-sm font-medium">Modo mantenimiento</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Desactiva el acceso público</p>
                  </div>
                  <Switch checked={settings.maintenanceMode} onCheckedChange={(v) => updateSetting('maintenanceMode', v)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                Seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Longitud mínima de contraseña</Label>
                <Input type="number" min="6" max="32" value={settings.passwordMinLength} onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value) || 8)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">Permitir registro</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Nuevos usuarios pueden crear cuenta</p>
                </div>
                <Switch checked={settings.allowRegistration} onCheckedChange={(v) => updateSetting('allowRegistration', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">Verificación de email</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Requerir verificación al registrarse</p>
                </div>
                <Switch checked={settings.requireEmailVerification} onCheckedChange={(v) => updateSetting('requireEmailVerification', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm font-medium">Dos factores (2FA)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Código adicional al iniciar sesión</p>
                </div>
                <Switch checked={settings.requireTwoFactor} onCheckedChange={(v) => updateSetting('requireTwoFactor', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
