'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Settings, Save, RotateCcw, AlertCircle, HelpCircle, Mail, Phone, MapPin,
  Loader2, Globe, Clock, Calendar, Package, Bell, Shield, Palette, Building2
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
import { cn } from '@/lib/utils'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'

const EDITABLE_COLOR_SCHEMES = ['blue', 'green', 'purple', 'orange', 'red'] as const

export default function SettingsPage() {
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
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme()

  const [activeTab, setActiveTab] = useState('general')
  const canManageSettings = isAdmin || isSuperAdmin
  const canRenderFallback = settingsSource === 'cache'

  const changedFields = useMemo(() => {
    return Object.keys(settings).reduce((count, key) => {
      const typedKey = key as keyof typeof settings
      return JSON.stringify(settings[typedKey]) === JSON.stringify(originalSettings[typedKey])
        ? count
        : count + 1
    }, 0)
  }, [settings, originalSettings])

  useEffect(() => {
    if (isLoading) return
    if (theme !== settings.theme) {
      setTheme(settings.theme as 'light' | 'dark' | 'system')
    }
    if (
      EDITABLE_COLOR_SCHEMES.includes(settings.primaryColor as typeof EDITABLE_COLOR_SCHEMES[number]) &&
      colorScheme !== settings.primaryColor
    ) {
      setColorScheme(settings.primaryColor as 'blue' | 'green' | 'purple' | 'orange' | 'red')
    }
  }, [colorScheme, isLoading, setColorScheme, setTheme, settings.primaryColor, settings.theme, theme])

  // Loading states
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {authLoading ? 'Verificando permisos...' : 'Cargando configuración...'}
          </p>
        </div>
      </div>
    )
  }

  if (!canManageSettings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md border border-amber-200 dark:border-amber-800">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Acceso restringido</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Solo administradores pueden modificar la configuración del sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !canRenderFallback) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Error al cargar</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{error}</p>
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
      toast.success('Configuración guardada correctamente')
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleReset = () => {
    resetSettings()
    toast.info('Cambios descartados')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 dark:bg-blue-500 rounded-xl shadow-sm">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
              Configuración
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ajustes generales del sistema
            </p>
          </div>
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
        <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-1.5">
          <TabsList className="grid w-full grid-cols-4 gap-1 bg-transparent h-auto p-0">
            {[
              { value: 'general', icon: Settings, label: 'General' },
              { value: 'inventory', icon: Package, label: 'Inventario' },
              { value: 'notifications', icon: Bell, label: 'Alertas' },
              { value: 'security', icon: Shield, label: 'Seguridad' },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── General Tab ── */}
        <TabsContent value="general" className="space-y-5 mt-0">
          {/* Regional */}
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Configuración Regional
              </CardTitle>
              <CardDescription>Formatos de fecha, hora e idioma</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                    <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeZone">Zona Horaria</Label>
                  <Select value={settings.timeZone} onValueChange={(v) => updateSetting('timeZone', v)}>
                    <SelectTrigger id="timeZone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Asuncion">Asunción (GMT-4)</SelectItem>
                      <SelectItem value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                      <SelectItem value="America/Montevideo">Montevideo (GMT-3)</SelectItem>
                      <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Formato de Fecha</Label>
                  <Select value={settings.dateFormat} onValueChange={(v) => updateSetting('dateFormat', v)}>
                    <SelectTrigger id="dateFormat"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="itemsPerPage">Registros por página</Label>
                  <Select value={String(settings.itemsPerPage)} onValueChange={(v) => updateSetting('itemsPerPage', parseInt(v))}>
                    <SelectTrigger id="itemsPerPage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company */}
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>Datos de tu negocio para tickets y documentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre <span className="text-red-500">*</span></Label>
                  <Input id="companyName" value={settings.companyName} onChange={(e) => updateSetting('companyName', e.target.value)} placeholder="Mi Empresa" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRuc">RUC / Tax ID</Label>
                  <Input id="companyRuc" value={settings.companyRuc} onChange={(e) => updateSetting('companyRuc', e.target.value)} placeholder="80012345-6" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input id="companyEmail" type="email" value={settings.companyEmail} onChange={(e) => updateSetting('companyEmail', e.target.value)} placeholder="info@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Teléfono</Label>
                  <Input id="companyPhone" value={settings.companyPhone} onChange={(e) => updateSetting('companyPhone', e.target.value)} placeholder="+595 21 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input id="city" value={settings.city} onChange={(e) => updateSetting('city', e.target.value)} placeholder="Asunción" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={settings.currency} onValueChange={(v) => updateSetting('currency', v)}>
                    <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PYG">PYG - Guaraní</SelectItem>
                      <SelectItem value="USD">USD - Dólar</SelectItem>
                      <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate" className="flex items-center gap-1.5">
                    Impuesto (%)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                        <TooltipContent><p>Se aplica a todas las ventas por defecto</p></TooltipContent>
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
                <Textarea id="companyAddress" value={settings.companyAddress} onChange={(e) => updateSetting('companyAddress', e.target.value)} rows={2} className="resize-none" placeholder="Av. Principal 1234, Ciudad" />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-blue-500" />
                Apariencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Tema</Label>
                  <Select value={settings.theme} onValueChange={(v) => updateSetting('theme', v)}>
                    <SelectTrigger id="theme"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Color primario</Label>
                  <Select value={settings.primaryColor} onValueChange={(v) => updateSetting('primaryColor', v)}>
                    <SelectTrigger id="primaryColor"><SelectValue /></SelectTrigger>
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

        {/* ── Inventory Tab ── */}
        <TabsContent value="inventory" className="space-y-5 mt-0">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-violet-500" />
                Gestión de Inventario
              </CardTitle>
              <CardDescription>Configuración de stock y alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Umbral de stock bajo</Label>
                <Input id="lowStockThreshold" type="number" min="1" value={settings.lowStockThreshold} onChange={(e) => updateSetting('lowStockThreshold', parseInt(e.target.value) || 10)} />
                <p className="text-xs text-gray-400">Cantidad mínima antes de alertar stock bajo</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoBackup" className="text-sm font-medium">Respaldo automático</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Crear respaldos automáticos del sistema</p>
                </div>
                <Switch id="autoBackup" checked={settings.autoBackup} onCheckedChange={(v) => updateSetting('autoBackup', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ── */}
        <TabsContent value="notifications" className="space-y-5 mt-0">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-500" />
                Notificaciones
              </CardTitle>
              <CardDescription>Configura cómo y cuándo recibir alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div>
                  <Label className="text-sm font-medium">Notificaciones por Email</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Recibir notificaciones importantes por correo</p>
                </div>
                <Switch checked={settings.emailNotifications} onCheckedChange={(v) => updateSetting('emailNotifications', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div>
                  <Label className="text-sm font-medium">Notificaciones por SMS</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Recibir alertas críticas por mensaje de texto</p>
                </div>
                <Switch checked={settings.smsNotifications} onCheckedChange={(v) => updateSetting('smsNotifications', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="space-y-5 mt-0">
          <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                Seguridad y Acceso
              </CardTitle>
              <CardDescription>Autenticación y políticas de contraseñas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passwordMinLength">Longitud mínima de contraseña</Label>
                <Input id="passwordMinLength" type="number" min="6" max="32" value={settings.passwordMinLength} onChange={(e) => updateSetting('passwordMinLength', parseInt(e.target.value) || 8)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div>
                  <Label className="text-sm font-medium">Permitir registro</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Nuevos usuarios pueden crear cuenta</p>
                </div>
                <Switch checked={settings.allowRegistration} onCheckedChange={(v) => updateSetting('allowRegistration', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div>
                  <Label className="text-sm font-medium">Verificación de email</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Requerir verificación al registrarse</p>
                </div>
                <Switch checked={settings.requireEmailVerification} onCheckedChange={(v) => updateSetting('requireEmailVerification', v)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800">
                <div>
                  <Label className="text-sm font-medium">Autenticación de dos factores</Label>
                  <p className="text-xs text-gray-400 mt-0.5">Código adicional al iniciar sesión</p>
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
