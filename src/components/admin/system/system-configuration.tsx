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
import { Separator } from '@/components/ui/separator'
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog'
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
  Server,
  Search,
  X,
  Info,
  TrendingUp,
  Zap,
  Eye,
  EyeOff,
  History,
  Palette,
  Layout,
  Calendar,
  Share2,
  ToggleLeft,
  Languages
} from 'lucide-react'
import { SystemSettings } from '@/hooks/use-admin-dashboard'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  const [isSaving, setIsSaving] = useState(false)
  
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog()

  useEffect(() => {
    setFormData(settings)
  }, [settings])

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

  const handleMaintenanceModeChange = async (checked: boolean) => {
    if (checked) {
      const result = await showConfirmation({
        title: '⚠️ Activar Modo Mantenimiento',
        description: 'Esta acción bloqueará el acceso al sistema para todos los usuarios excepto administradores. Los usuarios actuales serán desconectados. Esta es una acción crítica que debe usarse solo durante mantenimiento programado.',
        confirmText: 'Activar Modo Mantenimiento',
        cancelText: 'Cancelar',
        variant: 'destructive',
        requirePassword: true,
        requireConfirmText: 'MANTENIMIENTO'
      })

      if (!result.confirmed || !result.password) return

      const finalConfirm = await showConfirmation({
        title: '🚨 Última Confirmación',
        description: '¿Está completamente seguro? Esta acción afectará a todos los usuarios del sistema inmediatamente.',
        confirmText: 'Sí, activar ahora',
        cancelText: 'No, cancelar',
        variant: 'destructive'
      })

      if (!finalConfirm.confirmed) return

      handleInputChange('maintenanceMode', true)
      toast.warning('Modo mantenimiento activado', {
        description: 'Solo los administradores pueden acceder al sistema'
      })
    } else {
      const result = await showConfirmation({
        title: 'Desactivar Modo Mantenimiento',
        description: 'Esto permitirá que todos los usuarios vuelvan a acceder al sistema.',
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        variant: 'default'
      })

      if (result.confirmed) {
        handleInputChange('maintenanceMode', false)
        toast.success('Modo mantenimiento desactivado', {
          description: 'Los usuarios pueden acceder normalmente'
        })
      }
    }
  }

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor corrija los errores antes de guardar')
      return
    }
    
    setIsSaving(true)
    const result = await onUpdateSettings(formData)
    setIsSaving(false)
    
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

  const handleSystemAction = async (action: string) => {
    const labels: Record<string, string> = {
      backup: 'Crear Backup',
      clearCache: 'Limpiar Caché',
      checkIntegrity: 'Verificar Integridad',
      testEmail: 'Probar Email'
    }
    
    const result = await showConfirmation({
      title: `${labels[action] || action}`,
      description: `¿Está seguro de realizar esta acción?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar'
    })
    
    if (result.confirmed) {
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

  useEffect(() => {
    const id = setTimeout(() => setSettingsSearchDebounced(settingsSearch), 250)
    return () => clearTimeout(id)
  }, [settingsSearch])

  const tabsConfig = [
    { id: 'company', label: 'Empresa', icon: Building, color: 'blue' },
    { id: 'appearance', label: 'Apariencia', icon: Palette, color: 'pink' },
    { id: 'regional', label: 'Regional', icon: Globe, color: 'indigo' },
    { id: 'features', label: 'Funciones', icon: Layout, color: 'cyan' },
    { id: 'security', label: 'Seguridad', icon: Shield, color: 'red' },
    { id: 'notifications', label: 'Notificaciones', icon: Bell, color: 'green' },
    { id: 'system', label: 'Sistema', icon: Server, color: 'orange' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header Mejorado */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    Configuración del Sistema
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Administra la configuración general y preferencias
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportSettings}
                className="flex-1 sm:flex-none"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              
              <label className="flex-1 sm:flex-none cursor-pointer">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                  className="w-full pointer-events-none"
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Importar</span>
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

          {/* Barra de búsqueda móvil mejorada */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar configuración..."
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              className="pl-10 pr-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
            {settingsSearch && (
              <button
                onClick={() => setSettingsSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Barra de cambios flotante mejorada */}
        {hasChanges && (
          <div className="mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
            <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-purple-900 dark:text-purple-100">
                        Cambios sin guardar
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Tienes modificaciones pendientes
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleReset}
                      className="flex-1 sm:flex-none border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Descartar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSave} 
                      disabled={isSaving || Object.keys(errors).length > 0}
                      className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs Mejorados - Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* TabsList Horizontal en Desktop, Vertical en Móvil */}
          <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              {tabsConfig.map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all",
                    "data-[state=active]:bg-gradient-to-br data-[state=active]:shadow-md",
                    tab.color === 'blue' && "data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white",
                    tab.color === 'purple' && "data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white",
                    tab.color === 'red' && "data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white",
                    tab.color === 'green' && "data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white",
                    tab.color === 'orange' && "data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm font-medium">{tab.label}</span>
                  <span className="sm:hidden text-xs font-medium">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Contenido de los tabs - continuará en la siguiente parte */}
          <TabsContent value="company" className="space-y-4 sm:space-y-6">
            <Card className="border-blue-100 dark:border-blue-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Información de la Empresa</CardTitle>
                    <CardDescription>Datos principales visibles en reportes y facturas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg transition-colors",
                    matchesSearch('Nombre de la Empresa companyName') && 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <Label htmlFor="companyName" className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-500" />
                      Nombre de la Empresa
                    </Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      className={errors.companyName ? 'border-red-500' : ''}
                      placeholder="Ej: 4G Celulares"
                    />
                    {errors.companyName && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {errors.companyName}
                      </p>
                    )}
                  </div>
                  
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg transition-colors",
                    matchesSearch('Email companyEmail') && 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <Label htmlFor="companyEmail" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Email de Contacto
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={formData.companyEmail}
                      onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                      className={errors.companyEmail ? 'border-red-500' : ''}
                      placeholder="info@empresa.com"
                    />
                    {errors.companyEmail && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {errors.companyEmail}
                      </p>
                    )}
                  </div>
                  
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg transition-colors",
                    matchesSearch('Teléfono companyPhone') && 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <Label htmlFor="companyPhone" className="flex items-center gap-2">
                      <span className="text-lg">📱</span>
                      Teléfono
                    </Label>
                    <Input
                      id="companyPhone"
                      value={formData.companyPhone}
                      onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                      className={errors.companyPhone ? 'border-red-500' : ''}
                      placeholder="+595 21 123-4567"
                    />
                    {errors.companyPhone && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {errors.companyPhone}
                      </p>
                    )}
                  </div>
                  
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg transition-colors",
                    matchesSearch('Ciudad city') && 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <Label htmlFor="city" className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      Ciudad
                    </Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Asunción"
                    />
                  </div>
                  
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg transition-colors",
                    matchesSearch('Moneda currency') && 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <Label htmlFor="currency" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      Moneda Principal
                    </Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(value) => handleInputChange('currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PYG">🇵🇾 Guaraní (PYG)</SelectItem>
                        <SelectItem value="USD">🇺🇸 Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                        <SelectItem value="MXN">🇲🇽 Peso Mexicano (MXN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Separator />
                
                <div className={cn(
                  "space-y-2 p-3 rounded-lg transition-colors",
                  matchesSearch('Dirección address companyAddress') && 'bg-yellow-50 dark:bg-yellow-900/20'
                )}>
                  <Label htmlFor="companyAddress" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Dirección Física
                  </Label>
                  <Textarea
                    id="companyAddress"
                    value={formData.companyAddress}
                    onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                    rows={3}
                    className="resize-none"
                    placeholder="Av. Principal 1234, Ciudad, País"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APARIENCIA */}
          <TabsContent value="appearance" className="space-y-4 sm:space-y-6">
            <Card className="border-pink-100 dark:border-pink-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-transparent dark:from-pink-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500 rounded-lg">
                    <Palette className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Apariencia e Interfaz</CardTitle>
                    <CardDescription>Personaliza la experiencia visual del sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <Label className="flex items-center gap-2">Tema por Defecto</Label>
                    <Select 
                      value={formData.theme} 
                      onValueChange={(value: any) => handleInputChange('theme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">☀️ Claro</SelectItem>
                        <SelectItem value="dark">🌙 Oscuro</SelectItem>
                        <SelectItem value="system">💻 Sistema</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <Label className="flex items-center gap-2">Color Principal</Label>
                    <Select 
                      value={formData.primaryColor} 
                      onValueChange={(value) => handleInputChange('primaryColor', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">🔵 Azul (Default)</SelectItem>
                        <SelectItem value="purple">💜 Violeta</SelectItem>
                        <SelectItem value="green">💚 Verde</SelectItem>
                        <SelectItem value="orange">🧡 Naranja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <Label className="flex items-center gap-2">Items por Página</Label>
                    <Input
                      type="number"
                      value={formData.itemsPerPage}
                      onChange={(e) => handleInputChange('itemsPerPage', parseInt(e.target.value))}
                      min={5}
                      max={100}
                    />
                    <p className="text-xs text-gray-500">Filas por defecto en tablas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REGIONAL */}
          <TabsContent value="regional" className="space-y-4 sm:space-y-6">
            <Card className="border-indigo-100 dark:border-indigo-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500 rounded-lg">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuración Regional</CardTitle>
                    <CardDescription>Formatos de fecha, hora y localización</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label>Idioma por Defecto</Label>
                    <Select 
                      value={formData.language} 
                      onValueChange={(value) => handleInputChange('language', value)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">🇪🇸 Español</SelectItem>
                        <SelectItem value="en">🇺🇸 English</SelectItem>
                        <SelectItem value="pt">🇧🇷 Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Zona Horaria</Label>
                    <Select 
                      value={formData.timeZone} 
                      onValueChange={(value) => handleInputChange('timeZone', value)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Asuncion">America/Asuncion (GMT-4)</SelectItem>
                        <SelectItem value="America/Argentina/Buenos_Aires">America/Buenos_Aires (GMT-3)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Formato de Fecha</Label>
                    <Select 
                      value={formData.dateFormat} 
                      onValueChange={(value) => handleInputChange('dateFormat', value)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Moneda Principal</Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(value: any) => handleInputChange('currency', value)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PYG">🇵🇾 Guaraní (PYG)</SelectItem>
                        <SelectItem value="USD">🇺🇸 Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                        <SelectItem value="MXN">🇲🇽 Peso Mexicano (MXN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Impuesto Base (%)</Label>
                    <Input
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEATURES */}
          <TabsContent value="features" className="space-y-4 sm:space-y-6">
            <Card className="border-cyan-100 dark:border-cyan-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500 rounded-lg">
                    <Layout className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Funciones y Módulos</CardTitle>
                    <CardDescription>Habilitar o deshabilitar características del sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Módulos</h3>
                    <div className="space-y-4">
                      {['blog', 'reviews', 'api_access', 'inventory_tracking'].map((feature) => (
                        <div key={feature} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                          <Label className="capitalize">{feature.replace('_', ' ')}</Label>
                          <Switch
                            checked={formData.features?.[feature] || false}
                            onCheckedChange={(checked) => {
                              const newFeatures = { ...formData.features, [feature]: checked }
                              handleInputChange('features', newFeatures)
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                      <Label className="flex items-center gap-2 mb-2">
                        Umbral de Stock Bajo
                      </Label>
                      <Input
                        type="number"
                        value={formData.lowStockThreshold}
                        onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value))}
                        min={1}
                        max={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">Alerta cuando el producto llega a esta cantidad</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Redes Sociales</h3>
                    <div className="space-y-3">
                      {['facebook', 'instagram', 'twitter', 'linkedin'].map((social) => (
                        <div key={social} className="space-y-1">
                          <Label className="text-xs uppercase text-gray-500">{social}</Label>
                          <Input
                            placeholder={`URL de ${social}`}
                            value={formData.socialLinks?.[social] || ''}
                            onChange={(e) => {
                              const newLinks = { ...formData.socialLinks, [social]: e.target.value }
                              handleInputChange('socialLinks', newLinks)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4 sm:space-y-6">
            <Card className="border-orange-100 dark:border-orange-900 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <Server className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Configuración del Sistema</CardTitle>
                    <CardDescription>Ajustes técnicos y de mantenimiento</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <History className="h-4 w-4 text-orange-500" />
                        Retención de Auditoría
                      </Label>
                      <Badge variant="outline">{formData.retentionDays} días</Badge>
                    </div>
                    <Input
                      type="number"
                      value={formData.retentionDays}
                      onChange={(e) => handleInputChange('retentionDays', parseInt(e.target.value))}
                      min={30}
                      max={3650}
                    />
                    <p className="text-xs text-gray-500">Días para mantener logs históricos</p>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      Timeout de Sesión (min)
                    </Label>
                    <Input
                      type="number"
                      value={formData.sessionTimeout}
                      onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
                    <div className="space-y-1">
                      <Label className="text-base font-medium text-orange-900 dark:text-orange-100">
                        Modo Mantenimiento
                      </Label>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Bloquea el acceso a usuarios no administradores
                      </p>
                    </div>
                    <Switch
                      checked={formData.maintenanceMode}
                      onCheckedChange={handleMaintenanceModeChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
        </Tabs>

        <ConfirmationDialog />
      </div>
    </div>
  )
}
