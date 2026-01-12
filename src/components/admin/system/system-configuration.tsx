'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Lock,
  Globe,
  Server
} from 'lucide-react'
import { SystemSettings } from '@/hooks/use-admin-dashboard'
import { toast } from 'sonner'

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

  // Sincronizar estado cuando las props cambian (ej. al cargar)
  useEffect(() => {
    setFormData(settings)
  }, [settings])

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
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor corrija los errores antes de guardar')
      return
    }
    const result = await onUpdateSettings(formData)
    if (result.success) {
      setHasChanges(false)
      toast.success('Configuración guardada correctamente')
    } else {
      toast.error(result.error || 'Error al guardar configuración')
    }
  }

  const handleReset = () => {
    setFormData(settings)
    setHasChanges(false)
    setErrors({})
    toast.info('Cambios descartados')
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
    if (!ok) {
      toast.error('Corrija los errores en la sección')
      return
    }
    const fields = sectionFields[section]
    const partial: Partial<SystemSettings> = {}
    fields.forEach(f => { (partial as any)[f] = formData[f] })
    const result = await onUpdateSettings(partial)
    if (result.success) {
      setHasChanges(false) // Esto es simplificado, idealmente solo para los campos guardados
      toast.success('Sección guardada correctamente')
    } else {
      toast.error(result.error || 'Error al guardar sección')
    }
  }

  const handleSystemAction = async (action: string) => {
    const labels: Record<string, string> = {
      backup: 'Crear Backup',
      clearCache: 'Limpiar Caché',
      checkIntegrity: 'Verificar Integridad',
      testEmail: 'Probar Email'
    }
    
    if (confirm(`¿Está seguro de realizar la acción: ${labels[action] || action}?`)) {
       try {
         const result = await onPerformAction(action)
         if (result.success) {
           toast.success(result.message || 'Acción completada con éxito')
         } else {
           toast.error(result.error || 'Error al realizar acción')
         }
       } catch (e) {
         toast.error('Error inesperado')
       }
    }
  }

  const exportSettings = () => {
    try {
      const dataStr = JSON.stringify(formData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Configuración exportada')
    } catch (e) {
      toast.error('Error al exportar')
    }
  }

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string)
          setFormData(prev => ({ ...prev, ...importedSettings }))
          setHasChanges(true)
          toast.success('Configuración importada. Revise los cambios antes de guardar.')
        } catch (error) {
          toast.error('Error al importar: archivo inválido')
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center text-gray-900 dark:text-white">
              <Settings className="h-6 w-6 mr-3 text-purple-600 dark:text-purple-400" />
              Configuración del Sistema
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Administra la configuración general y preferencias</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
               <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
               <Input
                placeholder="Buscar opción…"
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="w-64 pl-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
            </div>

            <Button 
              variant="outline" 
              onClick={exportSettings}
              className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <label className="cursor-pointer">
              <Button 
                variant="outline" 
                asChild
                className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 pointer-events-none"
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
          </div>
        </div>
        
        {/* Barra de acciones flotante si hay cambios */}
        {hasChanges && (
           <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300">
               <AlertTriangle className="h-5 w-5" />
               <span className="font-medium">Tienes cambios sin guardar</span>
             </div>
             <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  onClick={handleReset}
                  className="text-purple-700 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Descartar
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isLoading || Object.keys(errors).length > 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
             </div>
           </div>
        )}
      </div>

      {/* Tabs con nuevo estilo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 w-full justify-start overflow-x-auto">
          {[
            { id: 'company', label: 'Empresa', icon: Building },
            { id: 'general', label: 'General', icon: Globe },
            { id: 'security', label: 'Seguridad', icon: Shield },
            { id: 'notifications', label: 'Notificaciones', icon: Bell },
            { id: 'system', label: 'Sistema', icon: Server },
          ].map((tab) => (
             <TabsTrigger 
              key={tab.id}
              value={tab.id} 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-purple-50 dark:data-[state=active]:bg-purple-900/20 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Configuración de Empresa */}
        <TabsContent value="company" className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Información de la Empresa</CardTitle>
              <CardDescription>Datos principales de la organización visibles en reportes y facturas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-2 ${matchesSearch('Nombre de la Empresa companyName') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="companyName">Nombre de la Empresa</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className={errors.companyName ? 'border-red-500' : ''}
                  />
                  {errors.companyName && (<p className="text-sm text-red-600">{errors.companyName}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Email de la Empresa companyEmail') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="companyEmail">Email de Contacto</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                    className={errors.companyEmail ? 'border-red-500' : ''}
                  />
                  {errors.companyEmail && (<p className="text-sm text-red-600">{errors.companyEmail}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Teléfono companyPhone telefono') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="companyPhone">Teléfono</Label>
                  <Input
                    id="companyPhone"
                    value={formData.companyPhone}
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                    className={errors.companyPhone ? 'border-red-500' : ''}
                  />
                  {errors.companyPhone && (<p className="text-sm text-red-600">{errors.companyPhone}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Moneda currency') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="currency">Moneda Principal</Label>
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
                      <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className={`space-y-2 ${matchesSearch('Dirección address companyAddress') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                <Label htmlFor="companyAddress">Dirección Física</Label>
                <Textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuración General */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>Parámetros operativos del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`space-y-2 ${matchesSearch('Tasa de Impuesto taxRate') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="taxRate">IVA / Impuesto (%)</Label>
                  <div className="relative">
                    <Input
                        id="taxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.taxRate}
                        onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))}
                        className={errors.taxRate ? 'border-red-500 pr-8' : 'pr-8'}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                  {errors.taxRate && (<p className="text-sm text-red-600">{errors.taxRate}</p>)}
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Umbral de Stock Bajo lowStockThreshold') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="lowStockThreshold">Alerta de Stock Bajo</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="1"
                    value={formData.lowStockThreshold}
                    onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value))}
                    className={errors.lowStockThreshold ? 'border-red-500' : ''}
                  />
                  <p className="text-xs text-muted-foreground">Cantidad mínima para alerta</p>
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Tiempo de Sesión sessionTimeout') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="sessionTimeout">Timeout de Sesión (min)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={formData.sessionTimeout}
                    onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value))}
                    className={errors.sessionTimeout ? 'border-red-500' : ''}
                  />
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Backup Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Realizar copias de seguridad diarias a las 00:00
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoBackup}
                    onCheckedChange={(checked) => handleInputChange('autoBackup', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Modo Mantenimiento</Label>
                    <p className="text-sm text-muted-foreground">
                      Restringe el acceso solo a administradores
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
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Seguridad y Acceso</CardTitle>
              <CardDescription>Políticas de seguridad para usuarios y sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`space-y-2 ${matchesSearch('Máximo Intentos de Login maxLoginAttempts') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="maxLoginAttempts">Intentos de Login Fallidos</Label>
                  <Select 
                    value={String(formData.maxLoginAttempts)} 
                    onValueChange={(value) => handleInputChange('maxLoginAttempts', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 intentos</SelectItem>
                      <SelectItem value="5">5 intentos</SelectItem>
                      <SelectItem value="10">10 intentos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Antes de bloquear la cuenta temporalmente</p>
                </div>
                
                <div className={`space-y-2 ${matchesSearch('Longitud Mínima de Contraseña passwordMinLength') ? 'bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded' : ''}`}>
                  <Label htmlFor="passwordMinLength">Longitud Mínima Password</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    min="6"
                    max="32"
                    value={formData.passwordMinLength}
                    onChange={(e) => handleInputChange('passwordMinLength', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                         <Label className="text-base">Registro de Usuarios</Label>
                         {formData.allowRegistration ? <Badge variant="default" className="bg-green-500">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Permitir que nuevos usuarios se registren desde el login
                    </p>
                  </div>
                  <Switch
                    checked={formData.allowRegistration}
                    onCheckedChange={(checked) => handleInputChange('allowRegistration', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                  <div className="space-y-0.5">
                    <Label className="text-base">Verificación de Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Requerir validación de correo antes del primer acceso
                    </p>
                  </div>
                  <Switch
                    checked={formData.requireEmailVerification}
                    onCheckedChange={(checked) => handleInputChange('requireEmailVerification', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                  <div className="space-y-0.5">
                     <div className="flex items-center gap-2">
                        <Label className="text-base">2FA (Dos Factores)</Label>
                        <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">Recomendado</Badge>
                     </div>
                    <p className="text-sm text-muted-foreground">
                      Forzar autenticación de dos factores para todos los roles
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
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Canales de Notificación</CardTitle>
              <CardDescription>Configura cómo el sistema se comunica con usuarios y clientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid gap-6">
                  <div className="flex items-start space-x-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                    <Mail className="h-6 w-6 text-blue-600 mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                         <Label className="text-base font-medium">Email</Label>
                         <Switch
                            checked={formData.emailNotifications}
                            onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                          />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enviar recibos, alertas de stock y reportes por correo electrónico.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div className="h-6 w-6 flex items-center justify-center mt-1">
                        <span className="text-lg">📱</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                         <Label className="text-base font-medium">SMS / WhatsApp</Label>
                         <Switch
                            checked={formData.smsNotifications}
                            onCheckedChange={(checked) => handleInputChange('smsNotifications', checked)}
                          />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enviar alertas críticas y confirmaciones de pedido a móviles.
                      </p>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acciones del Sistema */}
        <TabsContent value="system" className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-700 shadow-sm dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Mantenimiento del Sistema</CardTitle>
              <CardDescription>Herramientas avanzadas para administradores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('backup')}
                  disabled={isLoading}
                  className="h-auto py-6 flex-col gap-3 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
                >
                  <Database className="h-8 w-8 text-blue-500" />
                  <div className="text-center">
                    <span className="block font-medium">Crear Backup</span>
                    <span className="text-xs text-muted-foreground">Base de datos completa</span>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('clearCache')}
                  disabled={isLoading}
                  className="h-auto py-6 flex-col gap-3 hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-900/20"
                >
                  <RotateCcw className="h-8 w-8 text-orange-500" />
                  <div className="text-center">
                    <span className="block font-medium">Limpiar Caché</span>
                    <span className="text-xs text-muted-foreground">Archivos temporales</span>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('checkIntegrity')}
                  disabled={isLoading}
                  className="h-auto py-6 flex-col gap-3 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-900/20"
                >
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div className="text-center">
                    <span className="block font-medium">Verificar Integridad</span>
                    <span className="text-xs text-muted-foreground">Escanear errores</span>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleSystemAction('testEmail')}
                  disabled={isLoading}
                  className="h-auto py-6 flex-col gap-3 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-900/20"
                >
                  <Mail className="h-8 w-8 text-purple-500" />
                  <div className="text-center">
                    <span className="block font-medium">Probar Email</span>
                    <span className="text-xs text-muted-foreground">Enviar correo de prueba</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
