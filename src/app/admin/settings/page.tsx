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
  Laptop,
  Wand2,
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
import { SettingsSetupCard, type SettingsSetupStatus, type SettingsTarget } from '@/components/admin/settings/SettingsSetupCard'
import { AdminMfaPolicyCard } from '@/components/admin/security/admin-mfa-policy-card'
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
  isSupportedCurrency,
} from '@/lib/currency'
import { cn } from '@/lib/utils'
import { REGIONAL_DEFAULT_COUNTRIES, normalizeCountryCode } from '@/lib/regional/contract'
import { REGIONAL_COUNTRY_LABELS, countryLabel, localeForRegion, regionalSuggestion } from '@/lib/regional/country-labels'

type FieldErrors = Partial<Record<
  'companyName' | 'companyEmail' | 'companyPhone' | 'companyRuc' | 'companyAddress' | 'city' | 'taxRate',
  string
>>

type SettingsTab = SettingsTarget | 'appearance'

const HASH_BY_TAB: Record<SettingsTab, string> = {
  negocio: 'negocio',
  fiscal: 'fiscal',
  rubro: 'rubro',
  appearance: 'apariencia',
}

// Los enlaces viejos del resto del panel (#empresa, #operacion, #monedas)
// siguen llevando a donde estaba cada cosa.
const TAB_BY_HASH: Record<string, SettingsTab | undefined> = {
  negocio: 'negocio',
  empresa: 'negocio',
  fiscal: 'fiscal',
  operacion: 'fiscal',
  monedas: 'fiscal',
  rubro: 'rubro',
  apariencia: 'appearance',
}

