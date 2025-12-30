'use client'

import { useState, useEffect } from 'react'
import { 
  Settings, Search, Save, RotateCcw, Download, Upload, 
  BarChart3, AlertCircle, CheckCircle, FileText, Zap,
  ChevronLeft, ChevronRight, Expand, Minimize, 
  Palette, Shield, Database, Package, Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useConfigurationManager } from '@/hooks/use-configuration-manager'
import { useConfigurationSearch } from '@/hooks/use-configuration-search'
import { ConfigurationSearch } from '@/components/dashboard/configuration-search'
import { ConfigurationGroup } from '@/components/dashboard/configuration-groups/configuration-group'

export default function SettingsPage() {
  const configManager = useConfigurationManager()
  const searchHook = useConfigurationSearch(configManager.groups)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [isCompactView, setIsCompactView] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  // Manejar cambios en configuraciones
  const handleSettingChange = async (settingId: string, value: any) => {
    configManager.updateSetting(settingId, value)
  }

  // Guardar configuraciones
  const handleSave = async () => {
    const result = await configManager.saveSettings()
    if (result.success) {
      toast.success('Configuraciones guardadas correctamente')
    } else {
      toast.error('Error al guardar las configuraciones')
    }
  }

  // Resetear configuraciones
  const handleReset = () => {
    configManager.resetSettings()
    toast.info('Configuraciones restablecidas a valores por defecto')
  }

  // Exportar configuraciones
  const handleExport = () => {
    configManager.exportSettings()
    toast.success('Configuraciones exportadas correctamente')
  }

  // Importar configuraciones
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const result = await configManager.importSettings(file)
    if (result.success) {
      toast.success('Configuraciones importadas correctamente')
    } else {
      toast.error(result.error || 'Error al importar configuraciones')
    }

    // Limpiar el input
    event.target.value = ''
  }

  // Alternar expansión de grupo
  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  // Expandir/contraer todos los grupos
  const toggleAllGroups = () => {
    if (expandedGroups.size === configManager.groups.length) {
      setExpandedGroups(new Set())
    } else {
      setExpandedGroups(new Set(configManager.groups.map(g => g.id)))
    }
  }

  // Filtrar grupos basado en búsqueda
  const filteredGroups = searchHook.isSearching 
    ? configManager.groups.filter(group => 
        group.sections.some(section => 
          section.settings.some(setting => 
            searchHook.searchResults.some(result => result.setting.id === setting.id)
          )
        )
      )
    : configManager.groups

  const statistics = configManager.getStatistics()

  return (
    <div className="space-y-6">
      {/* Header + acciones pegajosas */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border py-3">
        <div className="flex items-center justify-between px-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <Settings className="h-7 w-7 md:h-8 md:w-8" />
              Configuración del Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Personaliza y configura todos los aspectos de tu sistema
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatistics(!showStatistics)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Estadísticas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompactView(!isCompactView)}
            >
              {isCompactView ? (
                <Expand className="h-4 w-4 mr-2" />
              ) : (
                <Minimize className="h-4 w-4 mr-2" />
              )}
              {isCompactView ? 'Expandir' : 'Compactar'}
            </Button>
            {configManager.hasUnsavedChanges && (
              <Badge variant="destructive" className="hidden md:flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Cambios sin guardar
              </Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={!configManager.hasUnsavedChanges || configManager.isLoading}
              className="flex items-center gap-2"
            >
              {configManager.isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {showStatistics && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {statistics.totalGroups}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Grupos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {statistics.totalSections}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Secciones</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {statistics.totalSettings}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Configuraciones</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {statistics.modifiedSettings}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Modificadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {statistics.groupsWithChanges}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Con Cambios</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disposición principal con navegación lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar de navegación */}
        <aside className="lg:col-span-3">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Navegación de configuraciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                {configManager.groups.map((group) => (
                  <a
                    key={group.id}
                    href={`#group-${group.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      const el = document.getElementById(`group-${group.id}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      setActiveAnchor(group.id)
                    }}
                    className={
                      `flex items-center justify-between rounded px-3 py-2 border hover:bg-muted transition-colors ${activeAnchor === group.id ? 'bg-muted border-primary/30' : 'border-border'}`
                    }
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {group.icon === 'Palette' && <Palette className="h-4 w-4" />}
                      {group.icon === 'Settings' && <Settings className="h-4 w-4" />}
                      {group.icon === 'Bell' && <Bell className="h-4 w-4" />}
                      {group.icon === 'Package' && <Package className="h-4 w-4" />}
                      {group.icon === 'Shield' && <Shield className="h-4 w-4" />}
                      {group.icon === 'Database' && <Database className="h-4 w-4" />}
                      {group.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {group.sections.length}
                    </Badge>
                  </a>
                ))}
              </div>

              {/* Acciones rápidas */}
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={toggleAllGroups} className="flex-1">
                  {expandedGroups.size === configManager.groups.length ? (
                    <>
                      <ChevronLeft className="h-4 w-4 mr-2" /> Contraer
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-2" /> Expandir
                    </>
                  )}
                </Button>
              </div>

              {/* Barra de búsqueda */}
              <div className="pt-2">
                <ConfigurationSearch
                  searchQuery={searchHook.searchQuery}
                  onSearchChange={searchHook.setSearchQuery}
                  selectedCategory={searchHook.selectedCategory}
                  onCategoryChange={searchHook.setSelectedCategory}
                  availableCategories={searchHook.availableCategories}
                  suggestions={searchHook.getSearchSuggestions(searchHook.searchQuery)}
                  onSuggestionSelect={searchHook.setSearchQuery}
                  onClear={searchHook.clearSearch}
                  placeholder="Buscar en configuraciones..."
                />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Contenido principal */}
        <section className="lg:col-span-9 space-y-6">
          {/* Panel de esenciales */}
          <EssentialsPanel
            searchHook={searchHook}
            onSettingChange={handleSettingChange}
            isCompactView={isCompactView}
          />

          {/* Estadísticas */}
          {showStatistics && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {statistics.totalGroups}
                    </div>
                    <div className="text-sm text-muted-foreground">Grupos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {statistics.totalSections}
                    </div>
                    <div className="text-sm text-muted-foreground">Secciones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {statistics.totalSettings}
                    </div>
                    <div className="text-sm text-muted-foreground">Configuraciones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {statistics.modifiedSettings}
                    </div>
                    <div className="text-sm text-muted-foreground">Modificadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {statistics.groupsWithChanges}
                    </div>
                    <div className="text-sm text-muted-foreground">Con Cambios</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Barra de acciones */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {searchHook.hasResults && (
                <Badge variant="secondary">
                  {searchHook.searchResults.length} resultado{searchHook.searchResults.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {configManager.hasUnsavedChanges && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Cambios sin guardar
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={configManager.isLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resetear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={configManager.isLoading}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={configManager.isLoading}
                />
                <Button variant="outline" size="sm" disabled={configManager.isLoading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Button>
              </div>
            </div>
          </div>

          {/* Resultados de búsqueda */}
          {searchHook.isSearching && searchHook.hasResults && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-800 dark:text-green-200">
                    Resultados de búsqueda para "{searchHook.searchQuery}"
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {searchHook.searchResults.length} encontrado{searchHook.searchResults.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {searchHook.searchResults.slice(0, 5).map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                      <div>
                        <span className="font-medium">{result.setting.title}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          en {result.group.title} → {result.section.title}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(result.relevanceScore)}% relevancia
                      </Badge>
                    </div>
                  ))}
                  {searchHook.searchResults.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      Y {searchHook.searchResults.length - 5} resultado{searchHook.searchResults.length - 5 !== 1 ? 's' : ''} más...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grupos de configuración */}
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <div key={group.id} id={`group-${group.id}`} className="scroll-mt-24">
                <ConfigurationGroup
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onSettingChange={handleSettingChange}
                  searchQuery={searchHook.searchQuery}
                  className={isCompactView ? 'text-sm' : ''}
                />
              </div>
            ))}
            {filteredGroups.length === 0 && searchHook.isSearching && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron resultados</h3>
                    <p className="text-muted-foreground mb-4">
                      No hay configuraciones que coincidan con "{searchHook.searchQuery}"
                    </p>
                    <Button variant="outline" onClick={searchHook.clearSearch}>Limpiar búsqueda</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>

      

      
    </div>
  )
}

// Panel de configuraciones esenciales con controles rápidos
function EssentialsPanel({
  searchHook,
  onSettingChange,
  isCompactView
}: {
  searchHook: ReturnType<typeof useConfigurationSearch>
  onSettingChange: (settingId: string, value: any) => void
  isCompactView: boolean
}) {
  const getSetting = (id: string) => searchHook.findSettingById(id)?.setting
  const themeMode = getSetting('theme-mode')
  const colorScheme = getSetting('color-scheme')
  const emailEnabled = getSetting('email-notifications')
  const autoBackup = getSetting('auto-backup')
  const companyName = getSetting('company-name')
  const currency = getSetting('currency')

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-primary" />
          Configuraciones esenciales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${isCompactView ? 'text-sm' : ''}`}>
          {/* Nombre de empresa */}
          {companyName && (
            <div>
              <label className="block text-muted-foreground mb-1">Nombre de la Empresa</label>
              <Input
                value={companyName.value ?? ''}
                onChange={(e) => onSettingChange(companyName.id, e.target.value)}
                placeholder="Mi Empresa"
              />
            </div>
          )}

          {/* Moneda */}
          {currency && (
            <div>
              <label className="block text-muted-foreground mb-1">Moneda</label>
              <SelectControl
                value={currency.value}
                options={currency.options ?? []}
                onChange={(val) => onSettingChange(currency.id, val)}
              />
            </div>
          )}

          {/* Modo de tema */}
          {themeMode && (
            <div>
              <label className="block text-muted-foreground mb-1">Modo de Tema</label>
              <SelectControl
                value={themeMode.value}
                options={themeMode.options ?? []}
                onChange={(val) => onSettingChange(themeMode.id, val)}
              />
            </div>
          )}

          {/* Esquema de color */}
          {colorScheme && (
            <div>
              <label className="block text-muted-foreground mb-1">Esquema de Color</label>
              <SelectControl
                value={colorScheme.value}
                options={colorScheme.options ?? []}
                onChange={(val) => onSettingChange(colorScheme.id, val)}
              />
            </div>
          )}

          {/* Notificaciones por email */}
          {emailEnabled && (
            <div className="flex items-center justify-between gap-4 border rounded px-3 py-2">
              <div>
                <div className="font-medium">Notificaciones por Email</div>
                <div className="text-muted-foreground">Recibir notificaciones importantes</div>
              </div>
              <SwitchControl
                checked={!!emailEnabled.value}
                onCheckedChange={(val) => onSettingChange(emailEnabled.id, val)}
              />
            </div>
          )}

          {/* Respaldo automático */}
          {autoBackup && (
            <div className="flex items-center justify-between gap-4 border rounded px-3 py-2">
              <div>
                <div className="font-medium">Respaldo Automático</div>
                <div className="text-muted-foreground">Crear respaldos diarios</div>
              </div>
              <SwitchControl
                checked={!!autoBackup.value}
                onCheckedChange={(val) => onSettingChange(autoBackup.id, val)}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SelectControl({
  value,
  options,
  onChange
}: {
  value: any
  options: { label: string; value: any }[]
  onChange: (val: any) => void
}) {
  return (
    <div className="relative">
      <select
        className="w-full appearance-none rounded border border-border bg-background px-3 py-2 text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">▾</span>
    </div>
  )
}

function SwitchControl({
  checked,
  onCheckedChange
}: {
  checked: boolean
  onCheckedChange: (val: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={
        `inline-flex h-6 w-10 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`
      }
    >
      <span className={`h-5 w-5 rounded-full bg-background shadow transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}