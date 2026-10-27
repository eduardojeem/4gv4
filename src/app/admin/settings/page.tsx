'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ArrowRight,
  Building2,
  Check, Clock,
  Coins,
  Globe,
  Info, Loader2,
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
  Laptop
} from 'lucide-react'
import { toast } from 'sonner'
import { ExchangeRatesManager } from '@/components/dashboard/currency/ExchangeRatesManager'
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
import { BusinessProfileCard, type BusinessProfileActions } from '@/components/admin/settings/BusinessProfileCard'
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
import { REGIONAL_DEFAULT_COUNTRIES, normalizeCountryCode } from '@/lib/regional/contract'

type FieldErrors = Partial<Record<
  'companyName' | 'companyEmail' | 'companyPhone' | 'companyRuc' | 'companyAddress' | 'city' | 'taxRate',
  string
>>

type SettingsTab = 'company' | 'operations' | 'appearance'

const HASH_BY_TAB: Record<SettingsTab, string> = {
  company: 'empresa',
  operations: 'operacion',
  appearance: 'apariencia',
}

const TAB_BY_HASH: Record<string, SettingsTab | undefined> = {
  empresa: 'company',
  operacion: 'operations',
  apariencia: 'appearance',
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="text-xs font-medium text-destructive mt-1" role="alert">{message}</p>
}

