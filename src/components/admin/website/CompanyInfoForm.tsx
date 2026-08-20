'use client'

import { useEffect, useRef, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Phone, Mail, MapPin, Clock, Check, Sparkles, MessageCircle, Building2, Upload, Info, Globe, ExternalLink } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CompanyInfo } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'

// ── Brand-color catalog — single source of truth for swatches and live preview ──
const BRAND_COLORS: Array<{ key: string; name: string; swatch: string }> = [
  { key: 'blue', name: 'Azul', swatch: 'bg-blue-500' },
  { key: 'green', name: 'Verde', swatch: 'bg-green-500' },
  { key: 'purple', name: 'Morado', swatch: 'bg-purple-500' },
  { key: 'orange', name: 'Naranja', swatch: 'bg-orange-500' },
  { key: 'red', name: 'Rojo', swatch: 'bg-red-500' },
  { key: 'indigo', name: 'Índigo', swatch: 'bg-indigo-500' },
  { key: 'teal', name: 'Teal', swatch: 'bg-teal-500' },
  { key: 'rose', name: 'Rosa', swatch: 'bg-rose-500' },
  { key: 'amber', name: 'Ámbar', swatch: 'bg-amber-500' },
  { key: 'emerald', name: 'Esmeralda', swatch: 'bg-emerald-500' },
  { key: 'cyan', name: 'Cian', swatch: 'bg-cyan-500' },
  { key: 'sky', name: 'Cielo', swatch: 'bg-sky-500' },
]

const BRAND_PREVIEW: Record<string, { header: string; cta: string; dot: string }> = {
  blue: { header: 'bg-blue-600 text-white border-blue-500', cta: 'bg-blue-600 hover:bg-blue-700 text-white', dot: 'bg-blue-500' },
  green: { header: 'bg-green-600 text-white border-green-500', cta: 'bg-green-600 hover:bg-green-700 text-white', dot: 'bg-green-500' },
  purple: { header: 'bg-purple-600 text-white border-purple-500', cta: 'bg-purple-600 hover:bg-purple-700 text-white', dot: 'bg-purple-500' },
  orange: { header: 'bg-orange-600 text-white border-orange-500', cta: 'bg-orange-600 hover:bg-orange-700 text-white', dot: 'bg-orange-500' },
  red: { header: 'bg-red-600 text-white border-red-500', cta: 'bg-red-600 hover:bg-red-700 text-white', dot: 'bg-red-500' },
  indigo: { header: 'bg-indigo-600 text-white border-indigo-500', cta: 'bg-indigo-600 hover:bg-indigo-700 text-white', dot: 'bg-indigo-500' },
  teal: { header: 'bg-teal-600 text-white border-teal-500', cta: 'bg-teal-600 hover:bg-teal-700 text-white', dot: 'bg-teal-500' },
  rose: { header: 'bg-rose-600 text-white border-rose-500', cta: 'bg-rose-600 hover:bg-rose-700 text-white', dot: 'bg-rose-500' },
  amber: { header: 'bg-amber-600 text-white border-amber-500', cta: 'bg-amber-600 hover:bg-amber-700 text-white', dot: 'bg-amber-500' },
  emerald: { header: 'bg-emerald-600 text-white border-emerald-500', cta: 'bg-emerald-600 hover:bg-emerald-700 text-white', dot: 'bg-emerald-500' },
  cyan: { header: 'bg-cyan-600 text-white border-cyan-500', cta: 'bg-cyan-600 hover:bg-cyan-700 text-white', dot: 'bg-cyan-500' },
  sky: { header: 'bg-sky-600 text-white border-sky-500', cta: 'bg-sky-600 hover:bg-sky-700 text-white', dot: 'bg-sky-500' },
  custom: { header: 'bg-primary text-white border-primary/50', cta: 'bg-primary hover:bg-primary/90 text-primary-foreground', dot: 'bg-primary' },
}

const HEADER_STYLE_HINT: Record<string, string> = {
  solid: 'Header de fondo blanco minimalista, ideal para logos oscuros.',
  accent: 'Fondo con el color de marca seleccionado. Diseño llamativo.',
  dark: 'Header oscuro premium, contraste de alta gama.',
  glass: 'Efecto cristal translúcido con desenfoque de fondo (glassmorphism).',
}

