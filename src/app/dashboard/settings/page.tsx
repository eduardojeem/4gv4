'use client'

import { useState } from 'react'
import { Settings, Save, RotateCcw, AlertCircle, HelpCircle, Mail, Phone, MapPin } from 'lucide-react'
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
    hasChanges,
    isLoading,
    updateSetting,
    saveSettings,
    resetSettings
  } = useSharedSettings()

  const [activeTab, setActiveTab] = useState('general')

  // Contar cambios
  const changedFields = Object.keys(settings).filter(
    key => settings[key as keyof typeof settings] !== settings[key as keyof typeof settings]
  ).length

  // Guardar configuraciones
  const handleSave = async () => {
    const result = await saveSettings()
    
    if (result.success) {
      toast.success('Configuraciones guardadas correctamente', {
        description: 'Los cambios se han aplicado exitosamente'
      })
    } else {
      toast.error(result.error || 'Error al guardar las configuraciones')
    }
  }

  // Resetear configuraciones
  const handleReset = () => {
    resetSettings()
    toast.info('Cambios descartados')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Mejorado */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    Configuración
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Personaliza tu sistema según tus necesidades
                  </p>
                </div>
              </div>
            </div>

            {hasChanges && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  <AlertCircle className="h-3 w-3" />
                  {changedFields} cambio{changedFields !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Barra de cambios flotante mejorada */}
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
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        Cambios sin guardar
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Tienes modificaciones pendientes
                      </p>
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

        {/* Tabs Mejorados - Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* TabsList con colores */}
          <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <TabsTrigger 
                value="general"
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                  "data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">General</span>
                <span className="sm:hidden text-xs font-medium">General</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="inventory"
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                  "data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                )}
              >
                <span className="text-lg">📦</span>
                <span className="hidden sm:inline text-sm font-medium">Inventario</span>
                <span className="sm:hidden text-xs font-medium">Inventario</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="notifications"
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                  "data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                )}
              >
                <span className="text-lg">🔔</span>
                <span className="hidden sm:inline text-sm font-medium">Notificaciones</span>
                <span className="sm:hidden text-xs font-medium">Notif.</span>
              </TabsTrigger>
              
              <TabsTrigger 
                value="security"
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                  "data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md"
                )}
              >
                <span className="text-lg">🛡️</span>
                <span className="hidden sm:inline text-sm font-medium">Seguridad</span>
                <span className="sm:hidden text-xs font-medium">Seguridad</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: General */}
          <TabsContent value="general" className="space-y-4 sm:space-y-6">
            <Card className="border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <span className="text-lg text-white">🏢</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Información de la Empresa</CardTitle>
                    <CardDescription>Configuración básica de tu negocio</CardDescription>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">
                    Nombre de la Empresa
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => updateSetting('companyName', e.target.value)}
                    placeholder="Mi Empresa"
                  />
                  <p className="text-sm text-muted-foreground">
                    Aparecerá en reportes y documentos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email de Contacto
                  </Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => updateSetting('companyEmail', e.target.value)}
                    placeholder="info@empresa.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email principal de la empresa
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyPhone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Teléfono
                  </Label>
                  <Input
                    id="companyPhone"
                    value={settings.companyPhone}
                    onChange={(e) => updateSetting('companyPhone', e.target.value)}
                    placeholder="+595 21 123-4567"
                  />
                  <p className="text-sm text-muted-foreground">
                    Teléfono de contacto principal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Ciudad
                  </Label>
                  <Input
                    id="city"
                    value={settings.city}
                    onChange={(e) => updateSetting('city', e.target.value)}
                    placeholder="Asunción"
                  />
                  <p className="text-sm text-muted-foreground">
                    Ciudad donde se encuentra la empresa
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => updateSetting('currency', value)}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PYG">PYG - Guaraní Paraguayo</SelectItem>
                      <SelectItem value="USD">USD - Dólar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                      <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate" className="flex items-center gap-2">
                    Tasa de Impuesto (%)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Se aplicará a todas las ventas por defecto</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.taxRate}
                    onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Tiempo de Sesión (minutos)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={settings.sessionTimeout}
                    onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 60)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Cerrar sesión automáticamente después de inactividad
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="companyAddress" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Dirección Física
                </Label>
                <Textarea
                  id="companyAddress"
                  value={settings.companyAddress}
                  onChange={(e) => updateSetting('companyAddress', e.target.value)}
                  rows={3}
                  className="resize-none"
                  placeholder="Av. Principal 1234, Ciudad, País"
                />
                <p className="text-sm text-muted-foreground">
                  Dirección completa de la empresa
                </p>
              </div>
            </CardContent>
          </Card>

            <Card className="border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <span className="text-lg text-white">🎨</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Apariencia</CardTitle>
                    <CardDescription>Personaliza cómo se ve tu sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Tema</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value) => updateSetting('theme', value)}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colorScheme">Esquema de Color</Label>
                  <Select
                    value={settings.colorScheme}
                    onValueChange={(value) => updateSetting('colorScheme', value)}
                  >
                    <SelectTrigger id="colorScheme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Azul</SelectItem>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="purple">Púrpura</SelectItem>
                      <SelectItem value="orange">Naranja</SelectItem>
                      <SelectItem value="red">Rojo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          {/* Tab: Inventario */}
          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            <Card className="border-purple-100 dark:border-purple-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <span className="text-lg text-white">📦</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Gestión de Inventario</CardTitle>
                    <CardDescription>Configuración de stock y productos</CardDescription>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Umbral de Stock Bajo</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="1"
                  value={settings.lowStockThreshold}
                  onChange={(e) => updateSetting('lowStockThreshold', parseInt(e.target.value) || 10)}
                />
                <p className="text-sm text-muted-foreground">
                  Cantidad mínima antes de alertar stock bajo
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireSupplier">Requerir Proveedor</Label>
                  <p className="text-sm text-muted-foreground">
                    Obligar a asignar proveedor al crear producto
                  </p>
                </div>
                <Switch
                  id="requireSupplier"
                  checked={settings.requireSupplier}
                  onCheckedChange={(checked) => updateSetting('requireSupplier', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoGenerateSKU">Generar SKU Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Crear código SKU automáticamente para nuevos productos
                  </p>
                </div>
                <Switch
                  id="autoGenerateSKU"
                  checked={settings.autoGenerateSKU}
                  onCheckedChange={(checked) => updateSetting('autoGenerateSKU', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          {/* Tab: Notificaciones */}
          <TabsContent value="notifications" className="space-y-4 sm:space-y-6">
            <Card className="border-green-100 dark:border-green-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <span className="text-lg text-white">🔔</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Preferencias de Notificaciones</CardTitle>
                    <CardDescription>Configura cómo y cuándo recibir alertas</CardDescription>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Notificaciones por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones importantes por correo
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="smsNotifications">Notificaciones por SMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir alertas críticas por mensaje de texto
                  </p>
                </div>
                <Switch
                  id="smsNotifications"
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => updateSetting('smsNotifications', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="lowStockAlerts">Alertas de Stock Bajo</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar cuando productos tengan stock bajo
                  </p>
                </div>
                <Switch
                  id="lowStockAlerts"
                  checked={settings.lowStockAlerts}
                  onCheckedChange={(checked) => updateSetting('lowStockAlerts', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="salesAlerts">Alertas de Ventas Importantes</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar ventas mayores a un monto específico
                  </p>
                </div>
                <Switch
                  id="salesAlerts"
                  checked={settings.salesAlerts}
                  onCheckedChange={(checked) => updateSetting('salesAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          {/* Tab: Seguridad */}
          <TabsContent value="security" className="space-y-4 sm:space-y-6">
            <Card className="border-red-100 dark:border-red-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-red-50 to-transparent dark:from-red-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <span className="text-lg text-white">🛡️</span>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Seguridad y Acceso</CardTitle>
                    <CardDescription>Configuración de autenticación y contraseñas</CardDescription>
                  </div>
                </div>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">Longitud Mínima de Contraseña</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  min="6"
                  max="32"
                  value={settings.passwordMinLength}
                  onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value) || 8)}
                />
                <p className="text-sm text-muted-foreground">
                  Número mínimo de caracteres para contraseñas
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireSpecialChars">Requerir Caracteres Especiales</Label>
                  <p className="text-sm text-muted-foreground">
                    Las contraseñas deben incluir caracteres especiales (!@#$%)
                  </p>
                </div>
                <Switch
                  id="requireSpecialChars"
                  checked={settings.requireSpecialChars}
                  onCheckedChange={(checked) => updateSetting('requireSpecialChars', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="twoFactorAuth">Autenticación de Dos Factores</Label>
                  <p className="text-sm text-muted-foreground">
                    Requerir código adicional al iniciar sesión
                  </p>
                </div>
                <Switch
                  id="twoFactorAuth"
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => updateSetting('twoFactorAuth', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>

      {/* Botón flotante de guardar mejorado */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading}
            className="shadow-lg border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Descartar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            size="lg"
            className="shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
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