export default function AdminSettingsPage() {
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
    scope,
  } = useSharedSettings()
  const { loading: authLoading } = useAuth()
  const { theme: activeTheme, colorScheme: activeColorScheme, setTheme, setColorScheme } = useTheme()
  const t = getAdminSettingsText('es')
  const [activeTab, setActiveTab] = useState<SettingsTab>('company')

  // La pestaña va en la direccion (#empresa, #operacion, #apariencia): al
  // recargar se vuelve a la misma. Los enlaces «Tipo de cambio» del resto del
  // panel llegan con #monedas, que vive en Operacion.
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const fromHash = hash === 'monedas' ? 'operations' : TAB_BY_HASH[hash]
    if (!fromHash) return
    const timer = window.setTimeout(() => {
      setActiveTab(fromHash)
      if (hash === 'monedas') {
        window.setTimeout(() => document.getElementById('monedas')?.scrollIntoView({ behavior: 'smooth' }), 150)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const changeTab = (value: string) => {
    const tab = value as SettingsTab
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${HASH_BY_TAB[tab]}`)
  }
  const [currencyChangeConfirmed, setCurrencyChangeConfirmed] = useState(false)

  // Los errores se muestran recien cuando se toca el campo o se intenta
  // guardar: antes una organizacion sin email entraba con el campo en rojo.
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const touch = (field: keyof FieldErrors) => setTouched((current) => current[field] ? current : { ...current, [field]: true })

  const validationErrors = useMemo<FieldErrors>(() => {
    const next: FieldErrors = {}
    const name = settings.companyName.trim()
    const email = settings.companyEmail.trim()
    if (!name) next.companyName = 'Ingresá el nombre de la empresa.'
    else if (name.length > 100) next.companyName = 'El nombre no puede superar 100 caracteres.'
    // El email es opcional: solo se valida el formato si se cargó.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.companyEmail = 'Ingresá un email válido.'
    if (settings.companyPhone.length > 50) next.companyPhone = 'El teléfono no puede superar 50 caracteres.'
    if (settings.companyRuc.length > 50) next.companyRuc = 'El RUC no puede superar 50 caracteres.'
    if (settings.companyAddress.length > 500) next.companyAddress = 'La dirección no puede superar 500 caracteres.'
    if (settings.city.length > 100) next.city = 'La ciudad no puede superar 100 caracteres.'
    if (!Number.isFinite(settings.taxRate)) {
      next.taxRate = 'Ingresá la tasa de IVA (0 si no corresponde).'
    } else if (settings.taxRate < 0 || settings.taxRate > 100) {
      next.taxRate = 'El IVA debe estar entre 0 y 100%.'
    }
    return next
  }, [settings])
  const visibleError = (field: keyof FieldErrors) =>
    touched[field] || submitAttempted ? validationErrors[field] : undefined
  const errorCount = Object.keys(validationErrors).length

  // El perfil del negocio guarda por su cuenta, pero sus cambios cuentan como
  // pendientes y se guardan o descartan desde la misma barra.
  const profileActionsRef = useRef<BusinessProfileActions | null>(null)
  const [profileState, setProfileState] = useState({ dirty: false, canSave: false })
  const handleProfileState = useCallback((state: { dirty: boolean; canSave: boolean }) => {
    setProfileState((current) => current.dirty === state.dirty && current.canSave === state.canSave ? current : state)
  }, [])

  const currencyChanged = settings.currency !== originalSettings.currency
  const settingsCanSave = errorCount === 0 && (!currencyChanged || currencyChangeConfirmed)
  const hasPendingChanges = hasChanges || profileState.dirty
  const canSave = (!hasChanges || settingsCanSave) && (!profileState.dirty || profileState.canSave)
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
  ), [settings, originalSettings]) + (profileState.dirty ? 1 : 0)

  useEffect(() => {
    if (!hasPendingChanges) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasPendingChanges])

  // Apariencia es una preferencia de cada persona: se aplica al instante y
  // queda en este navegador. Antes se guardaba como dato de la organizacion,
  // pero el panel nunca lo leia: no le llegaba a nadie mas y la pagina podia
  // marcar un tema distinto del que se veia.
  const handleThemeChange = (value: string) => {
    setTheme(value as 'light' | 'dark' | 'system')
  }

  const handleColorChange = (value: SystemColorScheme) => {
    setColorScheme(value)
  }

  const handleSave = async () => {
    setSubmitAttempted(true)
    if (!canSave) {
      if (hasChanges && !settingsCanSave) {
        changeTab(validationErrors.taxRate || currencyChanged ? 'operations' : 'company')
        toast.error(currencyChanged && !currencyChangeConfirmed
          ? 'Confirmá el impacto del cambio de moneda antes de guardar.'
          : 'Revisá los campos marcados antes de guardar.')
      } else {
        changeTab('company')
        toast.error('Revisá el perfil del negocio antes de guardar.')
      }
      return
    }
    if (hasChanges) {
      const result = await saveSettings({ confirmCurrencyChange: currencyChangeConfirmed })
      if (!result.success) {
        toast.error(result.error || t.saveError)
        return
      }
      setCurrencyChangeConfirmed(false)
      setSubmitAttempted(false)
      setTouched({})
      toast.success(t.saved)
    }
    // El perfil avisa por su cuenta si se guardo o no.
    if (profileState.dirty) await profileActionsRef.current?.save()
  }

  // Ctrl+S / Cmd+S para guardar.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (hasPendingChanges && canSave && !isSaving) {
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const handleReset = () => {
    resetSettings()
    profileActionsRef.current?.reset()
    setCurrencyChangeConfirmed(false)
    setSubmitAttempted(false)
    setTouched({})
    toast.info(t.discarded)
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {authLoading ? t.loadingAuth : t.loadingSettings}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Sincronizando preferencias del sistema...</p>
          </div>
        </div>
      </div>
    )
  }

  // Antes se redirigia a todo superadmin a /superadmin/settings, aunque
  // estuviera dentro de su organizacion y quisiera configurar su empresa. Ahora
  // se lo manda a la global solo si no forma parte de ninguna, y se dice por que.
  if (scope === 'platform') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">No estás dentro de ninguna organización</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Esta pantalla configura los datos de una empresa: nombre, RUC, impuestos y moneda. Tu cuenta de
                  superadmin no forma parte del equipo de ninguna, así que acá no hay nada que configurar.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/superadmin/settings">Ir a la configuración de la plataforma</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/superadmin/organizations">Ver organizaciones</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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

  const activeSystemColorScheme = isSystemColorScheme(activeColorScheme) ? activeColorScheme : DEFAULT_SYSTEM_COLOR_SCHEME
  const selectedColorScheme = getSystemColorSchemeOption(activeSystemColorScheme)
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Configuración de la organización
              </h1>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Datos de la empresa, impuestos, moneda y formato regional.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra flotante de cambios pendientes */}
      {hasPendingChanges ? (
        <div className="sticky top-4 z-30 flex flex-col gap-3 rounded-xl border border-primary/30 bg-background/90 p-4 shadow-xl backdrop-blur-md transition-all sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {changedFields} cambio{changedFields === 1 ? '' : 's'} sin guardar
              </p>
              <p className="text-xs text-muted-foreground">
                {canSave
                  ? 'Revisá los valores y guardá para aplicarlos (Ctrl + S).'
                  : errorCount > 0
                    ? `${errorCount} campo${errorCount === 1 ? '' : 's'} requiere${errorCount === 1 ? '' : 'n'} atención.`
                    : currencyChanged && !currencyChangeConfirmed
                      ? 'Falta confirmar el cambio de moneda.'
                      : 'Revisá el perfil del negocio.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving} className="h-9">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving} className="h-9 px-4 shadow-sm">
              {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
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
        {/* Conservar el borrador del perfil y sus acciones al cambiar de pestaña. */}
        <TabsContent value="company" forceMount className="m-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden">
          {/* Business Profile Component */}
          <BusinessProfileCard onStateChange={handleProfileState} actionsRef={profileActionsRef} />

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
                      onBlur={() => touch('companyName')}
                      placeholder="Ej: Innova Tech S.A."
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyName'))}
                      aria-describedby={visibleError('companyName') ? 'companyName-error' : undefined}
                    />
                    <FieldError id="companyName-error" message={visibleError('companyName')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyRuc" className="text-xs font-medium text-foreground">
                      RUC o identificación fiscal
                    </Label>
                    <Input
                      id="companyRuc"
                      value={settings.companyRuc}
                      onChange={(event) => updateSetting('companyRuc', event.target.value)}
                      onBlur={() => touch('companyRuc')}
                      placeholder="Ej: 80012345-6"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyRuc'))}
                      aria-describedby={visibleError('companyRuc') ? 'companyRuc-error' : undefined}
                    />
                    <FieldError id="companyRuc-error" message={visibleError('companyRuc')} />
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
                      Email empresarial
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={settings.companyEmail}
                      onChange={(event) => updateSetting('companyEmail', event.target.value)}
                      onBlur={() => touch('companyEmail')}
                      placeholder="contacto@miempresa.com"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyEmail'))}
                      aria-describedby={visibleError('companyEmail') ? 'companyEmail-error' : undefined}
                    />
                    <FieldError id="companyEmail-error" message={visibleError('companyEmail')} />
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
                      onBlur={() => touch('companyPhone')}
                      placeholder="+595 21 000 000"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyPhone'))}
                      aria-describedby={visibleError('companyPhone') ? 'companyPhone-error' : undefined}
                    />
                    <FieldError id="companyPhone-error" message={visibleError('companyPhone')} />
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
                      onBlur={() => touch('companyAddress')}
                      rows={2}
                      placeholder="Avda. Principal 1234, Edificio Central"
                      className="resize-none"
                      aria-invalid={Boolean(visibleError('companyAddress'))}
                      aria-describedby={visibleError('companyAddress') ? 'companyAddress-error' : undefined}
                    />
                    <FieldError id="companyAddress-error" message={visibleError('companyAddress')} />
                  </div>

                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="city" className="text-xs font-medium text-foreground">
                      Ciudad / Localidad
                    </Label>
                    <Input
                      id="city"
                      value={settings.city}
                      onChange={(event) => updateSetting('city', event.target.value)}
                      onBlur={() => touch('city')}
                      placeholder="Ej: Asunción"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('city'))}
                      aria-describedby={visibleError('city') ? 'city-error' : undefined}
                    />
                    <FieldError id="city-error" message={visibleError('city')} />
                  </div>
                </div>
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
              {settings.needsCountryConfirmation ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <Label htmlFor="setting-country" className="text-sm font-semibold">Confirmá el país de tu negocio</Label>
                <p className="mt-1 text-xs">Esta confirmación regional es opcional. No convierte precios ni modifica operaciones existentes.</p>
                <Select value={settings.countryCode ?? ''} onValueChange={(value) => updateSetting('countryCode', normalizeCountryCode(value))}>
                  <SelectTrigger id="setting-country" className="mt-3 h-10 bg-background"><SelectValue placeholder="Seleccioná un país" /></SelectTrigger>
                  <SelectContent>
                    {REGIONAL_DEFAULT_COUNTRIES.map((country) => <SelectItem key={country} value={country}>{country === 'PY' ? 'Paraguay' : country === 'BR' ? 'Brasil' : country === 'AR' ? 'Argentina' : 'Estados Unidos'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div> : null}
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
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Formato en POS y comprobantes
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
                      Formato regional
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Define los separadores de miles y decimales y el formato de las fechas.
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
                      Formato elegido: <strong className="text-foreground">{selectedLanguage.locale}</strong>. Cambia cómo se ven números y fechas; los textos del panel siguen en español.
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
                      Tasa general de IVA (%)
                    </Label>
                    {Number.isFinite(settings.taxRate) ? (
                      <Badge variant="secondary" className="text-xs font-mono font-normal">
                        {settings.taxRate}%
                      </Badge>
                    ) : null}
                  </div>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Number.isFinite(settings.taxRate) ? settings.taxRate : ''}
                    // Vacio no es 0: antes borrar el campo guardaba 0% sin avisar.
                    onChange={(event) => updateSetting('taxRate', event.target.value === '' ? Number.NaN : Number(event.target.value))}
                    onBlur={() => touch('taxRate')}
                    className="h-10"
                    aria-invalid={Boolean(visibleError('taxRate'))}
                    aria-describedby={visibleError('taxRate') ? 'taxRate-error' : 'taxRate-help'}
                  />
                  <FieldError id="taxRate-error" message={visibleError('taxRate')} />
                  {!visibleError('taxRate') ? (
                    <p id="taxRate-help" className="text-xs text-muted-foreground leading-relaxed">
                      Se aplica a todas las ventas y presupuestos nuevos. Es una sola tasa: todavía no se pueden combinar 10% y 5% en una misma venta.
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
                  <p className="text-xs text-muted-foreground leading-relaxed">
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
                    El IVA y el formato regional se aplican a lo nuevo: no modifican ventas ya emitidas ni los nombres de productos y textos que cargaste.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="monedas" className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">Monedas y tipo de cambio</CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Para poner precios en dólares u otra moneda y que se conviertan solos a tu moneda.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ExchangeRatesManager />
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
                    Apariencia del panel
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Es tu preferencia personal: se aplica al instante y queda en este navegador. Cada persona del equipo elige la suya.
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
                    { value: 'light', label: 'Modo claro', desc: 'Fondo blanco y contrastes nítidos', icon: Sun },
                    { value: 'dark', label: 'Modo oscuro', desc: 'Tonos oscuros que descansan la vista', icon: Moon },
                    { value: 'system', label: 'Según el dispositivo', desc: 'Sigue el modo de tu equipo', icon: Laptop },
                  ].map((item) => {
                    const isSelected = activeTheme === item.value
                    const Icon = item.icon
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleThemeChange(item.value)}
                        aria-pressed={isSelected}
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
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
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
                      Color principal
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
                  value={activeSystemColorScheme}
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
                    Vista previa
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Así se ven los botones y etiquetas del panel con lo que elegiste:
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="sm" className="shadow-sm">Botón principal</Button>
                  <Button variant="outline" size="sm">Botón secundario</Button>
                  <Badge className="bg-primary text-primary-foreground">Etiqueta activa</Badge>
                  <Badge variant="secondary">Estado neutral</Badge>
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
                Dirección, contacto, cajas y responsables de cada sucursal.
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
                Sitio web y tienda
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
                Suscripción y plan
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
                Seguridad y sesiones
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
