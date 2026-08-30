'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Moon,
  Palette,
  Percent,
  Phone,
  ReceiptText,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Laptop,
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
import { BusinessProfileCard } from '@/components/admin/settings/BusinessProfileCard'
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
import { cn } from '@/lib/utils'

type FieldErrors = Partial<Record<
  'companyName' | 'companyEmail' | 'companyPhone' | 'companyRuc' | 'companyAddress' | 'city' | 'taxRate',
  string
>>

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="text-xs font-medium text-destructive mt-1" role="alert">{message}</p>
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

  // Support Ctrl+S / Cmd+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (hasChanges && canSave && !isSaving) {
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

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
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {isSuperAdmin ? 'Abriendo configuración global…' : authLoading ? t.loadingAuth : t.loadingSettings}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Sincronizando preferencias del sistema...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">No se pudo cargar la configuración</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void reloadSettings()} className="mt-2 gap-2">
              <RotateCcw className="h-3.5 w-3.5" /> Reintentar
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
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/[0.03] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Configuración de la organización
                </h1>
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Organización activa
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Datos empresariales, reglas de facturación, impuestos, moneda y apariencia del panel.
              </p>
            </div>
          </div>

          {hasChanges ? (
            <Badge variant="secondary" className="w-fit gap-1.5 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {changedFields} cambio{changedFields === 1 ? '' : 's'} pendiente{changedFields === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Barra flotante de cambios pendientes */}
      {hasChanges ? (
        <div className="sticky top-4 z-30 flex flex-col gap-3 rounded-xl border border-primary/30 bg-background/90 p-4 shadow-xl backdrop-blur-md transition-all sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Cambios sin guardar</p>
              <p className="text-xs text-muted-foreground">
                {canSave
                  ? 'Revisá los valores y confirmá para aplicarlos (Ctrl + S).'
                  : `${Object.keys(validationErrors).length} campo${Object.keys(validationErrors).length === 1 ? '' : 's'} requiere${Object.keys(validationErrors).length === 1 ? '' : 'n'} atención.`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving} className="h-9">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !canSave} className="h-9 px-4 shadow-sm">
              {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-border/80 pb-3">
          <TabsList className="grid h-11 w-full grid-cols-3 sm:w-[480px] p-1 bg-muted/60 rounded-xl">
            <TabsTrigger value="company" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ReceiptText className="h-4 w-4" />
              Operación
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: EMPRESA */}
        <TabsContent value="company" className="m-0 space-y-6 focus-visible:outline-none">
          {/* Business Profile Component */}
          <BusinessProfileCard />

          {/* Información Legal y Facturación */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Identidad y contacto empresarial
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Información utilizada en tickets, recibos, presupuestos y documentos generados por el sistema.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              {/* Sección 1: Datos Principales */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Identificación fiscal y razón social</span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-xs font-medium text-foreground flex items-center gap-1">
                      Nombre de la empresa <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="companyName"
                      value={settings.companyName}
                      onChange={(event) => updateSetting('companyName', event.target.value)}
                      placeholder="Ej: Innova Tech S.A."
                      className="h-10"
                      aria-invalid={Boolean(validationErrors.companyName)}
                      aria-describedby={validationErrors.companyName ? 'companyName-error' : undefined}
                    />
                    <FieldError id="companyName-error" message={validationErrors.companyName} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyRuc" className="text-xs font-medium text-foreground">
                      RUC o identificación fiscal
                    </Label>
                    <Input
                      id="companyRuc"
                      value={settings.companyRuc}
                      onChange={(event) => updateSetting('companyRuc', event.target.value)}
                      placeholder="Ej: 80012345-6"
                      className="h-10"
                      aria-invalid={Boolean(validationErrors.companyRuc)}
                      aria-describedby={validationErrors.companyRuc ? 'companyRuc-error' : undefined}
                    />
                    <FieldError id="companyRuc-error" message={validationErrors.companyRuc} />
                  </div>
                </div>
              </div>

              {/* Sección 2: Canales de Contacto */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Canales de contacto corporativo</span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email empresarial <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={settings.companyEmail}
                      onChange={(event) => updateSetting('companyEmail', event.target.value)}
                      placeholder="contacto@miempresa.com"
                      className="h-10"
                      aria-invalid={Boolean(validationErrors.companyEmail)}
                      aria-describedby={validationErrors.companyEmail ? 'companyEmail-error' : undefined}
                    />
                    <FieldError id="companyEmail-error" message={validationErrors.companyEmail} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyPhone" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      Teléfono empresarial
                    </Label>
                    <Input
                      id="companyPhone"
                      value={settings.companyPhone}
                      onChange={(event) => updateSetting('companyPhone', event.target.value)}
                      placeholder="+595 21 000 000"
                      className="h-10"
                      aria-invalid={Boolean(validationErrors.companyPhone)}
                      aria-describedby={validationErrors.companyPhone ? 'companyPhone-error' : undefined}
                    />
                    <FieldError id="companyPhone-error" message={validationErrors.companyPhone} />
                  </div>
                </div>
              </div>

              {/* Sección 3: Ubicación */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Ubicación y domicilio central</span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="companyAddress" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      Dirección empresarial
                    </Label>
                    <Textarea
                      id="companyAddress"
                      value={settings.companyAddress}
                      onChange={(event) => updateSetting('companyAddress', event.target.value)}
                      rows={2}
                      placeholder="Avda. Principal 1234, Edificio Central"
                      className="resize-none"
                      aria-invalid={Boolean(validationErrors.companyAddress)}
                      aria-describedby={validationErrors.companyAddress ? 'companyAddress-error' : undefined}
                    />
                    <FieldError id="companyAddress-error" message={validationErrors.companyAddress} />
                  </div>

                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="city" className="text-xs font-medium text-foreground">
                      Ciudad / Localidad
                    </Label>
                    <Input
                      id="city"
                      value={settings.city}
                      onChange={(event) => updateSetting('city', event.target.value)}
                      placeholder="Ej: Asunción"
                      className="h-10"
                      aria-invalid={Boolean(validationErrors.city)}
                      aria-describedby={validationErrors.city ? 'city-error' : undefined}
                    />
                    <FieldError id="city-error" message={validationErrors.city} />
                  </div>
                </div>
              </div>

              {/* Banner Sucursales */}
              <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">¿Tenés múltiples puntos de venta?</p>
                    <p className="text-xs text-muted-foreground">El contacto, dirección y encargado de cada sucursal se gestionan por separado.</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs">
                  <Link href="/admin/branches">
                    Administrar sucursales <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: OPERACIÓN */}
        <TabsContent value="operations" className="m-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Ventas y configuración regional
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Valores aplicados a cálculos del Punto de Venta (POS), tasas impositivas y formato de fechas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              {/* Bloque Moneda e Idioma */}
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Moneda Base */}
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-xs font-semibold text-foreground">
                      Moneda base de la organización
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Se utiliza para definir precios, operaciones de caja, ventas en POS y reportes contables.
                    </p>
                    <Select
                      value={settings.currency}
                      onValueChange={(value) => {
                        updateSetting('currency', value)
                        setCurrencyChangeConfirmed(false)
                      }}
                    >
                      <SelectTrigger id="currency" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} — {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vista Previa de Precio */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Formato en POS y Comprobantes
                        </span>
                        <p className="text-base font-bold tabular-nums text-foreground mt-0.5">
                          {currencyPreview}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-primary/30 bg-background text-primary font-mono text-xs">
                        {selectedCurrency.code}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Idioma y Formato */}
                <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="setting-language" className="text-xs font-semibold text-foreground">
                      Idioma y formato regional
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Define separadores numéricos (miles, decimales) y formato general de fechas.
                    </p>
                    <Select
                      value={settings.language}
                      onValueChange={(value) => updateSetting('language', value)}
                    >
                      <SelectTrigger id="setting-language" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            {language.name} ({language.locale})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="leading-relaxed">
                      Formato regional: <strong className="text-foreground">{selectedLanguage.locale}</strong>. La interfaz general continúa en español mientras se despliega la traducción multilenguaje integral.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloque Impuestos y Zona Horaria */}
              <div className="grid gap-5 sm:grid-cols-2">
                {/* IVA */}
                <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="taxRate" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-primary" />
                      Tasa de IVA aplicada (%)
                    </Label>
                    <Badge variant="secondary" className="text-xs font-mono font-normal">
                      {settings.taxRate}%
                    </Badge>
                  </div>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.taxRate}
                    onChange={(event) => updateSetting('taxRate', event.target.value === '' ? 0 : Number(event.target.value))}
                    className="h-10"
                    aria-invalid={Boolean(validationErrors.taxRate)}
                    aria-describedby={validationErrors.taxRate ? 'taxRate-error' : 'taxRate-help'}
                  />
                  <FieldError id="taxRate-error" message={validationErrors.taxRate} />
                  {!validationErrors.taxRate ? (
                    <p id="taxRate-help" className="text-[11px] text-muted-foreground leading-relaxed">
                      El servidor recalcula este porcentaje automáticamente al confirmar cada venta en caja.
                    </p>
                  ) : null}
                </div>

                {/* Zona Horaria */}
                <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
                  <Label htmlFor="setting-timezone" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Zona horaria
                  </Label>
                  <Select value={settings.timeZone} onValueChange={(value) => updateSetting('timeZone', value)}>
                    <SelectTrigger id="setting-timezone" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeZoneOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Determina la fecha de los cierres diarios de caja, reportes y métricas analíticas.
                  </p>
                </div>
              </div>

              {/* Alerta si cambia de moneda */}
              {currencyChanged ? (
                <Alert variant="destructive" className="rounded-xl border-destructive/40 bg-destructive/5 shadow-sm">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="font-semibold">Cambio de moneda pendiente de confirmación</AlertTitle>
                  <AlertDescription className="mt-2 space-y-3 text-xs leading-relaxed">
                    <p>
                      Cambiar de <strong className="font-bold">{originalSettings.currency}</strong> a <strong className="font-bold">{settings.currency}</strong> no convierte automáticamente precios existentes, deudas ni registros contables anteriores. Los datos históricos pasarán a representarse con el nuevo símbolo monetario.
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/30 bg-background/80 p-3 text-foreground transition-colors hover:bg-background">
                      <Checkbox
                        checked={currencyChangeConfirmed}
                        onCheckedChange={(checked) => setCurrencyChangeConfirmed(checked === true)}
                        aria-describedby="currency-change-confirmation"
                        className="mt-0.5"
                      />
                      <span id="currency-change-confirmation" className="text-xs font-medium leading-5">
                        Entiendo el impacto en precios y saldos, y confirmo el cambio de moneda para esta organización.
                      </span>
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Alcance Operativo Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">Información sobre el alcance de cambios</p>
                  <p className="leading-relaxed">
                    El IVA se aplica a las nuevas ventas y cotizaciones emitidas. El cambio de idioma define formatos numéricos y calendarios pero no altera nombres de productos ni textos personalizados ingresados por los usuarios.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: APARIENCIA */}
        <TabsContent value="appearance" className="m-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Apariencia y tema del panel
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Personalizá el modo de visualización y el esquema cromático corporativo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              {/* Selector Visual de Tema */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-foreground">
                  Modo de visualización
                </Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: 'light', label: 'Modo Claro', desc: 'Fondo blanco y contrastes nítidos', icon: Sun },
                    { value: 'dark', label: 'Modo Oscuro', desc: 'Tonos oscuros que descansan la vista', icon: Moon },
                    { value: 'system', label: 'Configuración del sistema', desc: 'Se sincroniza con tu dispositivo', icon: Laptop },
                  ].map((item) => {
                    const isSelected = settings.theme === item.value
                    const Icon = item.icon
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleThemeChange(item.value)}
                        className={cn(
                          'flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all',
                          'hover:border-primary/50 hover:bg-muted/30',
                          isSelected
                            ? 'border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/20'
                            : 'border-border/80 bg-card'
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Selector de Esquema Cromático */}
              <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Esquema cromático corporativo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Define el color de botones principales, estados activos, enlaces y gráficos.
                    </p>
                  </div>
                  <Badge className="w-fit text-xs font-normal">
                    {selectedColorSchemeText.label}
                  </Badge>
                </div>

                <SystemColorSchemePicker
                  value={settings.primaryColor}
                  onChange={handleColorChange}
                  labels={t.appearance.colorSchemes}
                  footerText={t.appearance.colorSchemeFooter}
                />
              </div>

              {/* Sandbox de Previsualización en Vivo */}
              <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Vista previa de componentes activos
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Así se verán los botones, badges y controles en tu panel con la configuración seleccionada:
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="sm" className="shadow-sm">Botón Principal</Button>
                  <Button variant="outline" size="sm">Botón Secundario</Button>
                  <Badge className="bg-primary text-primary-foreground">Badge Activo</Badge>
                  <Badge variant="secondary">Estado Neutral</Badge>
                  <span className="text-xs font-semibold text-primary underline underline-offset-4 cursor-pointer">
                    Enlace destacado
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hub de Accesos Directos a Otras Secciones de Administración */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Otras áreas de configuración administrativa</span>
          <span className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/branches"
            className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Sucursales
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gestión de sedes, cajas, direcciones y responsables.
              </p>
            </div>
            <span className="mt-3 flex items-center text-xs font-medium text-primary">
              Administrar <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            href="/admin/website"
            className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Sitio Web & Tienda
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Diseño, banners, catálogo público y páginas editoriales.
              </p>
            </div>
            <span className="mt-3 flex items-center text-xs font-medium text-primary">
              Personalizar <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            href="/admin/subscriptions"
            className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ReceiptText className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Suscripción & Plan
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Planes contratados, facturas, límites y formas de pago.
              </p>
            </div>
            <span className="mt-3 flex items-center text-xs font-medium text-primary">
              Ver plan <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            href="/admin/security"
            className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Seguridad & Sesiones
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control de accesos, registros de auditoría y políticas de seguridad.
              </p>
            </div>
            <span className="mt-3 flex items-center text-xs font-medium text-primary">
              Configurar <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
