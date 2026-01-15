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
  X
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
  
  // Hook para diálogo de confirmación
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog()

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

  /**
   * Maneja el cambio del modo mantenimiento con confirmación especial
   */
  const handleMaintenanceModeChange = async (checked: boolean) => {
    if (checked) {
      // Activar modo mantenimiento requiere confirmación especial
      const result = await showConfirmation({
        title: '⚠️ Activar Modo Mantenimiento',
        description: 'Esta acción bloqueará el acceso al sistema para todos los usuarios excepto administradores. Los usuarios actuales serán desconectados. Esta es una acción crítica que debe usarse solo durante mantenimiento programado.',
        confirmText: 'Activar Modo Mantenimiento',
        cancelText: 'Cancelar',
        variant: 'destructive',
        requirePassword: true,
        requireConfirmText: 'MANTENIMIENTO'
      })

      if (!result.confirmed) {
        return // Usuario canceló
      }

      // Verificar contraseña antes de activar
      // TODO: Implementar verificación de contraseña en backend
      if (!result.password) {
        toast.error('Debe ingresar su contraseña')
        return
      }

      // Mostrar advertencia final
      const finalConfirm = await showConfirmation({
        title: '🚨 Última Confirmación',
        description: '¿Está completamente seguro? Esta acción afectará a todos los usuarios del sistema inmediatamente.',
        confirmText: 'Sí, activar ahora',
        cancelText: 'No, cancelar',
        variant: 'destructive'
      })

      if (!finalConfirm.confirmed) {
        return
      }

      handleInputChange('maintenanceMode', true)
      toast.warning('Modo mantenimiento activado', {
        description: 'Solo los administradores pueden acceder al sistema'
      })
    } else {
      // Desactivar es más simple pero también requiere confirmación
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
    
    try {
      // Confirmar acción con diálogo robusto
      const result = await showConfirmation({
        title: `⚠️ ${labels[action] || action}`,
        description: 'Esta acción puede afectar el sistema. ¿Desea continuar?',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        variant: action === 'backup' ? 'warning' : 'default',
        requirePassword: action === 'backup' // Requerir contraseña para backup
      })
      
      if (!result.confirmed) return
      
      const actionResult = await onPerformAction(action)
      if (actionResult.success) {
        toast.success(actionResult.message || 'Acción completada con éxito')
      } else {
        toast.error(actionResult.error || 'Error al realizar acción')
      }
    } catch (e) {
      console.error('System action error:', e)
      toast.error('Error inesperado')
    }
  }

  const exportSettings = async () => {
    try {
      // Verificar rate limit
      const { checkRateLimit } = await import('@/lib/security/rate-limit')
      const rateLimitCheck = await checkRateLimit('settings_export')
      if (!rateLimitCheck.allowed) {
        toast.error('Demasiadas exportaciones. Intente más tarde.')
        return
      }
      
      const dataStr = JSON.stringify(formData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      
      // Registrar en audit log
      const { logAuditEvent } = await import('@/lib/security/audit-log')
      await logAuditEvent({
        action: 'export',
        severity: 'medium',
        details: { timestamp: new Date().toISOString() }
      })
      
      toast.success('Configuración exportada')
    } catch (e) {
      console.error('Export error:', e)
      toast.error('Error al exportar')
    }
  }

  const importSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      // Validar archivo
      const { validateJSONFile } = await import('@/lib/security/sanitize')
      const validation = validateJSONFile(file, 1)
      
      if (!validation.valid) {
        toast.error(validation.error || 'Archivo inválido')
        return
      }
      
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const rawData = JSON.parse(e.target?.result as string)
          
          // Validar y sanitizar
          const { validateAndSanitizeSettings } = await import('@/lib/validations/system-settings')
          const { preventPrototypePollution } = await import('@/lib/security/sanitize')
          
          const cleanData = preventPrototypePollution(rawData)
          const validatedSettings = validateAndSanitizeSettings(cleanData)
          
          // Verificar rate limit
          const { checkRateLimit } = await import('@/lib/security/rate-limit')
          const rateLimitCheck = await checkRateLimit('settings_import')
          if (!rateLimitCheck.allowed) {
            toast.error('Demasiadas importaciones. Intente más tarde.')
            return
          }
          
          // Confirmar importación
          const result = await showConfirmation({
            title: 'Confirmar Importación',
            description: 'Esta acción sobrescribirá la configuración actual. ¿Desea continuar?',
            confirmText: 'Importar',
            cancelText: 'Cancelar',
            variant: 'warning'
          })
          
          if (!result.confirmed) return
          
          setFormData(prev => ({ ...prev, ...validatedSettings }))
          setHasChanges(true)
          
          // Registrar en audit log
          const { logAuditEvent } = await import('@/lib/security/audit-log')
          await logAuditEvent({
            action: 'import',
            severity: 'high',
            details: { fileName: file.name }
          })
          
          toast.success('Configuración importada y validada. Revise los cambios antes de guardar.')
        } catch (error: any) {
          console.error('Import error:', error)
          if (error?.name === 'ZodError') {
            toast.error(`Archivo inválido: ${error.errors?.[0]?.message || 'Formato incorrecto'}`)
          } else {
            toast.error('Error al importar: archivo inválido')
          }
        }
      }
      reader.readAsText(file)
    } catch (error) {
      console.error('Import settings error:', error)
      toast.error('Error al procesar el archivo')
    }
    
    // Limpiar input
    event.target.value = ''
  }

  // Debounce de búsqueda
  useEffect(() => {
    const id = setTimeout(() => setSettingsSearchDebounced(settingsSearch), 250)
    return () => clearTimeout(id)
  }, [settingsSearch])

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
                      disabled={isLoading || Object.keys(errors).length > 0}
                      className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
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
        {/* TabsList Horizontal en Desktop, Grid en Móvil */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <TabsTrigger 
              value="company" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Empresa</span>
              <span className="sm:hidden text-xs font-medium">Empresa</span>
            </TabsTrigger>
            <TabsTrigger 
              value="general" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">General</span>
              <span className="sm:hidden text-xs font-medium">General</span>
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Seguridad</span>
              <span className="sm:hidden text-xs font-medium">Seguridad</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Notificaciones</span>
              <span className="sm:hidden text-xs font-medium">Notif.</span>
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Sistema</span>
              <span className="sm:hidden text-xs font-medium">Sistema</span>
            </TabsTrigger>
          </TabsList>
        </div>
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
                    disabled={isLoading || Object.keys(errors).length > 0}
                    className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
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
        {/* TabsList Horizontal en Desktop, Grid en Móvil */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <TabsTrigger 
              value="company" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Empresa</span>
              <span className="sm:hidden text-xs font-medium">Empresa</span>
            </TabsTrigger>
            <TabsTrigger 
              value="general" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">General</span>
              <span className="sm:hidden text-xs font-medium">General</span>
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Seguridad</span>
              <span className="sm:hidden text-xs font-medium">Seguridad</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Notificaciones</span>
              <span className="sm:hidden text-xs font-medium">Notif.</span>
            </TabsTrigger>
            <TabsTrigger 
              value="system" 
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline text-sm font-medium">Sistema</span>
              <span className="sm:hidden text-xs font-medium">Sistema</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
                
                {/* Modo Mantenimiento con confirmación especial */}
                <div className={`
                  flex items-center justify-between p-4 rounded-lg border-2 transition-all
                  ${formData.maintenanceMode 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' 
                    : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                  }
                `}>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label className={`text-base font-semibold ${
                        formData.maintenanceMode ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'
                      }`}>
                        Modo Mantenimiento
                      </Label>
                      {formData.maintenanceMode ? (
                        <Badge variant="destructive" className="animate-pulse">
                          ACTIVO
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm ${
                      formData.maintenanceMode ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      {formData.maintenanceMode 
                        ? '🚨 Sistema en mantenimiento. Solo administradores tienen acceso.'
                        : '⚠️ Restringe el acceso solo a administradores. Use con precaución.'
                      }
                    </p>
                    {formData.maintenanceMode && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Los usuarios no administradores no pueden acceder al sistema
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={formData.maintenanceMode}
                    onCheckedChange={handleMaintenanceModeChange}
                    className={formData.maintenanceMode ? 'data-[state=checked]:bg-red-600' : ''}
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
      
      {/* Diálogo de confirmación */}
      <ConfirmationDialog />
      </div>
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
