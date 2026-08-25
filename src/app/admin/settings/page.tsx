'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Building2,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Palette,
  ReceiptText,
  RotateCcw,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import { BusinessTypeCard } from '@/components/admin/settings/BusinessTypeCard'
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
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  formatCurrency,
  getCurrencyDefinition,
} from '@/lib/currency'

type FieldErrors = Partial<Record<
  'companyName' | 'companyEmail' | 'companyPhone' | 'companyRuc' | 'companyAddress' | 'city' | 'taxRate',
  string
>>

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="text-xs text-destructive" role="alert">{message}</p>
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    isSaving,
    error,
    updateSetting,
    saveSettings,
    resetSettings,
    reloadSettings,
  } = useSharedSettings()
  const { loading: authLoading, isSuperAdmin } = useAuth()
  const { setTheme, setColorScheme } = useTheme()
  const t = getAdminSettingsText('es')
  const [activeTab, setActiveTab] = useState('company')
  const [currencyChangeConfirmed, setCurrencyChangeConfirmed] = useState(false)

  useEffect(() => {
    if (!authLoading && isSuperAdmin) router.replace('/superadmin/settings')
  }, [authLoading, isSuperAdmin, router])

  const validationErrors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {}
    const name = settings.companyName.trim()
    const email = settings.companyEmail.trim()
    if (!name) next.companyName = 'Ingresá el nombre de la empresa.'
    else if (name.length > 100) next.companyName = 'El nombre no puede superar 100 caracteres.'
    if (!email) next.companyEmail = 'Ingresá el email de la empresa.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.companyEmail = 'Ingresá un email válido.'
    if (settings.companyPhone.length > 50) next.companyPhone = 'El teléfono no puede superar 50 caracteres.'
    if (settings.companyRuc.length > 50) next.companyRuc = 'El RUC no puede superar 50 caracteres.'
    if (settings.companyAddress.length > 500) next.companyAddress = 'La dirección no puede superar 500 caracteres.'
    if (settings.city.length > 100) next.city = 'La ciudad no puede superar 100 caracteres.'
    if (!Number.isFinite(settings.taxRate) || settings.taxRate < 0 || settings.taxRate > 100) {
      next.taxRate = 'El IVA debe estar entre 0 y 100%.'
    }
    return next
  }, [settings])

  const currencyChanged = settings.currency !== originalSettings.currency
  const canSave = Object.keys(validationErrors).length === 0
    && (!currencyChanged || currencyChangeConfirmed)
  const selectedCurrency = getCurrencyDefinition(settings.currency)
  const selectedLanguage = SUPPORTED_LANGUAGES.find(({ code }) => code === settings.language)
    ?? SUPPORTED_LANGUAGES[0]
  const currencyPreview = formatCurrency(1234567.89, {
    currency: settings.currency,
    language: settings.language,
  })
  const changedFields = useMemo(() => (
    Object.keys(settings).reduce((count, key) => {
      const typedKey = key as keyof typeof settings
      return JSON.stringify(settings[typedKey]) === JSON.stringify(originalSettings[typedKey]) ? count : count + 1
    }, 0)
  ), [settings, originalSettings])

  const initialSyncDone = useRef(false)
  const themeDirtyRef = useRef(false)
  const savedThemeRef = useRef({ theme: originalSettings.theme, color: originalSettings.primaryColor })

  useEffect(() => {
    if (isSuperAdmin || isLoading || initialSyncDone.current) return
    setTheme(settings.theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(settings.primaryColor) ? settings.primaryColor : DEFAULT_SYSTEM_COLOR_SCHEME)
    initialSyncDone.current = true
  }, [isSuperAdmin, isLoading, settings.theme, settings.primaryColor, setTheme, setColorScheme])

  useEffect(() => {
    if (!themeDirtyRef.current) {
      savedThemeRef.current = { theme: originalSettings.theme, color: originalSettings.primaryColor }
    }
  }, [originalSettings.theme, originalSettings.primaryColor])

  useEffect(() => () => {
    if (!themeDirtyRef.current) return
    const { theme, color } = savedThemeRef.current
    setTheme(theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(color) ? color : DEFAULT_SYSTEM_COLOR_SCHEME)
  }, [setTheme, setColorScheme])

  useEffect(() => {
    if (!hasChanges) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  const handleThemeChange = (value: string) => {
    updateSetting('theme', value)
    setTheme(value as 'light' | 'dark' | 'system')
    themeDirtyRef.current = true
  }

  const handleColorChange = (value: SystemColorScheme) => {
    updateSetting('primaryColor', value)
    setColorScheme(value)
    themeDirtyRef.current = true
  }

  const handleSave = async () => {
    if (!canSave) {
      setActiveTab(validationErrors.taxRate || currencyChanged ? 'operations' : 'company')
      toast.error(currencyChanged && !currencyChangeConfirmed
        ? 'Confirmá el impacto del cambio de moneda antes de guardar.'
        : 'Revisá los campos marcados antes de guardar.')
      return
    }
    const result = await saveSettings({ confirmCurrencyChange: currencyChangeConfirmed })
    if (!result.success) {
      toast.error(result.error || t.saveError)
      return
    }
    themeDirtyRef.current = false
    setCurrencyChangeConfirmed(false)
    savedThemeRef.current = { theme: settings.theme, color: settings.primaryColor }
    toast.success(t.saved)
  }

  const handleReset = () => {
    resetSettings()
    setTheme(originalSettings.theme as 'light' | 'dark' | 'system')
    setColorScheme(isSystemColorScheme(originalSettings.primaryColor) ? originalSettings.primaryColor : DEFAULT_SYSTEM_COLOR_SCHEME)
    themeDirtyRef.current = false
    setCurrencyChangeConfirmed(false)
    toast.info(t.discarded)
  }

  if (authLoading || isLoading || isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? 'Abriendo configuración global…' : authLoading ? t.loadingAuth : t.loadingSettings}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <div>
              <h2 className="font-semibold">No se pudo cargar la configuración</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void reloadSettings()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedColorScheme = getSystemColorSchemeOption(settings.primaryColor)
  const selectedColorSchemeText = t.appearance.colorSchemes[selectedColorScheme.value] ?? selectedColorScheme
  const timeZoneOptions = Object.entries(t.regional.timeZones)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Configuración de la organización</h1>
              <Badge variant="outline">Organización activa</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Datos empresariales, reglas de operación y apariencia del panel.
            </p>
          </div>
        </div>
        {hasChanges ? (
          <Badge variant="secondary" className="w-fit gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />{changedFields} cambio{changedFields === 1 ? '' : 's'} pendiente{changedFields === 1 ? '' : 's'}
          </Badge>
        ) : null}
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info />
        <AlertTitle>Alcance de estos ajustes</AlertTitle>
        <AlertDescription>
          Los datos de empresa se usan en comprobantes y documentos. Cada sucursal conserva su propio teléfono, dirección y responsable.
        </AlertDescription>
      </Alert>

      {hasChanges ? (
        <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Cambios sin guardar</p>
            <p className="text-xs text-muted-foreground">
              {canSave ? 'Revisá los valores y confirmá para aplicarlos.' : `${Object.keys(validationErrors).length} campo${Object.keys(validationErrors).length === 1 ? '' : 's'} requiere${Object.keys(validationErrors).length === 1 ? '' : 'n'} atención.`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />Descartar
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !canSave}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <TabsList className="grid h-20 w-full grid-cols-2 sm:h-10 sm:grid-cols-3 sm:w-[480px]">
          <TabsTrigger value="company"><Building2 />Empresa</TabsTrigger>
          <TabsTrigger value="operations"><ReceiptText />Operación</TabsTrigger>
          <TabsTrigger value="appearance"><Palette />Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="m-0 space-y-4">
          {/* Se guarda en website_settings.company_info, no en system_settings
              como el resto de esta pantalla: lo leen el onboarding y el sitio
              publico desde ahi. Ver BusinessTypeCard. */}
          <BusinessTypeCard />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidad y contacto empresarial</CardTitle>
              <CardDescription>Información utilizada en tickets, recibos y documentos generados por el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la empresa <span className="text-destructive">*</span></Label>
                  <Input id="companyName" value={settings.companyName} onChange={(event) => updateSetting('companyName', event.target.value)} aria-invalid={Boolean(validationErrors.companyName)} aria-describedby={validationErrors.companyName ? 'companyName-error' : undefined} />
                  <FieldError id="companyName-error" message={validationErrors.companyName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRuc">RUC o identificación fiscal</Label>
                  <Input id="companyRuc" value={settings.companyRuc} onChange={(event) => updateSetting('companyRuc', event.target.value)} placeholder="80012345-6" aria-invalid={Boolean(validationErrors.companyRuc)} aria-describedby={validationErrors.companyRuc ? 'companyRuc-error' : undefined} />
                  <FieldError id="companyRuc-error" message={validationErrors.companyRuc} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email empresarial <span className="text-destructive">*</span></Label>
                  <Input id="companyEmail" type="email" value={settings.companyEmail} onChange={(event) => updateSetting('companyEmail', event.target.value)} aria-invalid={Boolean(validationErrors.companyEmail)} aria-describedby={validationErrors.companyEmail ? 'companyEmail-error' : undefined} />
                  <FieldError id="companyEmail-error" message={validationErrors.companyEmail} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Teléfono empresarial</Label>
                  <Input id="companyPhone" value={settings.companyPhone} onChange={(event) => updateSetting('companyPhone', event.target.value)} placeholder="+595…" aria-invalid={Boolean(validationErrors.companyPhone)} aria-describedby={validationErrors.companyPhone ? 'companyPhone-error' : undefined} />
                  <FieldError id="companyPhone-error" message={validationErrors.companyPhone} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="companyAddress">Dirección empresarial</Label>
                  <Textarea id="companyAddress" value={settings.companyAddress} onChange={(event) => updateSetting('companyAddress', event.target.value)} rows={2} className="resize-none" aria-invalid={Boolean(validationErrors.companyAddress)} aria-describedby={validationErrors.companyAddress ? 'companyAddress-error' : undefined} />
                  <FieldError id="companyAddress-error" message={validationErrors.companyAddress} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input id="city" value={settings.city} onChange={(event) => updateSetting('city', event.target.value)} aria-invalid={Boolean(validationErrors.city)} aria-describedby={validationErrors.city ? 'city-error' : undefined} />
                  <FieldError id="city-error" message={validationErrors.city} />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">El contacto y responsable de cada sede se administran por separado.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/branches">Administrar sucursales<ExternalLink className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="m-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas y configuración regional</CardTitle>
              <CardDescription>Valores utilizados por POS, cálculos de IVA y fechas operativas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="currency">Moneda base</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Se utiliza para precios, caja, POS y comprobantes de la organización.</p>
                  </div>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => {
                      updateSetting('currency', value)
                      setCurrencyChangeConfirmed(false)
                    }}
                  >
                    <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Vista previa</p>
                      <p className="truncate text-sm font-semibold tabular-nums">{currencyPreview}</p>
                    </div>
                    <Badge variant="outline">{selectedCurrency.code}</Badge>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="setting-language">Idioma y formato regional</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Define separadores numéricos y el idioma preferido de la organización.</p>
                  </div>
                  <Select value={settings.language} onValueChange={(value) => updateSetting('language', value)}>
                    <SelectTrigger id="setting-language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          {language.name} - {language.locale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Formato seleccionado: {selectedLanguage.locale}. La interfaz general continúa en español;
                      inglés y portugués preparan el formato regional mientras se completa la traducción integral.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">IVA aplicado (%)</Label>
                  <Input id="taxRate" type="number" min="0" max="100" step="0.01" value={settings.taxRate} onChange={(event) => updateSetting('taxRate', event.target.value === '' ? 0 : Number(event.target.value))} aria-invalid={Boolean(validationErrors.taxRate)} aria-describedby={validationErrors.taxRate ? 'taxRate-error' : 'taxRate-help'} />
                  <FieldError id="taxRate-error" message={validationErrors.taxRate} />
                  {!validationErrors.taxRate ? <p id="taxRate-help" className="text-xs text-muted-foreground">El servidor vuelve a calcular este porcentaje al confirmar una venta.</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setting-timezone">Zona horaria</Label>
                  <Select value={settings.timeZone} onValueChange={(value) => updateSetting('timeZone', value)}>
                    <SelectTrigger id="setting-timezone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {timeZoneOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Determina cierres diarios, reportes y agrupaciones por fecha.</p>
                </div>
              </div>

              {currencyChanged ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Cambio de moneda pendiente</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Cambiar de {originalSettings.currency} a {settings.currency} no convierte precios, saldos,
                      cuotas ni ventas existentes. Como los históricos no guardan una moneda por operación,
                      también podrán mostrarse con el símbolo nuevo.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-destructive/30 bg-background/70 p-3 text-foreground">
                      <Checkbox
                        checked={currencyChangeConfirmed}
                        onCheckedChange={(checked) => setCurrencyChangeConfirmed(checked === true)}
                        aria-describedby="currency-change-confirmation"
                      />
                      <span id="currency-change-confirmation" className="text-sm leading-5">
                        Entiendo el impacto y revisé los precios y saldos antes de aplicar el cambio.
                      </span>
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}

              <Alert>
                <Globe />
                <AlertTitle>Impacto operativo</AlertTitle>
                <AlertDescription>
                  El IVA se aplica a nuevas operaciones. El cambio de idioma modifica el formato regional;
                  no traduce nombres, productos ni contenido escrito por la organización.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="m-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apariencia del panel</CardTitle>
              <CardDescription>El tema se previsualiza inmediatamente y se confirma al guardar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="setting-theme">Tema</Label>
                <Select value={settings.theme} onValueChange={handleThemeChange}>
                  <SelectTrigger id="setting-theme"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Oscuro</SelectItem>
                    <SelectItem value="system">Usar configuración del sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div>
                  <Label>Esquema de color</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Elegí un esquema consistente para botones, enlaces y estados destacados.</p>
                </div>
                <SystemColorSchemePicker value={settings.primaryColor} onChange={handleColorChange} labels={t.appearance.colorSchemes} footerText={t.appearance.colorSchemeFooter} />
                <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{selectedColorSchemeText.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedColorSchemeText.description}</p>
                  </div>
                  <Badge className="w-fit">Color principal</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