const HEADER_PREVIEW_STYLES: Record<string, {
  header: string
  topBar: string
  icon: string
  subtitle: string
  activeLink: string
  inactiveLink: string
}> = {
  accent: {
    header: 'bg-primary text-primary-foreground',
    topBar: 'border-white/10 bg-white/5 text-primary-foreground/90',
    icon: 'bg-white text-primary',
    subtitle: 'text-white/80',
    activeLink: 'bg-white text-primary shadow-sm',
    inactiveLink: 'text-white/80',
  },
  dark: {
    header: 'bg-slate-950 text-white border-slate-900',
    topBar: 'border-slate-900 bg-slate-900/30 text-slate-400',
    icon: 'bg-primary text-primary-foreground',
    subtitle: 'text-muted-foreground',
    activeLink: 'bg-accent text-foreground',
    inactiveLink: 'text-muted-foreground',
  },
  solid: {
    header: 'bg-background text-foreground border-border/80',
    topBar: 'border-border/30 bg-muted/40 text-muted-foreground',
    icon: 'bg-primary text-primary-foreground',
    subtitle: 'text-muted-foreground',
    activeLink: 'bg-accent text-foreground',
    inactiveLink: 'text-muted-foreground',
  },
  glass: {
    header: 'bg-background/80 text-foreground border-b border-border/40 backdrop-blur-lg',
    topBar: 'border-border/30 bg-muted/40 text-muted-foreground',
    icon: 'bg-primary text-primary-foreground',
    subtitle: 'text-muted-foreground',
    activeLink: 'bg-accent text-foreground',
    inactiveLink: 'text-muted-foreground',
  },
}

