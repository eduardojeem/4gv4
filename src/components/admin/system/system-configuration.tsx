'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Building, 
  Mail, 
  Shield, 
  Database, 
  Bell,
  Save,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Lock
} from 'lucide-react'
import { SystemSettings } from '@/hooks/use-admin-dashboard'

interface SystemConfigurationProps {
  settings: SystemSettings
  onUpdateSettings: (settings: Partial<SystemSettings>) => Promise<{ success: boolean; error?: string }>
  onPerformAction: (action: string) => Promise<{ success: boolean; message?: string; error?: string }>
  isLoading: boolean
}

export function SystemConfiguration({ 
  settings, 
  onUpdateSettings, 
  onPerformAction, 
  isLoading 
}: SystemConfigurationProps) {
  const [formData, setFormData] = useState<SystemSettings>(settings)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('company')
  const [errors, setErrors] = useState<Partial<Record<keyof SystemSettings, string>>>({})
  const [settingsSearch, setSettingsSearch] = useState('')
  const [settingsSearchDebounced, setSettingsSearchDebounced] = useState('')

  const isChanged = (field: keyof SystemSettings) => {
    return formData[field] !== settings[field]
  }

  const validateField = (field: keyof SystemSettings, value: any): string | undefined => {
    switch (field) {
      case 'companyName':
        if (!value || String(value).trim().length === 0) return 'El nombre es obligatorio'
        return undefined
      case 'companyEmail':
        if (!value) return 'El email es obligatorio'
        if (!/^\S+@\S+\.\S+$/.test(String(value))) return 'Formato de email inválido'
        return undefined
      case 'companyPhone':
        if (!value || String(value).trim().length === 0) return 'El teléfono es obligatorio'
        return undefined
      case 'currency':
        if (!value) return 'Seleccione una moneda'
        return undefined
      case 'taxRate':
        if (value === '' || value === null || isNaN(Number(value))) return 'Ingrese un número válido'
        if (value < 0 || value > 100) return 'Debe estar entre 0 y 100'
        return undefined
      case 'lowStockThreshold':
        if (value === '' || value === null || isNaN(Number(value))) return 'Ingrese un número válido'
        if (value < 1) return 'Debe ser al menos 1'
        return undefined
      case 'sessionTimeout':
        if (value === '' || value === null || isNaN(Number(value))) return 'Ingrese un número válido'
        if (value < 5 || value > 480) return 'Entre 5 y 480 minutos'
        return undefined
      case 'maxLoginAttempts':
        if (value === '' || value === null || isNaN(Number(value))) return 'Ingrese un número válido'
        if (value < 1 || value > 10) return 'Entre 1 y 10'
        return undefined
      case 'passwordMinLength':
        if (value === '' || value === null || isNaN(Number(value))) return 'Ingrese un número válido'
        if (value < 6 || value > 32) return 'Entre 6 y 32'
        return undefined
      default:
        return undefined
    }
  }

  const matchesSearch = useMemo(() => {
    const q = settingsSearchDebounced.trim().toLowerCase()
    return (text: string) => {
      if (!q) return false
      return text.toLowerCase().includes(q)
    }
  }, [settingsSearchDebounced])

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    const err = validateField(field, value)
    setErrors(prev => {
      const next = { ...prev }
      if (err) next[field] = err
      else delete next[field]
      return next
    })
  }

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) return
    const result = await onUpdateSettings(formData)
    if (result.success) {
      setHasChanges(false)
    }
  }

  const handleReset = () => {
    setFormData(settings)
    setHasChanges(false)
  }

  const sectionFields: Record<string, (keyof SystemSettings)[]> = {
    company: ['companyName', 'companyEmail', 'companyPhone', 'companyAddress', 'currency'],
    general: ['taxRate', 'lowStockThreshold', 'sessionTimeout', 'autoBackup', 'maintenanceMode'],
    security: ['maxLoginAttempts', 'passwordMinLength', 'allowRegistration', 'requireEmailVerification', 'requireTwoFactor'],
    notifications: ['emailNotifications', 'smsNotifications'],
    system: []
  }

  const validateSection = (section: keyof typeof sectionFields) => {
    const fields = sectionFields[section]
    const nextErrors: Partial<Record<keyof SystemSettings, string>> = {}
    fields.forEach(f => {
      const err = validateField(f, formData[f])
      if (err) nextErrors[f] = err
    })
    setErrors(prev => ({ ...prev, ...nextErrors }))
    return Object.keys(nextErrors).length === 0
  }

  const handleSaveSection = async (section: keyof typeof sectionFields) => {
    const ok = validateSection(section)
    if (!ok) return
    const fields = sectionFields[section]
    const partial: Partial<SystemSettings> = {}
    fields.forEach(f => { (partial as any)[f] = formData[f] })
    const result = await onUpdateSettings(partial)
    if (result.success) {
      setHasChanges(false)
    }
  }

  const handleSystemAction = async (action: string) => {
    const labels: Record<string, string> = {
      backup: 'Crear Backup',
      clearCache: 'Limpiar Caché',
      checkIntegrity: 'Verificar Integridad',
      testEmail: 'Probar Email'
    }
    const confirmed = window.confirm(`¿Confirmar acción: ${labels[action] || action}?`)
    if (!confirmed) return
    await onPerformAction(action)
  }

  const exportSettings = () => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string)
          setFormData({ ...formData, ...importedSettings })
          setHasChanges(true)
        } catch (error) {
          alert('Error al importar configuración: archivo inválido')
        }
      }
      reader.readAsText(file)
    }
  }

  // Debounce de búsqueda
  useEffect(() => {
    const id = setTimeout(() => setSettingsSearchDebounced(settingsSearch), 250)
    return () => clearTimeout(id)
  }, [settingsSearch])

  return (
    <div className="space-y-6">
      {/* Header simplificado */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-purple-700">
              <Settings className="h-6 w-6 mr-2 text-purple-700" />
              Configuración del Sistema
            </h2>
            <p className="text-purple-700 mt-1">Administra la configuración general del sistema</p>
            <div className="mt-3">
              <Input
                placeholder="Buscar configuración…"
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="max-w-md border-purple-200 focus-visible:ring-purple-400"
              />
            </div>
          </div>
        
        <div className="flex space-x-2">
          {Object.keys(errors).length > 0 && (
            <Badge variant="destructive" className="self-center">
              {Object.keys(errors).length} errores
            </Badge>
          )}
          <Button 
            variant="outline" 
            onClick={exportSettings}
            className="border-purple-300 text-purple-600 hover:bg-purple-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <label className="cursor-pointer">
            <Button 
              variant="outline" 
              asChild
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={importSettings}
              className="hidden"
            />
          </label>
          {hasChanges && (
            <>
              <Button 
                variant="outline" 
                onClick={handleReset}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Descartar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isLoading || Object.keys(errors).length > 0}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Guardando...' : (Object.keys(errors).length > 0 ? 'Corregir errores' : 'Guardar')}
              </Button>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Estado de Cambios */}
      {hasChanges && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="text-orange-800 font-medium">
                Tienes cambios sin guardar
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs con colores */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 bg-gradient-to-r from-purple-100 to-indigo-100 p-1">
          <TabsTrigger 
            value="company" 
            className="flex items-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-300"
          >
            Empresa
          </TabsTrigger>
          <TabsTrigger 
            value="general" 
            className="flex items-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white transition-all duration-300"
          >
            General
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="flex items-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white transition-all duration-300"
          >
            Seguridad
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="flex items-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all duration-300"
          >
            Notificaciones
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="flex items-center data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white transition-all duration-300"
          >
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* Configuración de Empresa */}
        <TabsContent value="company" className="space-y-6">
          <Card className="border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
              <CardTitle className="flex items-center justify-between text-blue-800">
                <span>Información de la Empresa</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setFormData({...formData, companyName: settings.companyName, companyEmail: settings.companyEmail, companyPhone: settings.companyPhone, currency: settings.currency, companyAddress: settings.companyAddress})} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                    Resetear
                  </Button>
                  <Button size="sm" onClick={() => handleSaveSection('company')} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Guardar sección
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`space-y-2 ${matchesSearch('Nombre de la Empresa companyName') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="companyName">Nombre de la Empresa {isChanged('companyName') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    aria-invalid={!!errors.companyName}
                  />
                  {errors.companyName && (<p className="text-sm text-red-600">{errors.companyName}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Email de la Empresa companyEmail') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="companyEmail">Email de la Empresa {isChanged('companyEmail') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                    aria-invalid={!!errors.companyEmail}
                  />
                  {errors.companyEmail && (<p className="text-sm text-red-600">{errors.companyEmail}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Teléfono companyPhone telefono') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="companyPhone">Teléfono {isChanged('companyPhone') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="companyPhone"
                    value={formData.companyPhone}
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                    aria-invalid={!!errors.companyPhone}
                  />
                  {errors.companyPhone && (<p className="text-sm text-red-600">{errors.companyPhone}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Moneda currency') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="currency">Moneda {isChanged('currency') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Select 
                    value={formData.currency} 
                    onValueChange={(value) => handleInputChange('currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PYG">Guaraní (PYG)</SelectItem>
                      <SelectItem value="USD">Dólar (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className={`space-y-2 ${matchesSearch('Dirección address companyAddress') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                <Label htmlFor="companyAddress">Dirección {isChanged('companyAddress') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                <Textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración General */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
              <CardTitle className="flex items-center justify-between text-green-800">
                <span>Configuración Comercial</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setFormData({...formData, taxRate: settings.taxRate, lowStockThreshold: settings.lowStockThreshold, sessionTimeout: settings.sessionTimeout, autoBackup: settings.autoBackup, maintenanceMode: settings.maintenanceMode})} className="border-green-300 text-green-700 hover:bg-green-50">
                    Resetear
                  </Button>
                  <Button size="sm" onClick={() => handleSaveSection('general')} className="bg-green-600 hover:bg-green-700 text-white">
                    Guardar sección
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`space-y-2 ${matchesSearch('Tasa de Impuesto taxRate') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="taxRate">Tasa de Impuesto (%) {isChanged('taxRate') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.taxRate}
                    onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))}
                    aria-invalid={!!errors.taxRate}
                  />
                  {errors.taxRate && (<p className="text-sm text-red-600">{errors.taxRate}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Umbral de Stock Bajo lowStockThreshold') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="lowStockThreshold">Umbral de Stock Bajo {isChanged('lowStockThreshold') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="1"
                    value={formData.lowStockThreshold}
                    onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value))}
                    aria-invalid={!!errors.lowStockThreshold}
                  />
                  {errors.lowStockThreshold && (<p className="text-sm text-red-600">{errors.lowStockThreshold}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Tiempo de Sesión sessionTimeout') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="sessionTimeout">Tiempo de Sesión (minutos) {isChanged('sessionTimeout') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={formData.sessionTimeout}
                    onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value))}
                    aria-invalid={!!errors.sessionTimeout}
                  />
                  {errors.sessionTimeout && (<p className="text-sm text-red-600">{errors.sessionTimeout}</p>)}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Realizar copias de seguridad automáticas diariamente
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoBackup}
                    onCheckedChange={(checked) => handleInputChange('autoBackup', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Mantenimiento</Label>
                    <p className="text-sm text-muted-foreground">
                      Activar modo mantenimiento para el sistema
                    </p>
                  </div>
                  <Switch
                    checked={formData.maintenanceMode}
                    onCheckedChange={(checked) => handleInputChange('maintenanceMode', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Seguridad */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border-red-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
              <CardTitle className="flex items-center justify-between text-red-800">
                <span>Configuración de Seguridad</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setFormData({...formData, maxLoginAttempts: settings.maxLoginAttempts, passwordMinLength: settings.passwordMinLength, allowRegistration: settings.allowRegistration, requireEmailVerification: settings.requireEmailVerification, requireTwoFactor: settings.requireTwoFactor})} className="border-red-300 text-red-700 hover:bg-red-50">
                    Resetear
                  </Button>
                  <Button size="sm" onClick={() => handleSaveSection('security')} className="bg-red-600 hover:bg-red-700 text-white">
                    Guardar sección
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`space-y-2 ${matchesSearch('Máximo Intentos de Login maxLoginAttempts') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="maxLoginAttempts">Máximo Intentos de Login {isChanged('maxLoginAttempts') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.maxLoginAttempts}
                    onChange={(e) => handleInputChange('maxLoginAttempts', parseInt(e.target.value))}
                    aria-invalid={!!errors.maxLoginAttempts}
                  />
                  {errors.maxLoginAttempts && (<p className="text-sm text-red-600">{errors.maxLoginAttempts}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Longitud Mínima de Contraseña passwordMinLength') ? 'ring-1 ring-purple-300 rounded-md p-2' : ''}`}>
                  <Label htmlFor="passwordMinLength">Longitud Mínima de Contraseña {isChanged('passwordMinLength') && (<Badge className="ml-2" variant="secondary">Editado</Badge>)}</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    min="6"
                    max="32"
                    value={formData.passwordMinLength}
                    onChange={(e) => handleInputChange('passwordMinLength', parseInt(e.target.value))}
                    aria-invalid={!!errors.passwordMinLength}
                  />
                  {errors.passwordMinLength && (<p className="text-sm text-red-600">{errors.passwordMinLength}</p>)}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Permitir Registro</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que nuevos usuarios se registren
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowRegistration}
                    onCheckedChange={(checked) => handleInputChange('allowRegistration', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Verificación de Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Requerir verificación de email para nuevos usuarios
                    </p>
                  </div>
                  <Switch
                    checked={formData.requireEmailVerification}
                    onCheckedChange={(checked) => handleInputChange('requireEmailVerification', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Autenticación de Dos Factores</Label>
                    <p className="text-sm text-muted-foreground">
                      Requerir 2FA para todos los usuarios
                    </p>
                  </div>
                  <Switch
                    checked={formData.requireTwoFactor}
                    onCheckedChange={(checked) => handleInputChange('requireTwoFactor', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración de Notificaciones */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
              <CardTitle className="flex items-center text-yellow-800">
                <Mail className="h-5 w-5 mr-2 text-yellow-600" />
                Configuración de Notificaciones
              </CardTitle>
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => setFormData({...formData, emailNotifications: settings.emailNotifications, smsNotifications: settings.smsNotifications})} className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
                  Resetear pestaña
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificaciones importantes por email
                    </p>
                  </div>
                  <Switch
                    checked={formData.emailNotifications}
                    onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones por SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificaciones críticas por SMS
                    </p>
                  </div>
                  <Switch
                    checked={formData.smsNotifications}
                    onCheckedChange={(checked) => handleInputChange('smsNotifications', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acciones del Sistema */}
        <TabsContent value="system" className="space-y-6">
          <Card className="border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200">
              <CardTitle className="flex items-center text-purple-800">
                <Database className="h-5 w-5 mr-2 text-purple-600" />
                Acciones del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('backup')}
                  disabled={isLoading}
                  className="h-20 flex-col border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                >
                  <Database className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="text-blue-800">Crear Backup</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('clearCache')}
                  disabled={isLoading}
                  className="h-20 flex-col border-orange-300 hover:bg-orange-50 hover:border-orange-400 transition-all duration-300"
                >
                  <RotateCcw className="h-6 w-6 mb-2 text-orange-600" />
                  <span className="text-orange-800">Limpiar Caché</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('checkIntegrity')}
                  disabled={isLoading}
                  className="h-20 flex-col border-green-300 hover:bg-green-50 hover:border-green-400 transition-all duration-300"
                >
                  <CheckCircle className="h-6 w-6 mb-2 text-green-600" />
                  <span className="text-green-800">Verificar Integridad</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('testEmail')}
                  disabled={isLoading}
                  className="h-20 flex-col border-purple-300 hover:bg-purple-50 hover:border-purple-400 transition-all duration-300"
                >
                  <Mail className="h-6 w-6 mb-2 text-purple-600" />
                  <span className="text-purple-800">Probar Email</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
