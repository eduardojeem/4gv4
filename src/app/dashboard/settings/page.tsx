'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  Package,
  Bell,
  Shield,
  Database,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { useSharedSettings } from '@/hooks/use-shared-settings'

export default function SettingsPageOptimized() {
  const {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    updateSetting,
    saveSettings,
    resetSettings,
    resetToDefaults,
  } = useSharedSettings()

  const [activeTab, setActiveTab] = useState('general')

  const changedFields = useMemo(() => {
    return Object.keys(settings).filter((key) => {
      const settingKey = key as keyof typeof settings
      return settings[settingKey] !== originalSettings[settingKey]
    }).length
  }, [settings, originalSettings])

  const enabledNotifications = [
    settings.emailNotifications,
    settings.smsNotifications,
    settings.lowStockAlerts,
    settings.salesAlerts,
  ].filter(Boolean).length

  const enabledSecurityControls = [settings.requireSpecialChars, settings.twoFactorAuth].filter(Boolean).length

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info('No hay cambios para guardar')
      return
    }

    const result = await saveSettings()

    if (result.success) {
      toast.success('Configuraciones guardadas correctamente', {
        description: 'Los cambios se aplicaron exitosamente',
      })
    } else {
      toast.error(result.error || 'Error al guardar las configuraciones')
    }
  }

  const handleReset = () => {
    if (!hasChanges) return
    resetSettings()
    toast.info('Cambios descartados')
  }

  const handleResetDefaults = () => {
    resetToDefaults()
    toast.info('Se cargaron los valores por defecto')
  }

  const handleNumberChange = (
    key: 'taxRate' | 'sessionTimeout' | 'lowStockThreshold' | 'passwordMinLength' | 'maxLoginAttempts',
    rawValue: string,
    fallback: number,
    min: number,
    max?: number
  ) => {
    const parsed = Number(rawValue)
    if (Number.isNaN(parsed)) {
      updateSetting(key, fallback)
      return
    }

    let value = parsed
    if (value < min) value = min
    if (typeof max === 'number' && value > max) value = max
    updateSetting(key, value)
  }

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Configuracion</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Personaliza tu sistema segun tus necesidades</p>
                </div>
              </div>
            </div>

            {hasChanges && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 w-fit">
                <AlertCircle className="h-3 w-3" />
                {changedFields} cambio{changedFields !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="border-blue-100 dark:border-blue-900">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Cambios pendientes</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{changedFields}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-100 dark:border-purple-900">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Umbral stock</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{settings.lowStockThreshold}</p>
            </CardContent>
          </Card>
          <Card className="border-green-100 dark:border-green-900">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Notificaciones activas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{enabledNotifications}</p>
            </CardContent>
          </Card>
          <Card className="border-red-100 dark:border-red-900">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Controles seguridad</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{enabledSecurityControls}</p>
            </CardContent>
          </Card>
        </div>

        {hasChanges && (
          <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
            <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">Cambios sin guardar</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Tienes modificaciones pendientes</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Descartar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetDefaults}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Defaults
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {isLoading ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <TabsTrigger
                value="general"
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all',
                  'data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md'
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">General</span>
              </TabsTrigger>

              <TabsTrigger
                value="inventory"
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all',
                  'data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md'
                )}
              >
                <Package className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">Inventario</span>
              </TabsTrigger>

              <TabsTrigger
                value="notifications"
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all',
                  'data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md'
                )}
              >
                <Bell className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">Notificaciones</span>
              </TabsTrigger>

              <TabsTrigger
                value="security"
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all',
                  'data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md'
                )}
              >
                <Shield className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">Seguridad</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="space-y-4 sm:space-y-6">
            <Card className="border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
                <CardTitle className="text-xl">Informacion de la Empresa</CardTitle>
                <CardDescription>Configuracion basica de tu negocio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nombre de la Empresa <span className="text-red-500">*</span></Label>
                    <Input id="companyName" value={settings.companyName} onChange={(e) => updateSetting('companyName', e.target.value)} placeholder="Mi Empresa" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyRuc">RUC / Tax ID</Label>
                    <Input id="companyRuc" value={settings.companyRuc} onChange={(e) => updateSetting('companyRuc', e.target.value)} placeholder="80012345-6" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyEmail" className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />Email de Contacto</Label>
                    <Input id="companyEmail" type="email" value={settings.companyEmail} onChange={(e) => updateSetting('companyEmail', e.target.value)} placeholder="info@empresa.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyPhone" className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />Telefono</Label>
                    <Input id="companyPhone" value={settings.companyPhone} onChange={(e) => updateSetting('companyPhone', e.target.value)} placeholder="+595 21 123-4567" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city" className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Ciudad</Label>
                    <Input id="city" value={settings.city} onChange={(e) => updateSetting('city', e.target.value)} placeholder="Asuncion" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda</Label>
                    <Select value={settings.currency} onValueChange={(value) => updateSetting('currency', value)}>
                      <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PYG">PYG - Guarani Paraguayo</SelectItem>
                        <SelectItem value="USD">USD - Dolar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                        <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxRate" className="flex items-center gap-2">Tasa de Impuesto (%)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent><p>Se aplicara a todas las ventas por defecto</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input id="taxRate" type="number" min="0" max="100" value={settings.taxRate} onChange={(e) => handleNumberChange('taxRate', e.target.value, 10, 0, 100)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Tiempo de Sesion (minutos)</Label>
                    <Input id="sessionTimeout" type="number" min="5" max="480" value={settings.sessionTimeout} onChange={(e) => handleNumberChange('sessionTimeout', e.target.value, 60, 5, 480)} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="companyAddress" className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Direccion Fisica</Label>
                  <Textarea id="companyAddress" value={settings.companyAddress} onChange={(e) => updateSetting('companyAddress', e.target.value)} rows={3} className="resize-none" placeholder="Av. Principal 1234, Ciudad, Pais" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
                <CardTitle className="text-xl">Apariencia</CardTitle>
                <CardDescription>Personaliza como se ve tu sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Tema</Label>
                    <Select value={settings.theme} onValueChange={(value) => updateSetting('theme', value)}>
                      <SelectTrigger id="theme"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Oscuro</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colorScheme">Esquema de Color</Label>
                    <Select value={settings.colorScheme} onValueChange={(value) => updateSetting('colorScheme', value)}>
                      <SelectTrigger id="colorScheme"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">Azul</SelectItem>
                        <SelectItem value="green">Verde</SelectItem>
                        <SelectItem value="purple">Purpura</SelectItem>
                        <SelectItem value="orange">Naranja</SelectItem>
                        <SelectItem value="red">Rojo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            <Card className="border-purple-100 dark:border-purple-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950">
                <CardTitle className="text-xl">Gestion de Inventario</CardTitle>
                <CardDescription>Configuracion de stock y productos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Umbral de Stock Bajo</Label>
                  <Input id="lowStockThreshold" type="number" min="1" value={settings.lowStockThreshold} onChange={(e) => handleNumberChange('lowStockThreshold', e.target.value, 10, 1)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireSupplier">Requerir Proveedor</Label>
                    <p className="text-sm text-muted-foreground">Obligar a asignar proveedor al crear producto</p>
                  </div>
                  <Switch id="requireSupplier" checked={settings.requireSupplier} onCheckedChange={(checked) => updateSetting('requireSupplier', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoGenerateSKU">Generar SKU Automatico</Label>
                    <p className="text-sm text-muted-foreground">Crear SKU automaticamente para nuevos productos</p>
                  </div>
                  <Switch id="autoGenerateSKU" checked={settings.autoGenerateSKU} onCheckedChange={(checked) => updateSetting('autoGenerateSKU', checked)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 sm:space-y-6">
            <Card className="border-green-100 dark:border-green-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-950">
                <CardTitle className="text-xl">Preferencias de Notificaciones</CardTitle>
                <CardDescription>Configura como y cuando recibir alertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications">Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">Recibir notificaciones importantes por correo</p>
                  </div>
                  <Switch id="emailNotifications" checked={settings.emailNotifications} onCheckedChange={(checked) => updateSetting('emailNotifications', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="smsNotifications">Notificaciones por SMS</Label>
                    <p className="text-sm text-muted-foreground">Recibir alertas criticas por mensaje</p>
                  </div>
                  <Switch id="smsNotifications" checked={settings.smsNotifications} onCheckedChange={(checked) => updateSetting('smsNotifications', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="lowStockAlerts">Alertas de Stock Bajo</Label>
                    <p className="text-sm text-muted-foreground">Notificar cuando haya stock bajo</p>
                  </div>
                  <Switch id="lowStockAlerts" checked={settings.lowStockAlerts} onCheckedChange={(checked) => updateSetting('lowStockAlerts', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="salesAlerts">Alertas de Ventas Importantes</Label>
                    <p className="text-sm text-muted-foreground">Notificar ventas mayores a un monto especifico</p>
                  </div>
                  <Switch id="salesAlerts" checked={settings.salesAlerts} onCheckedChange={(checked) => updateSetting('salesAlerts', checked)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 sm:space-y-6">
            <Card className="border-red-100 dark:border-red-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-transparent dark:from-red-950">
                <CardTitle className="text-xl">Seguridad y Acceso</CardTitle>
                <CardDescription>Configuracion de autenticacion y contrasenas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="passwordMinLength">Longitud Minima de Contrasena</Label>
                  <Input id="passwordMinLength" type="number" min="6" max="32" value={settings.passwordMinLength} onChange={(e) => handleNumberChange('passwordMinLength', e.target.value, 8, 6, 32)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireSpecialChars">Requerir Caracteres Especiales</Label>
                    <p className="text-sm text-muted-foreground">Las contrasenas deben incluir caracteres especiales</p>
                  </div>
                  <Switch id="requireSpecialChars" checked={settings.requireSpecialChars} onCheckedChange={(checked) => updateSetting('requireSpecialChars', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="twoFactorAuth">Autenticacion de Dos Factores</Label>
                    <p className="text-sm text-muted-foreground">Requerir codigo adicional al iniciar sesion</p>
                  </div>
                  <Switch id="twoFactorAuth" checked={settings.twoFactorAuth} onCheckedChange={(checked) => updateSetting('twoFactorAuth', checked)} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Intentos Maximos de Inicio de Sesion</Label>
                  <Input id="maxLoginAttempts" type="number" min="1" max="20" value={settings.maxLoginAttempts} onChange={(e) => handleNumberChange('maxLoginAttempts', e.target.value, 5, 1, 20)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenanceMode">Modo Mantenimiento</Label>
                    <p className="text-sm text-muted-foreground">Restringe temporalmente acceso al sistema</p>
                  </div>
                  <Switch id="maintenanceMode" checked={settings.maintenanceMode} onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableBackups" className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      Backups Automaticos
                    </Label>
                    <p className="text-sm text-muted-foreground">Respaldo periodico de informacion critica</p>
                  </div>
                  <Switch id="enableBackups" checked={settings.enableBackups} onCheckedChange={(checked) => updateSetting('enableBackups', checked)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backupFrequency">Frecuencia de Backup</Label>
                  <Select value={settings.backupFrequency} onValueChange={(value) => updateSetting('backupFrequency', value)} disabled={!settings.enableBackups}>
                    <SelectTrigger id="backupFrequency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Cada hora</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <Button variant="outline" onClick={handleReset} disabled={isLoading} className="shadow-lg">
            <RotateCcw className="h-4 w-4 mr-2" />
            Descartar
          </Button>
          <Button variant="outline" onClick={handleResetDefaults} disabled={isLoading} className="shadow-lg">
            <RefreshCw className="h-4 w-4 mr-2" />
            Defaults
          </Button>
          <Button onClick={handleSave} disabled={isLoading} size="lg" className="shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </div>
      )}
    </div>
  )
}