/** Qué pestaña tiene cada campo, para llevar al dueño a lo que falta o está mal. */
const TAB_BY_FIELD: Record<keyof FieldErrors, SettingsTarget> = {
  companyName: 'negocio',
  companyEmail: 'negocio',
  companyPhone: 'negocio',
  companyAddress: 'negocio',
  city: 'negocio',
  companyRuc: 'fiscal',
  taxRate: 'fiscal',
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return <p id={id} className="text-xs font-medium text-destructive mt-1" role="alert">{message}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span>{children}</span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  )
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('negocio')

  // Lo que dejó el onboarding y lo que falta fuera de esta pantalla.
  const [setupStatus, setSetupStatus] = useState<SettingsSetupStatus | null>(null)
  const loadSetupStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings/setup-status', { cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.success) setSetupStatus(body.data as SettingsSetupStatus)
    } catch {
      // Opcional: sin esto la tarjeta muestra solo los datos de esta pantalla.
    }
  }, [])
  useEffect(() => {
    if (scope !== 'organization') return
    const timer = window.setTimeout(() => void loadSetupStatus(), 0)
    return () => window.clearTimeout(timer)
  }, [scope, loadSetupStatus])

  // La pestaña va en la dirección (#negocio, #fiscal, #rubro, #apariencia): al
  // recargar se vuelve a la misma. Los enlaces «Tipo de cambio» del resto del
  // panel llegan con #monedas, que vive en Fiscal y región.
  useEffect(() => {
    let timer: number | undefined
    const applyHash = () => {
      const hash = window.location.hash.slice(1)
      const fromHash = TAB_BY_HASH[hash]
      if (!fromHash) return
      timer = window.setTimeout(() => {
        setActiveTab(fromHash)
        if (hash === 'monedas') {
          window.setTimeout(() => document.getElementById('monedas')?.scrollIntoView({ behavior: 'smooth' }), 150)
        }
      }, 0)
    }
    applyHash()
    // Un enlace a otra pestaña desde la misma página solo cambia el ancla.
    window.addEventListener('hashchange', applyHash)
    return () => {
      window.removeEventListener('hashchange', applyHash)
      window.clearTimeout(timer)
    }
  }, [])

  const changeTab = (value: string) => {
    const tab = value as SettingsTab
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${HASH_BY_TAB[tab]}`)
  }

  // Desde la tarjeta «Tu negocio»: abre la pestaña y deja el cursor en el campo.
  const goTo = (tab: SettingsTarget, field?: string) => {
    changeTab(tab)
    window.setTimeout(() => {
      const target = field ? document.getElementById(field) : document.getElementById('settings-tabs')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (target instanceof HTMLElement && field) target.focus({ preventScroll: true })
    }, 80)
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
    if (!name) next.companyName = 'Ingresá el nombre de tu negocio.'
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
  // Sin productos ni ventas no hay importes que el cambio afecte: no se pide
  // confirmar nada, como en el onboarding.
  const currencyChangeIsHarmless = setupStatus?.hasBusinessData === false
  const currencyConfirmed = currencyChangeConfirmed || currencyChangeIsHarmless
  const settingsCanSave = errorCount === 0 && (!currencyChanged || currencyConfirmed)
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
      // El locale se deriva del idioma y el país: no es un cambio aparte.
      if (key === 'locale') return count
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

  // El idioma de los formatos y el país forman el `locale` que guardó el
  // onboarding (es-PY): se actualiza junto con cualquiera de los dos.
  const changeCountry = (value: string) => {
    const country = normalizeCountryCode(value)
    updateSetting('countryCode', country)
    updateSetting('locale', localeForRegion(settings.language, country))
  }
  const changeLanguage = (value: string) => {
    updateSetting('language', value)
    updateSetting('locale', localeForRegion(value, settings.countryCode))
  }
  const changeCurrency = (value: string) => {
    updateSetting('currency', value)
    setCurrencyChangeConfirmed(false)
  }

  const suggestion = regionalSuggestion(settings.countryCode)
  const suggestionDiffers = Boolean(suggestion && (
    (isSupportedCurrency(suggestion.currency) && suggestion.currency !== settings.currency)
    || (suggestion.timeZone && suggestion.timeZone !== settings.timeZone)
    || suggestion.language !== settings.language
  ))
  const applySuggestion = () => {
    if (!suggestion) return
    if (isSupportedCurrency(suggestion.currency) && suggestion.currency !== settings.currency) changeCurrency(suggestion.currency)
    if (suggestion.timeZone) updateSetting('timeZone', suggestion.timeZone)
    changeLanguage(suggestion.language)
  }

  const handleSave = async () => {
    setSubmitAttempted(true)
    if (!canSave) {
      if (hasChanges && !settingsCanSave) {
        const firstError = (Object.keys(validationErrors) as Array<keyof FieldErrors>)[0]
        changeTab(firstError ? TAB_BY_FIELD[firstError] : 'fiscal')
        toast.error(!firstError && currencyChanged && !currencyConfirmed
          ? 'Confirmá el impacto del cambio de moneda antes de guardar.'
          : 'Revisá los campos marcados antes de guardar.')
      } else {
        changeTab('rubro')
        toast.error('Revisá el rubro y las herramientas antes de guardar.')
      }
      return
    }
    if (hasChanges) {
      const result = await saveSettings({ confirmCurrencyChange: currencyConfirmed })
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
    void loadSetupStatus()
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
            <p className="mt-1 text-xs text-muted-foreground">Trayendo los datos de tu negocio…</p>
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
  // Una zona que no está en la lista (la guardó el onboarding o la app) se
  // muestra igual: antes el desplegable quedaba en blanco.
  const timeZoneOptions: Array<[string, string]> = Object.entries(t.regional.timeZones)
  if (settings.timeZone && !timeZoneOptions.some(([value]) => value === settings.timeZone)) {
    timeZoneOptions.unshift([settings.timeZone, settings.timeZone.replace(/_/g, ' ')])
  }
  const branchName = setupStatus?.branch?.name

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/[0.03] p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Configuración
            </h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Los datos de tu negocio, impuestos, moneda y las herramientas que usás.
            </p>
          </div>
        </div>
      </div>

      <SettingsSetupCard saved={originalSettings} status={setupStatus} onGoTo={goTo} />

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
                    : currencyChanged && !currencyConfirmed
                      ? 'Falta confirmar el cambio de moneda.'
                      : 'Revisá el rubro y las herramientas.'}
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
      <Tabs id="settings-tabs" value={activeTab} onValueChange={changeTab} className="space-y-6">
        <div className="border-b border-border/80 pb-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl sm:h-11 sm:grid-cols-4">
            <TabsTrigger value="negocio" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Store className="h-4 w-4" />
              Negocio
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ReceiptText className="h-4 w-4" />
              Fiscal y región
            </TabsTrigger>
            <TabsTrigger value="rubro" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Building2 className="h-4 w-4" />
              Rubro y herramientas
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: NEGOCIO */}
        <TabsContent value="negocio" className="m-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Datos del negocio
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Aparecen en tus tickets, recibos y presupuestos, y en la ficha de tu tienda online.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-xs font-medium text-foreground flex items-center gap-1">
                  Nombre del negocio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(event) => updateSetting('companyName', event.target.value)}
                  onBlur={() => touch('companyName')}
                  placeholder="Ej: Innova Tech"
                  className="h-10"
                  aria-invalid={Boolean(visibleError('companyName'))}
                  aria-describedby={visibleError('companyName') ? 'companyName-error' : 'companyName-help'}
                />
                <FieldError id="companyName-error" message={visibleError('companyName')} />
                {!visibleError('companyName') ? (
                  <p id="companyName-help" className="text-xs text-muted-foreground">Es el nombre que ven tus clientes en los tickets y en tu tienda.</p>
                ) : null}
              </div>

              <div className="space-y-4">
                <SectionHeading>Cómo te contactan</SectionHeading>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      Teléfono o WhatsApp
                    </Label>
                    <Input
                      id="companyPhone"
                      value={settings.companyPhone}
                      onChange={(event) => updateSetting('companyPhone', event.target.value)}
                      onBlur={() => touch('companyPhone')}
                      placeholder="+595 981 000 000"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyPhone'))}
                      aria-describedby={visibleError('companyPhone') ? 'companyPhone-error' : undefined}
                    />
                    <FieldError id="companyPhone-error" message={visibleError('companyPhone')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyEmail" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={settings.companyEmail}
                      onChange={(event) => updateSetting('companyEmail', event.target.value)}
                      onBlur={() => touch('companyEmail')}
                      placeholder="contacto@minegocio.com"
                      className="h-10"
                      aria-invalid={Boolean(visibleError('companyEmail'))}
                      aria-describedby={visibleError('companyEmail') ? 'companyEmail-error' : undefined}
                    />
                    <FieldError id="companyEmail-error" message={visibleError('companyEmail')} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeading>Dónde estás</SectionHeading>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="companyAddress" className="text-xs font-medium text-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      Dirección
                    </Label>
                    <Textarea
                      id="companyAddress"
                      value={settings.companyAddress}
                      onChange={(event) => updateSetting('companyAddress', event.target.value)}
                      onBlur={() => touch('companyAddress')}
                      rows={2}
                      placeholder="Avda. Principal 1234"
                      className="resize-none"
                      aria-invalid={Boolean(visibleError('companyAddress'))}
                      aria-describedby={visibleError('companyAddress') ? 'companyAddress-error' : undefined}
                    />
                    <FieldError id="companyAddress-error" message={visibleError('companyAddress')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs font-medium text-foreground">
                      Ciudad
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

              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="leading-relaxed">
                  El teléfono, la dirección y la ciudad son también los de tu sucursal principal{branchName ? <> (<strong className="text-foreground">{branchName}</strong>)</> : null} y los de tu tienda online: al guardar se actualizan ahí también.
                  {' '}¿Tenés más de un local? Cargalos en <Link href="/admin/branches" className="font-medium text-primary underline underline-offset-2">Sucursales</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FISCAL Y REGIÓN */}
        <TabsContent value="fiscal" className="m-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    País, impuestos y moneda
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Se usan en la caja, los comprobantes y los informes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              {/* País: siempre visible y editable; antes solo aparecía si faltaba. */}
              <div className={cn(
                'space-y-3 rounded-xl border p-4',
                settings.needsCountryConfirmation && !settings.countryCode
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-border/80 bg-card',
              )}>
                <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="setting-country" className="text-xs font-semibold">País del negocio</Label>
                    <Select value={settings.countryCode ?? ''} onValueChange={changeCountry}>
                      <SelectTrigger id="setting-country" className="h-10 bg-background"><SelectValue placeholder="Seleccioná un país" /></SelectTrigger>
                      <SelectContent>
                        {REGIONAL_DEFAULT_COUNTRIES.map((country) => <SelectItem key={country} value={country}>{REGIONAL_COUNTRY_LABELS[country]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {settings.countryCode
                      ? 'Define lo que te sugerimos para moneda, formato y zona horaria. Cambiarlo no convierte precios ni modifica ventas.'
                      : 'Todavía no confirmaste el país. Elegilo para que te sugiramos moneda, formato y zona horaria; no cambia nada de lo que ya cargaste.'}
                  </p>
                </div>
                {suggestion && suggestionDiffers ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      En {countryLabel(settings.countryCode)} lo habitual es {suggestion.currency}
                      {suggestion.timeZone ? ` y la hora de ${t.regional.timeZones[suggestion.timeZone as keyof typeof t.regional.timeZones] ?? suggestion.timeZone}` : ''}.
                    </span>
                    <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 bg-background text-xs" onClick={applySuggestion}>
                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Usar lo habitual
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <SectionHeading>Datos fiscales</SectionHeading>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyRuc" className="text-xs font-semibold text-foreground">
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
                      aria-describedby={visibleError('companyRuc') ? 'companyRuc-error' : 'companyRuc-help'}
                    />
                    <FieldError id="companyRuc-error" message={visibleError('companyRuc')} />
                    {!visibleError('companyRuc') ? (
                      <p id="companyRuc-help" className="text-xs text-muted-foreground">Sale impreso en tus tickets y comprobantes.</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taxRate" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Percent className="h-3.5 w-3.5 text-primary" />
                        IVA general (%)
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
                        {settings.countryCode === 'PY' ? 'En Paraguay la tasa general es 10%. ' : ''}
                        Se aplica a las ventas y presupuestos nuevos. Por ahora es una sola tasa: no se pueden combinar 10% y 5% en la misma venta.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeading>Moneda, formato y hora</SectionHeading>
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-xs font-semibold text-foreground">
                      Moneda de tu negocio
                    </Label>
                    <Select value={settings.currency} onValueChange={changeCurrency}>
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
                    <p className="text-xs text-muted-foreground">Con la que ponés precios, cobrás y ves los informes.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setting-language" className="text-xs font-semibold text-foreground">
                      Formato de números y fechas
                    </Label>
                    <Select value={settings.language} onValueChange={changeLanguage}>
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
                    <p className="text-xs text-muted-foreground">Separadores de miles y decimales ({selectedLanguage.locale}). El panel sigue en español.</p>
                  </div>

                  <div className="space-y-2">
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
                    <p className="text-xs text-muted-foreground">Define el día de los cierres de caja y los informes.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Así se ve un precio
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

              {/* Aviso si cambia la moneda: rojo solo si hay importes que se ven afectados. */}
              {currencyChanged ? (
                currencyChangeIsHarmless ? (
                  <Alert className="rounded-xl border-primary/30 bg-primary/5">
                    <Info className="h-5 w-5" />
                    <AlertTitle className="font-semibold">Vas a cambiar de {originalSettings.currency} a {settings.currency}</AlertTitle>
                    <AlertDescription className="mt-1 text-xs leading-relaxed">
                      Todavía no cargaste productos ni ventas, así que no hay importes que se vean afectados.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive" className="rounded-xl border-destructive/40 bg-destructive/5 shadow-sm">
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle className="font-semibold">Confirmá el cambio de moneda</AlertTitle>
                    <AlertDescription className="mt-2 space-y-3 text-xs leading-relaxed">
                      <p>
                        Cambiar de <strong className="font-bold">{originalSettings.currency}</strong> a <strong className="font-bold">{settings.currency}</strong> no convierte los precios, las deudas ni las ventas que ya tenés: los mismos números pasan a mostrarse en la moneda nueva.
                      </p>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/30 bg-background/80 p-3 text-foreground transition-colors hover:bg-background">
                        <Checkbox
                          checked={currencyChangeConfirmed}
                          onCheckedChange={(checked) => setCurrencyChangeConfirmed(checked === true)}
                          aria-describedby="currency-change-confirmation"
                          className="mt-0.5"
                        />
                        <span id="currency-change-confirmation" className="text-xs font-medium leading-5">
                          Entiendo que los importes no se convierten y confirmo el cambio de moneda.
                        </span>
                      </label>
                    </AlertDescription>
                  </Alert>
                )
              ) : null}

              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="leading-relaxed">
                  El IVA y el formato se aplican a lo nuevo: no cambian las ventas que ya hiciste ni los nombres de tus productos.
                </p>
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
                  <CardTitle className="text-lg font-semibold tracking-tight">Otras monedas y tipo de cambio</CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:text-sm">
                    Para poner precios en dólares u otra moneda y que se conviertan solos a la tuya.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <ExchangeRatesManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RUBRO Y HERRAMIENTAS */}
        {/* Conservar el borrador del perfil y sus acciones al cambiar de pestaña. */}
        <TabsContent value="rubro" forceMount className="m-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden">
          <BusinessProfileCard onStateChange={handleProfileState} actionsRef={profileActionsRef} />
        </TabsContent>

        {/* TAB 4: APARIENCIA */}
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

      {/* 2FA obligatoria para administradores: fuera de las pestañas y sin depender del plan */}
      <AdminMfaPolicyCard />

      {/* Hub de Accesos Directos a Otras Secciones de Administración */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Más configuración</span>
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
