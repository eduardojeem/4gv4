'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Settings2, Sun, Moon, Monitor, Palette, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ConfigurationSection as ConfigurationSectionType } from '@/types/settings'
import { ConfigurationSetting } from './configuration-setting'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface ConfigurationSectionProps {
  section: ConfigurationSectionType
  isExpanded?: boolean
  onToggle?: () => void
  onSettingChange?: (settingId: string, value: any) => void
  searchQuery?: string
  className?: string
}

export function ConfigurationSection({
  section,
  isExpanded = false,
  onToggle,
  onSettingChange,
  searchQuery = '',
  className
}: ConfigurationSectionProps) {
  // Filtrar configuraciones que coinciden con la búsqueda
  const filteredSettings = section.settings.filter(setting => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return (
      setting.title.toLowerCase().includes(query) ||
      setting.description.toLowerCase().includes(query) ||
      setting.searchKeywords.some(keyword => keyword.toLowerCase().includes(query))
    )
  })

  if (filteredSettings.length === 0 && searchQuery && section.settings.length > 0) {
    return null
  }

  return (
    <Card className={cn('border-l-4 border-l-blue-200 dark:border-l-blue-800', className)}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <CardTitle className="text-base font-medium">
                    {section.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {section.settings.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {filteredSettings.length}/{section.settings.length}
                  </Badge>
                )}
                {section.permissions && (
                  <Badge variant="secondary" className="text-xs">
                    Admin
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {section.component === 'ThemeSettings' ? (
              <ThemeSettingsPanel section={section} onSettingChange={onSettingChange} />
            ) : section.settings.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <p className="text-sm">
                  Esta sección utiliza componentes especializados para su gestión.
                </p>
                <p className="text-xs mt-1">
                  Componente: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                    {section.component}
                  </code>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSettings.map((setting) => (
                  <ConfigurationSetting
                    key={setting.id}
                    setting={setting}
                    onChange={onSettingChange}
                    searchQuery={searchQuery}
                  />
                ))}
                
                {filteredSettings.length === 0 && searchQuery && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">
                      No se encontraron configuraciones que coincidan con la búsqueda
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function ThemeSettingsPanel({
  section,
  onSettingChange
}: {
  section: ConfigurationSectionType
  onSettingChange?: (settingId: string, value: any) => void
}) {
  const { theme, colorScheme, setTheme, setColorScheme, isDark, customPalette, setCustomPalette } = useTheme()
  const [switching, setSwitching] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customDraft, setCustomDraft] = useState<{ [k: string]: string }>({})
  const themeMode = section.settings.find(s => s.id === 'theme-mode')
  const schemeSetting = section.settings.find(s => s.id === 'color-scheme')

  const handleThemeChange = (val: 'light' | 'dark' | 'system') => {
    setTheme(val)
    if (themeMode && onSettingChange) {
      onSettingChange(themeMode.id, val)
    }
  }

  const handleSchemeChange = (val: string) => {
    const v = val as any
    setColorScheme(v)
    if (schemeSetting && onSettingChange) {
      onSettingChange(schemeSetting.id, v)
    }
  }

  useEffect(() => {
    setSwitching(true)
    const t = setTimeout(() => setSwitching(false), 250)
    return () => clearTimeout(t)
  }, [theme, colorScheme])

  useEffect(() => {
    setShowCustom(colorScheme === 'custom')
    if (colorScheme === 'custom') {
      if (customPalette && Object.keys(customPalette).length > 0) {
        setCustomDraft({
          primary: customPalette.primary || '',
          accent: customPalette.accent || '',
          secondary: customPalette.secondary || '',
          muted: customPalette.muted || '',
          border: customPalette.border || '',
          ring: customPalette.ring || ''
        })
      } else if (typeof window !== 'undefined') {
        const styles = getComputedStyle(document.documentElement)
        setCustomDraft({
          primary: styles.getPropertyValue('--primary').trim(),
          accent: styles.getPropertyValue('--accent').trim(),
          secondary: styles.getPropertyValue('--secondary').trim(),
          muted: styles.getPropertyValue('--muted').trim(),
          border: styles.getPropertyValue('--border').trim(),
          ring: styles.getPropertyValue('--ring').trim()
        })
      }
    }
  }, [colorScheme])

  const schemes = schemeSetting?.options ?? [
    { label: 'Por Defecto', value: 'default' },
    { label: 'Azul', value: 'blue' },
    { label: 'Verde', value: 'green' },
    { label: 'Púrpura', value: 'purple' },
    { label: 'Naranja', value: 'orange' },
    { label: 'Rojo', value: 'red' },
    { label: 'Corporativo', value: 'corporate' },
    { label: 'Índigo', value: 'indigo' },
    { label: 'Turquesa', value: 'teal' },
    { label: 'Rosa', value: 'pink' },
    { label: 'Ámbar', value: 'amber' },
    { label: 'Cian', value: 'cyan' },
    { label: 'Personalizado', value: 'custom' }
  ]

  return (
    <div className="space-y-6">
      {/* Controles de tema */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Modo de Tema</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors duration-200 ${theme === 'light' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
            >
            <Sun className="h-4 w-4" />
            Claro
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors duration-200 ${theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
          >
            <Moon className="h-4 w-4" />
            Oscuro
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors duration-200 ${theme === 'system' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
          >
            <Monitor className="h-4 w-4" />
            Sistema
          </button>
        </div>
        {showCustom && (
          <div className="mt-3 rounded border p-3">
            <div className="text-sm font-medium mb-2">Paleta personalizada</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['primary','accent','secondary','muted','border','ring'].map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground capitalize">{key}</label>
                  <input
                    type="color"
                    value={customDraft[key] || '#000000'}
                    onChange={(e) => setCustomDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-9 w-full cursor-pointer"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <span className="h-5 w-5 rounded" style={{ background: customDraft.primary }} />
                <span className="h-5 w-5 rounded" style={{ background: customDraft.accent }} />
                <span className="h-5 w-5 rounded" style={{ background: customDraft.secondary }} />
                <span className="h-5 w-5 rounded" style={{ background: customDraft.muted }} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDraft({})}
                >
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setCustomPalette?.({
                      primary: customDraft.primary,
                      accent: customDraft.accent,
                      secondary: customDraft.secondary,
                      muted: customDraft.muted,
                      border: customDraft.border,
                      ring: customDraft.ring
                    })
                    handleSchemeChange('custom')
                  }}
                >
                  Aplicar paleta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Esquema de color */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Esquema de Color</div>
        <div className="flex flex-wrap gap-2">
          {schemes.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSchemeChange(opt.value as string)}
              className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors duration-200 ${colorScheme === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
            >
              {colorScheme === opt.value ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : (
                <Palette className="h-4 w-4" />
              )}
              <span className="text-sm">{opt.label}</span>
              <span className="ml-2 flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-primary" />
                <span className="h-3 w-3 rounded bg-muted" />
                <span className="h-3 w-3 rounded bg-accent" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vista previa */}
      <div className={`rounded border border-border bg-card p-4 transition-opacity duration-300 ${switching ? 'opacity-75' : 'opacity-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Vista previa</div>
            <div className="text-base font-medium">{isDark ? 'Modo oscuro' : 'Modo claro'}</div>
            <div className="text-sm text-muted-foreground">Esquema: {colorScheme}</div>
          </div>
          <div className="flex gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/80 transition-colors" />
            <span className="h-6 w-6 rounded-full bg-muted transition-colors" />
            <span className="h-6 w-6 rounded-full bg-accent transition-colors" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded bg-background border border-border p-3 transition-colors">
            <div className="text-sm font-medium">Elemento</div>
            <div className="text-sm text-muted-foreground">Texto secundario</div>
            <button className="mt-2 inline-flex items-center rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Botón primario</button>
          </div>
          <div className="rounded bg-muted p-3 transition-colors">
            <div className="text-sm font-medium">Elemento Muted</div>
            <div className="text-sm text-muted-foreground">Ejemplo de contraste</div>
            <button className="mt-2 inline-flex items-center rounded border border-border px-2 py-1 text-xs">Botón secundario</button>
          </div>
        </div>
      </div>
    </div>
  )
}