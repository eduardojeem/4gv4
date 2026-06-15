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
import { Loader2, Save, Phone, Mail, MapPin, Clock, Check, Sparkles, MessageCircle, Building2, Upload, Info } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CompanyInfo } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

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

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<CompanyInfo | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formData = draft ?? settings?.company_info ?? getWebsiteSettingsDefaults().company_info
  const hasChanges = draft !== null

  const preview = BRAND_PREVIEW[formData.brandColor || 'blue'] ?? BRAND_PREVIEW.blue
  const headerPreview = HEADER_PREVIEW_STYLES[formData.headerStyle || 'glass'] ?? HEADER_PREVIEW_STYLES.glass

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
      brandColor: formData.brandColor || 'blue',
      customBrandColor: formData.customBrandColor || '',
      headerStyle: formData.headerStyle || 'glass',
      headerColor: formData.headerColor || '',
      showTopBar: formData.showTopBar !== undefined ? formData.showTopBar : true,
      whatsapp: formData.whatsapp || '',
      ruc: formData.ruc || '',
      businessType: formData.businessType || '',
      instagram: formData.instagram || '',
      facebook: formData.facebook || '',
      tiktok: formData.tiktok || '',
      marketplacePublic: formData.marketplacePublic !== false,
    }

    const result = await updateSetting('company_info', sanitizedData)
    if (result.success) {
      toast.success('Información de empresa actualizada', {
        description: 'Los cambios se reflejarán en el portal público',
        icon: <Check className="h-4 w-4" />,
      })
      // Wait a tick for SWR to revalidate before clearing draft
      // This prevents the form from briefly showing stale data (e.g. logo disappearing)
      setTimeout(() => setDraft(null), 300)

      fetch('/api/admin/website/sync-company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitizedData.name,
          phone: sanitizedData.phone,
          address: sanitizedData.address,
          email: sanitizedData.email,
          marketplacePublic: sanitizedData.marketplacePublic,
        }),
      }).catch(() => null)
    } else {
      toast.error(result.error || 'Error al guardar')
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
          <div className="space-y-2 md:col-span-2">
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
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
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

      <SectionCard icon={Building2} title="Visibilidad publica" description="Controla si la empresa aparece en marketplace y si su sitio publico y ecommerce quedan accesibles">
        <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="marketplacePublic" className="text-sm font-semibold">Visibilidad publica</Label>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  formData.marketplacePublic !== false
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {formData.marketplacePublic !== false ? 'Publico' : 'Privado'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Si esta activo, tu empresa aparece en el marketplace y tambien quedan accesibles su pagina publica y catalogo online.
            </p>
          </div>
          <Switch
            id="marketplacePublic"
            checked={formData.marketplacePublic !== false}
            onCheckedChange={(checked) => setDraft((current) => ({ ...(current ?? formData), marketplacePublic: checked }))}
          />
        </div>
      </SectionCard>

      {/* Personalización visual */}
      <SectionCard icon={Sparkles} title="Personalización visual" description="Color de marca, estilo del header y barra superior">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Config */}
          <div className="space-y-6 lg:col-span-7">
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/20 p-4 text-xs text-muted-foreground dark:border-blue-900/30 dark:bg-blue-950/10">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-foreground">Sugerencia de Diseño</span>
                <p className="leading-relaxed">
                  Si tu logo tiene fondo blanco o claro, los estilos de header <strong>Cristal</strong> o <strong>Sólido blanco</strong> lucirán mejor. Para logos transparentes o blancos, el estilo de header <strong>Color de marca</strong> o <strong>Negro elegante</strong> creará un contraste premium.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Color de marca principal</Label>
              <p className="-mt-1 text-xs text-muted-foreground">Se aplica a botones, enlaces y estados destacados del portal.</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {BRAND_COLORS.map((c) => {
                  const isSelected = (formData.brandColor || 'blue') === c.key
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleChange('brandColor', c.key)}
                      className={`group relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all hover:scale-105 active:scale-95 ${
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      <span className={`h-6 w-6 rounded-full shadow-inner ${c.swatch} transition-transform group-hover:scale-110`} />
                      <span className={`mt-1.5 text-[10px] font-medium ${isSelected ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {c.name}
                      </span>
                      {isSelected && (
                        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
                {/* Custom Color */}
                {(() => {
                  const isSelected = formData.brandColor === 'custom'
                  return (
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => handleChange('brandColor', 'custom')}
                        className={`w-full h-full relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all hover:scale-105 active:scale-95 ${
                          isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'
                        }`}
                      >
                        <span 
                          className="h-6 w-6 rounded-full shadow-inner transition-transform group-hover:scale-110 border" 
                          style={{ backgroundColor: formData.customBrandColor || '#000000' }} 
                        />
                        <span className={`mt-1.5 text-[10px] font-medium ${isSelected ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                          Hex / Libre
                        </span>
                        {isSelected && (
                          <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                            ✓
                          </span>
                        )}
                      </button>
                      
                      {isSelected && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 w-[140px] rounded-lg border bg-popover p-3 shadow-xl animate-in fade-in zoom-in-95">
                          <input
                            type="color"
                            value={formData.customBrandColor || '#000000'}
                            onChange={(e) => handleChange('customBrandColor', e.target.value)}
                            className="h-8 w-full cursor-pointer rounded border border-input p-0.5"
                          />
                          <input
                            type="text"
                            value={formData.customBrandColor || '#000000'}
                            onChange={(e) => handleChange('customBrandColor', e.target.value)}
                            className="mt-2 flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="#FF5733"
                          />
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
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

              <div className="flex flex-col justify-between rounded-xl border bg-muted/30 p-3.5">
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
          <div className="flex flex-col justify-between rounded-2xl border bg-muted/20 p-4 lg:col-span-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previsualización en vivo</span>
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              </div>

              <div
                className="relative h-44 overflow-hidden rounded-xl border bg-background shadow-lg"
                data-color-scheme={formData.brandColor === 'custom' ? undefined : (formData.brandColor || 'blue')}
                style={formData.brandColor === 'custom' && formData.customBrandColor ? { '--primary': formData.customBrandColor } as React.CSSProperties : undefined}
              >
                <div
                  className="pointer-events-none absolute inset-0 select-none bg-cover bg-center opacity-30"
                  style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80")' }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/80" />

                {formData.showTopBar !== false && (
                  <div className={`relative z-10 flex select-none items-center justify-between border-b px-3 py-1 text-[9px] font-medium transition-colors ${headerPreview.topBar}`}>
                    <div className="flex items-center gap-2">
                      <span>Tel: {formData.phone || '+595...'}</span>
                      <span className="hidden sm:inline">| Email: {formData.email || 'info@...'}</span>
                    </div>
                    <span>Horario: {formData.hours?.weekdays || '8:00 - 18:00'}</span>
                  </div>
                )}

                <div
                  className={`relative z-10 flex select-none items-center justify-between border-b px-3 py-2 transition-all ${headerPreview.header}`}
                >
                  <div className="flex items-center gap-2">
                    {formData.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formData.logoUrl} alt="Logo" className="h-6 w-6 rounded object-contain" />
                    ) : (
                      <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[8px] font-extrabold ${headerPreview.icon}`}>4G</span>
                    )}
                    <div className="leading-tight">
                      <span className="block text-[10px] font-extrabold tracking-tight">{formData.name || 'Empresa'}</span>
                      <span className={`block text-[8px] font-medium ${headerPreview.subtitle}`}>Reparacion y Service</span>
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

                <div className="absolute bottom-2 left-3 right-3 z-10 select-none rounded-lg border border-border/50 bg-background/90 p-3 backdrop-blur-sm">
                  <h4 className="text-[9px] font-extrabold uppercase tracking-wide text-foreground">Contenido destacado</h4>
                  <p className="mt-0.5 text-[8px] leading-relaxed text-muted-foreground">
                    El color de marca se aplica a botones, enlaces, tarjetas de servicios y estados de tus reparaciones.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${preview.dot}`} />
                    <span className={`h-1.5 w-8 rounded-full ${preview.dot}`} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] italic text-muted-foreground">
              * Representa el estilo del header responsivo del sitio público.
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
        <Button type="submit" disabled={isSaving || !hasChanges} size="lg" className="h-14 rounded-full px-8 shadow-2xl md:h-12 md:rounded-xl md:px-6">
          {isSaving ? (
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
