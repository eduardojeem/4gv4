'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Save, RotateCcw, AlertCircle, HelpCircle,
  Loader2, Globe, Package, Palette, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
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
import { getAdminSettingsText } from '@/lib/i18n/admin-settings'

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
  const { loading: authLoading } = useAuth()
  const { setTheme, setColorScheme } = useTheme()
  const t = getAdminSettingsText(settings.language)

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
            {authLoading ? t.loadingAuth : t.loadingSettings}
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
              <h3 className="text-lg font-semibold">{t.errorTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSave = async () => {
    const result = await saveSettings()
    if (result.success) {
      toast.success(t.saved)
    } else {
      toast.error(result.error || t.saveError)
    }
  }

  const handleReset = () => {
    resetSettings()
    setTheme(originalSettings.theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(originalSettings.primaryColor) ? originalSettings.primaryColor : DEFAULT_SYSTEM_COLOR_SCHEME)
    toast.info(t.discarded)
  }

  const selectedColorScheme = getSystemColorSchemeOption(settings.primaryColor)
  const selectedColorSchemeText = t.appearance.colorSchemes[selectedColorScheme.value] ?? selectedColorScheme
  const timeZoneOptions = Object.entries(t.regional.timeZones)
  const quickColorValue = ['blue', 'green', 'purple', 'orange', 'red'].includes(settings.primaryColor)
    ? settings.primaryColor
    : '__catalog__'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t.subtitle}
          </p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="self-start sm:self-auto text-xs gap-1">
            <AlertCircle className="h-3 w-3" />
            {changedFields} {t.unsaved}
          </Badge>
        )}
      </div>

      {/* Cache warning */}
      {error && canRenderFallback && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t.cacheTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
          <span className="text-sm font-medium text-primary">
            {t.unsavedBar}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {t.discard}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isSaving ? t.saving : t.save}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="company" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {t.tabs.company}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            {t.tabs.appearance}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {t.tabs.inventory}
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-5 mt-0">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                {t.company.title}
              </CardTitle>
              <CardDescription>{t.company.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t.company.name} <span className="text-destructive">*</span></Label>
                  <Input id="companyName" value={settings.companyName} onChange={(e) => updateSetting('companyName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRuc">{t.company.ruc}</Label>
                  <Input id="companyRuc" value={settings.companyRuc} onChange={(e) => updateSetting('companyRuc', e.target.value)} placeholder="80012345-6" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">{t.company.email} <span className="text-destructive">*</span></Label>
                  <Input id="companyEmail" type="email" value={settings.companyEmail} onChange={(e) => updateSetting('companyEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">{t.company.phone}</Label>
                  <Input id="companyPhone" value={settings.companyPhone} onChange={(e) => updateSetting('companyPhone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t.company.city}</Label>
                  <Input id="city" value={settings.city} onChange={(e) => updateSetting('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t.company.currency}</Label>
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
                    {t.company.tax}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent><p>{t.company.taxHelp}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input id="taxRate" type="number" min="0" max="100" value={settings.taxRate} onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">{t.company.session}</Label>
                  <Input id="sessionTimeout" type="number" min="5" max="480" value={settings.sessionTimeout} onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value) || 60)} />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="companyAddress">{t.company.address}</Label>
                <Textarea id="companyAddress" value={settings.companyAddress} onChange={(e) => updateSetting('companyAddress', e.target.value)} rows={2} className="resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Regional */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                {t.regional.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t.regional.language}</Label>
                  <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">{t.regional.spanish}</SelectItem>
                      <SelectItem value="en">{t.regional.english}</SelectItem>
                      <SelectItem value="pt">{t.regional.portuguese}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.regional.timeZone}</Label>
                  <Select value={settings.timeZone} onValueChange={(v) => updateSetting('timeZone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {timeZoneOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                      {!t.regional.timeZones[settings.timeZone as keyof typeof t.regional.timeZones] && settings.timeZone ? (
                        <SelectItem value={settings.timeZone}>{settings.timeZone}</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t.regional.timeZoneHelp}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t.regional.dateFormat}</Label>
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
                {t.appearance.title}
              </CardTitle>
              <CardDescription>{t.appearance.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.appearance.theme}</Label>
                  <Select value={settings.theme} onValueChange={handleThemeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t.appearance.light}</SelectItem>
                      <SelectItem value="dark">{t.appearance.dark}</SelectItem>
                      <SelectItem value="system">{t.appearance.system}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.appearance.quickColor}</Label>
                  <Select value={quickColorValue} onValueChange={(v) => { if (v !== '__catalog__') handleColorChange(v as SystemColorScheme) }}>
                    <SelectTrigger><SelectValue placeholder={t.appearance.chooseColor} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__catalog__">{t.appearance.catalog}</SelectItem>
                      <SelectItem value="blue">{t.appearance.blue}</SelectItem>
                      <SelectItem value="green">{t.appearance.green}</SelectItem>
                      <SelectItem value="purple">{t.appearance.purple}</SelectItem>
                      <SelectItem value="orange">{t.appearance.orange}</SelectItem>
                      <SelectItem value="red">{t.appearance.red}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
                <Label>{t.appearance.schemeCatalog}</Label>
                <SystemColorSchemePicker
                  value={settings.primaryColor}
                  onChange={handleColorChange}
                  labels={t.appearance.colorSchemes}
                  footerText={t.appearance.colorSchemeFooter}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{selectedColorSchemeText.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedColorSchemeText.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{t.appearance.primary}</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{t.appearance.surface}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>{t.appearance.perPage}</Label>
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
                {t.inventory.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t.inventory.lowStock}</Label>
                <Input type="number" min="1" value={settings.lowStockThreshold} onChange={(e) => updateSetting('lowStockThreshold', parseInt(e.target.value) || 10)} />
                <p className="text-xs text-muted-foreground">{t.inventory.lowStockHelp}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