function toColorPickerValue(value?: string): string {
  if (!value || !isValidBrandHexColor(value)) return '#2563EB'
  if (value.length === 7) return value

  const [red, green, blue] = value.slice(1).split('')
  return `#${red}${red}${green}${green}${blue}${blue}`
}

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, refetch } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<CompanyInfo | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formData = draft ?? settings?.company_info ?? getWebsiteSettingsDefaults().company_info
  const hasChanges = draft !== null

  const preview = BRAND_PREVIEW[formData.brandColor || 'blue'] ?? BRAND_PREVIEW.blue
  const headerPreview = HEADER_PREVIEW_STYLES[formData.headerStyle || 'glass'] ?? HEADER_PREVIEW_STYLES.glass
  const brandTheme = getBrandTheme(formData.brandColor)
  const hasValidCustomBrand = formData.brandColor === 'custom' && isValidBrandHexColor(formData.customBrandColor)
  const customBrandStyle = hasValidCustomBrand
    ? { '--brand-primary': formData.customBrandColor } as React.CSSProperties
    : undefined

  // Report unsaved changes to the tabs page so switching tabs can warn first.
  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/website/logo', { method: 'POST', body: fd })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        toast.error(body.error || 'Error al subir el logo')
        return
      }
      handleChange('logoUrl', body.url)
      toast.success('Logo subido correctamente')
    } catch {
      toast.error('No se pudo subir el logo. Verificá tu conexión e intentá nuevamente.')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: Record<string, string> = {}

    // Solo el nombre es obligatorio
    if (!formData.name || formData.name.trim().length < 2) {
      nextErrors.name = 'El nombre debe tener al menos 2 caracteres.'
    }

    // Email: validar solo si se proporcionó
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && formData.email.trim() && !emailRegex.test(formData.email)) {
      nextErrors.email = 'Ingresá un email válido.'
    }

    // Teléfono: validar solo si se proporcionó
    if (formData.phone && formData.phone.trim() && formData.phone.replace(/\D/g, '').length < 6) {
      nextErrors.phone = 'El teléfono debe tener al menos 6 dígitos.'
    }

    // Dirección: validar solo si se proporcionó
    if (formData.address && formData.address.trim() && formData.address.trim().length < 4) {
      nextErrors.address = 'La dirección debe tener al menos 4 caracteres.'
    }

    if (formData.mapsUrl && !isValidGoogleMapsUrl(formData.mapsUrl)) {
      nextErrors.mapsUrl = 'Ingresá un enlace HTTPS válido de Google Maps.'
    }

    // Slug: validar solo caracteres permitidos y longitud
    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      nextErrors.slug = 'Solo se permiten letras minúsculas, números y guiones.'
    } else if (formData.slug && formData.slug.length < 3) {
      nextErrors.slug = 'La ruta pública debe tener al menos 3 caracteres.'
    }

    // Logo: allow relative/storage paths ("/...") and validate only absolute URLs.
    if (formData.logoUrl) {
      const value = formData.logoUrl.trim()
      if (!value.startsWith('/')) {
        try {
          const u = new URL(value)
          if (!(u.protocol === 'http:' || u.protocol === 'https:')) throw new Error('bad')
        } catch {
          nextErrors.logoUrl = 'Debe ser una ruta interna (/...) o una URL http(s).'
        }
      }
    }

    if (formData.brandColor === 'custom' && !isValidBrandHexColor(formData.customBrandColor)) {
      nextErrors.customBrandColor = 'Ingresá un color válido en formato #RGB o #RRGGBB.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      toast.error('Revisá los campos marcados')
      return
    }
    setErrors({})

    const sanitizedData = {
      ...formData,
      hours: formData.hours || { weekdays: '', saturday: '', sunday: '' },
      logoUrl: formData.logoUrl || '',
      mapsUrl: formData.mapsUrl?.trim() || '',
      brandColor: formData.brandColor || 'blue',
      customBrandColor: formData.customBrandColor || '',
      headerStyle: formData.headerStyle || 'glass',
      headerColor: formData.headerColor || '',
      showTopBar: formData.showTopBar !== undefined ? formData.showTopBar : true,
      whatsapp: formData.whatsapp || '',
      slogan: formData.slogan || '',
      ruc: formData.ruc || '',
      businessType: formData.businessType || '',
      instagram: formData.instagram || '',
      facebook: formData.facebook || '',
      tiktok: formData.tiktok || '',
      marketplacePublic: formData.marketplacePublic !== false,
      slug: formData.slug || '',
    }

    setIsSyncing(true)
    try {
      const syncRes = await fetch('/api/admin/website/sync-company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      })
      const syncBody = await syncRes.json().catch(() => ({}))

      if (!syncRes.ok || syncBody?.success === false) {
        toast.error(syncBody?.error || 'Error al sincronizar datos. Verifique si el enlace web ya está en uso.')
        return
      }

      await refetch()
      toast.success('Información de empresa actualizada', {
        description: 'Los cambios se reflejarán en el portal público',
        icon: <Check className="h-4 w-4" />,
      })
      setDraft(null)

      if (sanitizedData.slug) {
        window.dispatchEvent(new CustomEvent('website-slug-updated', { detail: sanitizedData.slug }))
      }
    } catch {
      toast.error('No se pudo guardar la información de la empresa')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleChange = (field: keyof CompanyInfo | string, value: string) => {
    const key = String(field)
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }

    setDraft((current) => {
      const next = current ?? formData

      if (field.startsWith('hours.')) {
        const hourField = field.split('.')[1] as 'weekdays' | 'saturday' | 'sunday'
        return { ...next, hours: { ...next.hours, [hourField]: value } }
      }

      return { ...next, [field]: value } as CompanyInfo
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Cargando información...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-destructive">Error al cargar información: {error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 md:space-y-10 pb-24 md:pb-8">
      {/* Identidad */}
      <SectionCard icon={Building2} title="Identidad" description="Nombre y logo de la empresa">
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="companyName" className="text-sm font-medium">Nombre de la empresa</Label>
            <Input
              id="companyName"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Mi Empresa S.A."
              maxLength={100}
              aria-invalid={!!errors.name}
              className="h-11"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="companySlogan" className="text-sm font-medium">
              Subtítulo / Eslogan <span className="text-xs font-normal text-muted-foreground">— debajo del nombre</span>
            </Label>
            <Input
              id="companySlogan"
              value={formData.slogan || ''}
              onChange={(e) => handleChange('slogan', e.target.value)}
              placeholder="Reparación y Servicios"
              maxLength={100}
              aria-invalid={!!errors.slogan}
              className="h-11"
            />
            {errors.slogan && <p className="text-xs text-destructive">{errors.slogan}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl" className="text-sm font-medium">Logo</Label>
            <div className="flex items-start gap-3">
              {formData.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.logoUrl}
                  alt="Logo"
                  className="h-11 w-11 shrink-0 rounded-lg border object-contain bg-muted"
                />
              )}
              <div className="flex flex-1 gap-2">
                <Input
                  id="logoUrl"
                  value={formData.logoUrl || ''}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  placeholder="https://cdn.miempresa.com/logo.png"
                  maxLength={500}
                  className="h-11"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  title="Subir imagen"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
            {errors.logoUrl
              ? <p className="text-xs text-destructive">{errors.logoUrl}</p>
              : <p className="text-xs text-muted-foreground">JPG, PNG, WebP o SVG — máx. 2 MB</p>}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Globe} title="Enlace y visibilidad" description="Configura la dirección de tu portal y su visibilidad">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm font-medium">Ruta pública / Enlace web</Label>
            <div className="flex overflow-hidden rounded-md border ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="flex shrink-0 items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground whitespace-nowrap">
                {typeof window !== 'undefined' ? window.location.host : '4g.com.py'}/
              </span>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mi-empresa"
                maxLength={50}
                aria-invalid={!!errors.slug}
                className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            {errors.slug ? (
              <p className="text-xs text-destructive">{errors.slug}</p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Si cambiás esta ruta, los enlaces antiguos que hayas compartido dejarán de funcionar.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="marketplacePublic" className="text-sm font-semibold">Visibilidad en Marketplace</Label>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    formData.marketplacePublic !== false
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {formData.marketplacePublic !== false ? 'Público' : 'Privado'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Si está activo, tu empresa aparecerá listada en el marketplace general. (Tu sitio directo siempre funcionará).
              </p>
            </div>
            <Switch
              id="marketplacePublic"
              checked={formData.marketplacePublic !== false}
              onCheckedChange={(checked) => setDraft((current) => ({ ...(current ?? formData), marketplacePublic: checked }))}
            />
          </div>
        </div>
      </SectionCard>

      {/* Personalización visual */}
      <SectionCard icon={Sparkles} title="Personalización visual" description="Define la identidad del sitio y comprobá el resultado antes de guardar">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Config */}
          <div className="space-y-6 lg:col-span-7">
            <div className="flex items-start gap-2.5 border-l-2 border-primary/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <span className="font-semibold text-foreground">Qué cambia en tu sitio</span>
                <p className="leading-relaxed">
                  El color define los botones y el fondo del inicio. El estilo modifica el encabezado, y la barra superior muestra tus datos de contacto.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Color de marca principal</Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Se aplica a botones, enlaces activos, encabezados destacados y al fondo del inicio.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {BRAND_COLORS.map((c) => {
                  const isSelected = (formData.brandColor || 'blue') === c.key
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleChange('brandColor', c.key)}
                      aria-label={`Usar color ${c.name}`}
                      aria-pressed={isSelected}
                      className={`relative flex h-16 flex-col items-center justify-center rounded-md border p-2 transition-colors ${
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      <span aria-hidden="true" className={`h-6 w-6 rounded-full shadow-inner ${c.swatch}`} />
                      <span className={`mt-1.5 text-[10px] font-medium ${isSelected ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {c.name}
                      </span>
                      {isSelected && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check aria-hidden="true" className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setDraft((current) => ({
                      ...(current ?? formData),
                      brandColor: 'custom',
                      customBrandColor: formData.customBrandColor || '#2563EB',
                    }))
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.customBrandColor
                      return next
                    })
                  }}
                  aria-label="Usar un color personalizado"
                  aria-pressed={formData.brandColor === 'custom'}
                  className={`relative flex h-16 flex-col items-center justify-center rounded-md border p-2 transition-colors ${
                    formData.brandColor === 'custom'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-foreground/30'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full border shadow-inner"
                    style={{ backgroundColor: toColorPickerValue(formData.customBrandColor) }}
                  />
                  <span className={`mt-1.5 text-[10px] font-medium ${formData.brandColor === 'custom' ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    Personalizado
                  </span>
                  {formData.brandColor === 'custom' && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check aria-hidden="true" className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              </div>

              {formData.brandColor === 'custom' && (
                <div className="grid gap-3 border-l-2 border-primary/40 pl-4 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="customBrandColorPicker" className="text-xs">Selector</Label>
                    <input
                      id="customBrandColorPicker"
                      type="color"
                      value={toColorPickerValue(formData.customBrandColor)}
                      onChange={(event) => handleChange('customBrandColor', event.target.value.toUpperCase())}
                      aria-describedby="customBrandColorHelp"
                      className="h-11 w-full cursor-pointer rounded-md border border-input bg-background p-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customBrandColor">Código HEX</Label>
                    <Input
                      id="customBrandColor"
                      value={formData.customBrandColor || ''}
                      onChange={(event) => handleChange('customBrandColor', event.target.value)}
                      onBlur={(event) => handleChange('customBrandColor', event.target.value.trim().toUpperCase())}
                      placeholder="#2563EB"
                      maxLength={7}
                      spellCheck={false}
                      aria-invalid={!!errors.customBrandColor}
                      aria-describedby={errors.customBrandColor ? 'customBrandColorHelp customBrandColorError' : 'customBrandColorHelp'}
                      className="h-11 font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-start-2">
                    <p id="customBrandColorHelp" className="text-xs text-muted-foreground">
                      Usá 3 o 6 caracteres, por ejemplo #0F8 o #00FF88.
                    </p>
                    {errors.customBrandColor && (
                      <p id="customBrandColorError" role="alert" className="mt-1 text-xs text-destructive">
                        {errors.customBrandColor}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="headerStyle" className="text-sm font-semibold">Estilo del header</Label>
                <Select value={formData.headerStyle || 'glass'} onValueChange={(v) => handleChange('headerStyle', v)}>
                  <SelectTrigger id="headerStyle" className="h-11">
                    <SelectValue placeholder="Seleccionar estilo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glass">Cristal (translúcido)</SelectItem>
                    <SelectItem value="solid">Sólido blanco</SelectItem>
                    <SelectItem value="accent">Color de marca</SelectItem>
                    <SelectItem value="dark">Negro elegante</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {HEADER_STYLE_HINT[formData.headerStyle || 'glass']}
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-lg border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label htmlFor="showTopBar" className="text-sm font-semibold">Barra superior</Label>
                    <p className="mt-0.5 pr-2 text-xs text-muted-foreground">Datos de contacto rápidos arriba del menú</p>
                  </div>
                  <Switch
                    id="showTopBar"
                    checked={formData.showTopBar !== false}
                    onCheckedChange={(checked) => setDraft((current) => ({ ...(current ?? formData), showTopBar: checked }))}
                  />
                </div>
                <span
                  className={`mt-3 inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    formData.showTopBar !== false
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formData.showTopBar !== false ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4 lg:col-span-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <span className="block text-xs font-semibold text-foreground">Vista previa del sitio</span>
                  <span className="block text-[10px] text-muted-foreground">Encabezado e inicio</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                  En vivo
                </span>
              </div>

              <div
                className="overflow-hidden rounded-lg border bg-background shadow-sm"
                data-color-scheme={formData.brandColor === 'custom' ? undefined : (formData.brandColor || 'blue')}
                data-custom-brand={hasValidCustomBrand ? '' : undefined}
                style={customBrandStyle}
              >
                {formData.showTopBar !== false && (
                  <div className={`flex select-none items-center justify-between gap-2 border-b px-3 py-1 text-[9px] font-medium transition-colors ${headerPreview.topBar}`}>
                    <div className="flex items-center gap-2">
                      <span>Tel: {formData.phone || '+595...'}</span>
                      <span className="hidden sm:inline">| Email: {formData.email || 'info@...'}</span>
                    </div>
                    <span className="truncate">Horario: {formData.hours?.weekdays || '8:00 - 18:00'}</span>
                  </div>
                )}

                <div
                  className={`flex select-none items-center justify-between border-b px-3 py-2 transition-all ${headerPreview.header}`}
                >
                  <div className="flex items-center gap-2">
                    {formData.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formData.logoUrl} alt="Logo" className="h-6 w-6 rounded object-contain" />
                    ) : (
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-extrabold ${headerPreview.icon}`}>4G</span>
                    )}
                    <div className="leading-tight">
                      <span className="block text-[10px] font-extrabold tracking-tight">{formData.name || 'Empresa'}</span>
                      <span className={`block text-[8px] font-medium ${headerPreview.subtitle}`}>{formData.slogan || 'Reparación y servicios'}</span>
                    </div>
                  </div>

                  <div className="hidden items-center gap-1.5 text-[8px] font-semibold sm:flex">
                    <span className={`rounded-md px-2 py-1 ${headerPreview.activeLink}`}>Inicio</span>
                    <span className={`rounded-md px-2 py-1 ${headerPreview.inactiveLink}`}>Productos</span>
                    <span className={`rounded-md px-2 py-1 ${headerPreview.inactiveLink}`}>Servicios</span>
                  </div>

                  <button
                    type="button"
                    className={`rounded-md px-2.5 py-1 text-[9px] font-bold shadow-sm transition-all ${
                      formData.headerStyle === 'accent' ? 'bg-white text-primary hover:bg-white/90' : preview.cta
                    }`}
                  >
                    Contacto
                  </button>
                </div>

                <div className={`bg-gradient-to-br ${brandTheme.hero} px-4 py-5 text-white`}>
                  <span className="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[8px] font-semibold ring-1 ring-white/20">
                    Servicio técnico confiable
                  </span>
                  <h4 className="mt-2 max-w-[260px] text-base font-bold leading-tight">
                    Tecnología lista para acompañarte
                  </h4>
                  <p className={`mt-1 max-w-[290px] text-[9px] leading-relaxed ${brandTheme.text200}`}>
                    Venta, reparación y soporte para tus dispositivos.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-md bg-white px-3 py-1.5 text-[9px] font-bold ${brandTheme.ctaBtn}`}>
                      Ver productos
                    </span>
                    <span className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-[9px] font-semibold text-white">
                      Contactar
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] italic text-muted-foreground">
              La vista usa los mismos colores de marca que el sitio público.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Contacto */}
      <SectionCard icon={Phone} title="Información de contacto" description="Datos mostrados en el portal público">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Teléfono
            </Label>
            <Input id="phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+595 981 000 000" maxLength={50} aria-invalid={!!errors.phone} className="h-11" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              WhatsApp <span className="text-xs font-normal text-muted-foreground">— opcional</span>
            </Label>
            <Input id="whatsapp" type="tel" value={formData.whatsapp || ''} onChange={(e) => handleChange('whatsapp', e.target.value)} placeholder="595981000000" maxLength={50} className="h-11" />
            <p className="text-[11px] text-muted-foreground">
              Ingresa el número con el código de país, sin símbolos ni espacios (ej: <strong>595981000000</strong>). {formData.whatsapp && <span>Enlace generado: <strong>wa.me/{formData.whatsapp.replace(/\D/g, '')}</strong></span>}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="info@empresa.com" maxLength={100} aria-invalid={!!errors.email} className="h-11" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="col-span-full space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Dirección
            </Label>
            <Input id="address" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Av. Principal 123, Ciudad" maxLength={300} aria-invalid={!!errors.address} className="h-11" />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="col-span-full space-y-2">
            <Label htmlFor="mapsUrl" className="flex items-center gap-2 text-sm font-medium">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              Enlace de Google Maps <span className="text-xs font-normal text-muted-foreground">- opcional</span>
            </Label>
            <Input
              id="mapsUrl"
              type="url"
              inputMode="url"
              value={formData.mapsUrl || ''}
              onChange={(e) => handleChange('mapsUrl', e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              maxLength={1000}
              aria-invalid={!!errors.mapsUrl}
              aria-describedby="mapsUrl-help"
              className="h-11"
            />
            {errors.mapsUrl ? (
              <p className="text-xs text-destructive">{errors.mapsUrl}</p>
            ) : (
              <p id="mapsUrl-help" className="text-xs leading-relaxed text-muted-foreground">
                Pegá el enlace de compartir de Google Maps para abrir la ubicación exacta. Si lo dejás vacío, se buscará la dirección escrita arriba.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Horarios */}
      <SectionCard icon={Clock} title="Horarios de atención" description="Horarios mostrados a los clientes">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="weekdays" className="text-sm font-medium">Lunes - Viernes</Label>
            <Input id="weekdays" value={formData.hours.weekdays} onChange={(e) => handleChange('hours.weekdays', e.target.value)} placeholder="8:00 - 18:00" maxLength={50} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saturday" className="text-sm font-medium">Sábados</Label>
            <Input id="saturday" value={formData.hours.saturday} onChange={(e) => handleChange('hours.saturday', e.target.value)} placeholder="9:00 - 13:00" maxLength={50} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sunday" className="text-sm font-medium">Domingos</Label>
            <Input id="sunday" value={formData.hours.sunday} onChange={(e) => handleChange('hours.sunday', e.target.value)} placeholder="Cerrado" maxLength={50} className="h-11" />
          </div>
        </div>
      </SectionCard>

      {/* Legal */}
      <SectionCard icon={Building2} title="Legal y negocio" description="RUC, tipo de actividad y datos fiscales">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ruc" className="text-sm font-medium">
              RUC / Tax ID <span className="text-xs font-normal text-muted-foreground">— opcional</span>
            </Label>
            <Input id="ruc" value={formData.ruc || ''} onChange={(e) => handleChange('ruc', e.target.value)} placeholder="12345678-9" maxLength={50} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessType" className="text-sm font-medium">Tipo de negocio</Label>
            <Select value={formData.businessType || ''} onValueChange={(v) => handleChange('businessType', v)}>
              <SelectTrigger id="businessType" className="h-11">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Minorista (tienda física)</SelectItem>
                <SelectItem value="repair">Reparaciones técnicas</SelectItem>
                <SelectItem value="wholesale">Mayorista / distribución</SelectItem>
                <SelectItem value="service">Servicios profesionales</SelectItem>
                <SelectItem value="mixed">Mixto (venta + servicio)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Redes sociales */}
      <SectionCard icon={MessageCircle} title="Redes sociales" description="Enlaza el perfil de la empresa en cada red — opcional">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { id: 'instagram', label: 'Instagram', prefix: 'instagram.com/', value: formData.instagram, placeholder: 'tu_usuario' },
            { id: 'facebook', label: 'Facebook', prefix: 'facebook.com/', value: formData.facebook, placeholder: 'tu_pagina' },
            { id: 'tiktok', label: 'TikTok', prefix: 'tiktok.com/@', value: formData.tiktok, placeholder: 'tu_usuario' },
          ].map((s) => (
            <div key={s.id} className="space-y-2">
              <Label htmlFor={s.id} className="text-sm font-medium">{s.label}</Label>
              <div className="flex overflow-hidden rounded-md border ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r bg-muted/40 px-3 text-xs text-muted-foreground">{s.prefix}</span>
                <Input
                  id={s.id}
                  value={s.value || ''}
                  onChange={(e) => handleChange(s.id, e.target.value)}
                  placeholder={s.placeholder}
                  maxLength={100}
                  className="h-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Save bar */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 md:sticky md:bottom-6 md:justify-end">
        {hasChanges && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(null)
              setErrors({})
            }}
            className="h-14 rounded-full px-6 shadow-2xl bg-background/80 backdrop-blur border md:h-12 md:rounded-xl md:px-4"
          >
            Descartar
          </Button>
        )}
        <Button type="submit" disabled={isSaving || isSyncing || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl md:px-6">
          {isSaving || isSyncing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="hidden md:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              <span className="hidden md:inline">Guardar cambios</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
