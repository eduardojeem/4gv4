'use client'

import Link from 'next/link'

import { useEffect, useRef, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { SectionCard } from '@/components/admin/website/SectionCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  Phone,
  Mail,
  MapPin,
  Clock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard, Sparkles,
  MessageCircle,
  Building2,
  Upload,
  Info,
  Globe,
  ExternalLink,
  HelpCircle, Search,
  Trash2,
  Images,
  Lock,
} from 'lucide-react'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { resolvePublicCommerceMode } from '@/lib/website/commerce-mode'
import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import { StorefrontAppearanceEditor } from '@/components/admin/website/StorefrontAppearanceEditor'
import { PublicVisibilityCard } from '@/components/admin/website/PublicVisibilityCard'
import { WebsiteMediaLibraryDialog } from '@/components/admin/website/WebsiteMediaLibraryDialog'
import { WebsiteMediaQuotaBanner } from '@/components/admin/website/WebsiteMediaQuotaBanner'
import { useWebsiteMediaQuota } from '@/hooks/useWebsiteMediaQuota'
import { CompanyInfo } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { isValidBrandHexColor } from '@/lib/website/brand-color'
import { extractMapsCoordinates, isShortMapsLink, isValidGoogleMapsUrl } from '@/lib/website/company-maps-url'
import { cn } from '@/lib/utils'
import { getPublicationIssues } from '@/lib/website/publication'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, refetch } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<CompanyInfo | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoMediaOpen, setLogoMediaOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showAdvancedLogoUrl, setShowAdvancedLogoUrl] = useState(false)
  const { isAtLimit: isMediaAtLimit } = useWebsiteMediaQuota()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmPublication, setConfirmPublication] = useState(false)
  const formData = draft ?? settings?.company_info ?? getWebsiteSettingsDefaults().company_info
  const hasChanges = draft !== null

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return
    const host = window.location.host
    const slug = formData.slug || ''
    const url = `https://${host}/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast.success('Enlace copiado al portapapeles', { description: url })
    setTimeout(() => setCopiedLink(false), 2500)
  }
  const focusInvalidField = useRef(false)
  useEffect(() => {
    if (!focusInvalidField.current) return
    focusInvalidField.current = false
    const field = document.getElementById(Object.keys(errors)[0] ?? '')
    const section = field?.closest('details')
    if (section) section.open = true
    field?.focus()
  }, [errors])

  const { businessVertical, effectiveModules, modules } = useSubscriptionStatus()
  const ordersEnabled = modules.length === 0 || effectiveModules.includes('orders')
  const storeHasWhatsapp = hasStoreWhatsapp(formData)
  const resolvedCommerceMode = resolvePublicCommerceMode(settings?.checkout?.commerceMode, {
    ordersEnabled,
    hasWhatsapp: storeHasWhatsapp,
  })
  // La vista con productos reales solo existe para una tienda ya publicada (lo guardado, no el borrador).
  const savedCompany = settings?.company_info
  const publishedStorePath = savedCompany?.storefrontPublic === true && savedCompany.slug ? `/${savedCompany.slug}` : null

  // Report unsaved changes to the tabs page so switching tabs can warn first.
  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (isMediaAtLimit) {
      toast.error('Límite alcanzado: máximo 20 imágenes. Eliminá imágenes desde el Historial para liberar espacio.')
      setLogoMediaOpen(true)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

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

  const [showMapsGuide, setShowMapsGuide] = useState(false)
  const [resolvingMaps, setResolvingMaps] = useState(false)
  const [mapsPinFound, setMapsPinFound] = useState<boolean | null>(null)

  // El enlace corto de la app (maps.app.goo.gl) se cambia por el largo, que trae
  // el pin exacto: con el corto el mapa de la tienda se ubicaba por la dirección.
  const resolveMapsLink = async (value: string) => {
    const link = value.trim()
    setMapsPinFound(extractMapsCoordinates(link) ? true : null)
    if (!isShortMapsLink(link)) return
    setResolvingMaps(true)
    try {
      const response = await fetch('/api/admin/website/maps-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.resolved && body.url) {
        handleChange('mapsUrl', body.url)
        setMapsPinFound(Boolean(body.coordinates))
        if (body.coordinates) toast.success('Ubicación exacta detectada', { description: 'El mapa de tu página va a marcar el punto del local.' })
      } else {
        setMapsPinFound(false)
      }
    } catch {
      setMapsPinFound(false)
    } finally {
      setResolvingMaps(false)
    }
  }

  const handlePasteMapsUrl = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        handleChange('mapsUrl', text.trim())
        toast.success('Enlace de Google Maps pegado')
        void resolveMapsLink(text)
      } else {
        toast.error('El portapapeles está vacío')
      }
    } catch {
      toast.error('No se pudo acceder al portapapeles. Pegá el enlace directamente con Ctrl+V.')
    }
  }

  const searchAddressOnGoogle = () => {
    if (!formData.address?.trim()) {
      toast.error('Escribí primero tu dirección en el campo de arriba.')
      return
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address.trim())}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = async (e: React.FormEvent, publicationConfirmed = false) => {
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
      focusInvalidField.current = true
      setErrors(nextErrors)
      toast.error('Revisá los campos marcados')
      return
    }
    setErrors({})

    const publishing = (formData.storefrontPublic === true && settings?.company_info.storefrontPublic !== true)
      || (formData.marketplacePublic === true && settings?.company_info.marketplacePublic !== true)
    if (publishing) {
      const issues = getPublicationIssues(formData, settings?.checkout.commerceMode ?? 'cart')
      if (issues.length) {
        toast.error(issues.join(' '))
        return
      }
      if (!publicationConfirmed) {
        setConfirmPublication(true)
        return
      }
    }

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
      storefrontStyle: formData.storefrontStyle || 'auto',
      whatsapp: formData.whatsapp || '',
      slogan: formData.slogan || '',
      description: formData.description || '',
      ruc: formData.ruc || '',
      businessType: formData.businessType || '',
      instagram: formData.instagram || '',
      facebook: formData.facebook || '',
      tiktok: formData.tiktok || '',
      storefrontPublic: formData.storefrontPublic === true,
      marketplacePublic: formData.storefrontPublic === true && formData.marketplacePublic === true,
      publicationConfirmed,
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
      setConfirmPublication(false)

      if (sanitizedData.slug) {
        window.dispatchEvent(new CustomEvent('website-slug-updated', { detail: sanitizedData.slug }))
      }
    } catch {
      toast.error('No se pudo guardar la información de la empresa')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAppearanceChange = (patch: Partial<CompanyInfo>) => {
    if ('brandColor' in patch || 'customBrandColor' in patch) {
      setErrors((current) => {
        if (!current.customBrandColor) return current
        const next = { ...current }
        delete next.customBrandColor
        return next
      })
    }
    const clearsPalette = ('brandColor' in patch || 'customBrandColor' in patch) && !('brandPalette' in patch)
    setDraft((current) => ({ ...(current ?? formData), ...(clearsPalette ? { brandPalette: null } : {}), ...patch }))
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
      {/* Aviso si la cuota de imágenes llega al límite */}
      <WebsiteMediaQuotaBanner onOpenHistory={() => setLogoMediaOpen(true)} />

      {/* Enlace y publicación de la tienda */}
      <SectionCard
        id="website-visibility"
        icon={Globe}
        tone="emerald"
        title="Enlace y publicación de tu tienda"
        description="Estado de publicación en vivo, dirección web pública y visibilidad en el Marketplace"
      >
        <div className="space-y-6">
          {/* Hero de Estado de Publicación en tiempo real */}
          {formData.storefrontPublic === true ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-emerald-500/20 shadow-md">
                    <Globe className="h-6 w-6" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-background"></span>
                    </span>
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estado</span>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        🟢 Tienda En Vivo
                      </span>
                    </div>
                    <h4 className="text-base font-black text-foreground">
                      Tu tienda está publicada y disponible en internet
                    </h4>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      https://{typeof window !== 'undefined' ? window.location.host : '4g.com.py'}/{formData.slug || 'mi-empresa'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-9 gap-1.5 text-xs font-bold border-emerald-500/30 hover:bg-emerald-500/10 shadow-2xs"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                  {formData.slug && (
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="h-9 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    >
                      <Link href={`/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Visitar tienda
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                    <Lock className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Estado</span>
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        🔒 Tienda Privada (Borrador)
                      </span>
                    </div>
                    <h4 className="text-base font-black text-foreground">
                      Tu tienda está oculta para el público
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Nadie puede ver tu catálogo ni realizar pedidos hasta que actives &ldquo;Publicar tienda&rdquo; y guardes los cambios.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selector de Publicación */}
          <PublicVisibilityCard
            title="Publicar tienda"
            compact
            description="Activa el enlace público de tu tienda. Al desactivarlo también se oculta del Marketplace, sin borrar datos del sistema. Los cambios se aplican al guardar."
            enabled={formData.storefrontPublic === true}
            onToggle={(checked) => setDraft((current) => ({ ...(current ?? formData), storefrontPublic: checked, marketplacePublic: checked ? formData.marketplacePublic : false }))}
          />

          {/* Dirección web / Slug */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Label htmlFor="slug" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>Ruta pública / Enlace web</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">Tu dirección web</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Es la dirección que compartirás en redes sociales, WhatsApp y folletería comercial.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer self-start sm:self-auto"
              >
                <Clipboard className="h-3.5 w-3.5" />
                <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar URL completa'}</span>
              </button>
            </div>

            <div className="flex overflow-hidden rounded-xl border border-border ring-offset-background focus-within:ring-2 focus-within:ring-primary shadow-xs">
              <span className="flex shrink-0 items-center border-r bg-muted/60 px-3.5 text-xs font-mono font-medium text-muted-foreground select-none">
                https://{typeof window !== 'undefined' ? window.location.host : '4g.com.py'}/
              </span>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mi-empresa"
                maxLength={50}
                aria-invalid={!!errors.slug}
                className="h-11 border-0 font-semibold focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              />
            </div>

            {errors.slug ? (
              <p className="text-xs font-medium text-destructive">{errors.slug}</p>
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Si cambiás esta ruta, los enlaces antiguos que hayas compartido previamente en redes o con clientes dejarán de funcionar.</span>
              </div>
            )}
          </div>

          {/* Marketplace General */}
          <PublicVisibilityCard
            title="Visibilidad en Marketplace General"
            badgeLabel="Directorio Público"
            compact
            description="Permite descubrir tu empresa y sus productos en el Marketplace. Requiere la tienda publicada; podés publicar solo tu enlace y mantener esta opción desactivada."
            disabled={formData.storefrontPublic !== true}
            enabled={formData.storefrontPublic === true && formData.marketplacePublic === true}
            onToggle={(checked) => setDraft((current) => ({ ...(current ?? formData), marketplacePublic: checked }))}
          />
        </div>
      </SectionCard>

      {/* Identidad */}
      <SectionCard id="website-identity" icon={Building2} tone="blue" title="Identidad" description="Nombre, eslogan, logo y descripción de tu negocio">
        <div className="space-y-6">
          {/* Fila superior: Logo y Datos principales */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Tarjeta Visual de Logo (5 cols en desktop) */}
            <div className="lg:col-span-5 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-bold text-foreground">Logo de la empresa</Label>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {formData.logoUrl ? 'Logo cargado' : 'Opcional'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se muestra en la cabecera, navegación y comprobantes de tu comercio.
                </p>
              </div>

              {/* Caja de previsualización de Logo */}
              <div className="flex items-center gap-4">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/90 p-2 shadow-xs overflow-hidden">
                  {formData.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formData.logoUrl}
                      alt="Logo de la empresa"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-lg">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : <Building2 className="h-5 w-5" />}
                      </span>
                      <span className="mt-1 text-[9px] font-semibold text-muted-foreground">Sin logo</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="h-8 gap-1.5 text-xs font-bold"
                    >
                      {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <span>{formData.logoUrl ? 'Cambiar logo' : 'Subir logo'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLogoMediaOpen(true)}
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      <Images className="h-3.5 w-3.5 text-primary" />
                      <span>Historial</span>
                    </Button>
                  </div>

                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange('logoUrl', '')}
                      className="text-destructive text-[11px] font-semibold hover:underline flex items-center gap-1 self-start cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Quitar logo</span>
                    </button>
                  )}

                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Formatos recomendados: PNG o WebP con fondo transparente. Máx. 2MB.
                  </p>
                </div>
              </div>

              {/* Opción para enlace externo de logo */}
              <div className="pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowAdvancedLogoUrl(!showAdvancedLogoUrl)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{showAdvancedLogoUrl ? 'Ocultar enlace web' : 'O pegar enlace web (URL)'}</span>
                </button>
                {showAdvancedLogoUrl ? (
                  <div className="mt-2 space-y-1">
                    <Input
                      id="logoUrl"
                      value={formData.logoUrl || ''}
                      onChange={(e) => handleChange('logoUrl', e.target.value)}
                      placeholder="https://cdn.miempresa.com/logo.png"
                      maxLength={500}
                      className="h-9 text-xs"
                    />
                    {errors.logoUrl && <p className="text-xs text-destructive">{errors.logoUrl}</p>}
                  </div>
                ) : (
                  <input
                    type="hidden"
                    id="logoUrl"
                    value={formData.logoUrl || ''}
                    readOnly
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>

            {/* Campos de Nombre y Eslogan (7 cols en desktop) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="companyName" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>Nombre de la empresa</span>
                    <span className="text-primary font-black">*</span>
                  </Label>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {(formData.name || '').length} / 100
                  </span>
                </div>
                <Input
                  id="companyName"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Mi Empresa S.A."
                  maxLength={100}
                  aria-invalid={!!errors.name}
                  className="h-11 font-semibold text-base"
                />
                {errors.name ? (
                  <p className="text-xs text-destructive font-medium">{errors.name}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Este es el nombre visible principal en el encabezado de tu tienda, tickets y buscador.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="companySlogan" className="text-sm font-bold text-foreground">
                    Subtítulo / Eslogan
                  </Label>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {(formData.slogan || '').length} / 100
                  </span>
                </div>
                <Input
                  id="companySlogan"
                  value={formData.slogan || ''}
                  onChange={(e) => handleChange('slogan', e.target.value)}
                  placeholder="Ej: Especialistas en belleza y cuidado de la piel"
                  maxLength={100}
                  aria-invalid={!!errors.slogan}
                  className="h-11"
                />
                {errors.slogan ? (
                  <p className="text-xs text-destructive font-medium">{errors.slogan}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Aparece justo debajo del nombre de tu negocio en la cabecera.
                  </p>
                )}
              </div>

              {/* Vista rápida en vivo de cómo se verá la cabecera */}
              <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                  Vista rápida de tu cabecera
                </span>
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-2.5 shadow-2xs">
                  {formData.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      className="h-9 w-9 shrink-0 rounded-lg object-contain border bg-muted/40 p-0.5"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : 'E'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm font-extrabold text-foreground truncate">
                      {formData.name || 'Nombre de tu empresa'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formData.slogan || 'Subtítulo o eslogan de tu negocio'}
                    </p>
                  </div>
                  <span className="rounded-md bg-primary/10 text-primary font-bold text-[10px] px-2 py-1 shrink-0">
                    Contacto
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción de la Empresa */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label htmlFor="companyDescription" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Descripción de la empresa</span>
                <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">Marketplace y Ficha</span>
              </Label>
              <span className="text-[11px] font-medium text-muted-foreground">
                {(formData.description || '').length} / 1000
              </span>
            </div>
            <Textarea
              id="companyDescription"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Contanos sobre tu negocio, los productos o servicios que ofrecés, tu trayectoria y por qué los clientes deberían elegirte..."
              rows={3}
              maxLength={1000}
              className="resize-y"
            />
            <p className="text-[11px] text-muted-foreground">
              Esta descripción se mostrará en el directorio de empresas y en el modal de detalles para que los clientes conozcan tu propuesta de valor.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Personalización visual y plantilla */}
      <SectionCard id="website-appearance" icon={Sparkles} tone="purple" title="Personalización visual y plantilla" description="Plantilla de diseño, color de marca y encabezado de tu tienda.">
        <StorefrontAppearanceEditor
          value={formData}
          onChange={handleAppearanceChange}
          customColorError={errors.customBrandColor}
          businessVertical={businessVertical}
          storePath={publishedStorePath}
          commerceMode={resolvedCommerceMode}
        />
      </SectionCard>

      {/* Contacto */}
      <SectionCard id="website-contact" icon={Phone} tone="teal" title="Información de contacto" description="Datos mostrados en el portal público">
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
            <label className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={formData.productWhatsappEnabled!==false} onChange={event=>setDraft(current=>({...(current??formData),productWhatsappEnabled:event.target.checked}))}/><span><strong>Consultas por WhatsApp en productos</strong><span className="mt-1 block text-xs text-muted-foreground">Muestra el botón en el marketplace, la tienda y la app si tenés un número válido. El mensaje incluye el producto y su enlace.</span></span></label>
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

          {/* ── Gestor Avanzado de Ubicación & Google Maps ── */}
          <div className="col-span-full rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <Label htmlFor="mapsUrl" className="text-sm font-bold text-foreground">
                    Enlace de Google Maps (Ubicación Exacta)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vincula el pin oficial de tu local con GPS y botón &quot;Cómo llegar&quot;.
                  </p>
                </div>
              </div>

              {/* Badges de Estado */}
              {formData.mapsUrl?.trim() ? (
                isValidGoogleMapsUrl(formData.mapsUrl) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Enlace verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300">
                    <Info className="h-3.5 w-3.5" />
                    Enlace no reconocido
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Opcional (Usa dirección)
                </span>
              )}
            </div>

            {/* Input + Botones Rápidos */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  id="mapsUrl"
                  type="url"
                  inputMode="url"
                  value={formData.mapsUrl || ''}
                  onChange={(e) => { handleChange('mapsUrl', e.target.value); setMapsPinFound(null) }}
                  onBlur={(e) => void resolveMapsLink(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... o https://www.google.com/maps/place/..."
                  maxLength={1000}
                  aria-invalid={!!errors.mapsUrl}
                  className={cn(
                    'h-11 rounded-xl pl-3 pr-9',
                    errors.mapsUrl && 'border-destructive'
                  )}
                />
                {resolvingMaps && <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">Buscando el pin…</span>}
                {formData.mapsUrl && (
                  <button
                    type="button"
                    onClick={() => { handleChange('mapsUrl', ''); setMapsPinFound(null) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    title="Limpiar enlace"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Botón Pegar Portapapeles */}
              <Button
                type="button"
                variant="outline"
                onClick={handlePasteMapsUrl}
                className="h-11 rounded-xl font-semibold gap-1.5 shrink-0"
              >
                <Clipboard className="h-4 w-4 text-primary" />
                <span>Pegar enlace</span>
              </Button>

              {/* Botón Probar Enlace si existe */}
              {formData.mapsUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                  className="h-11 rounded-xl font-semibold gap-1.5 shrink-0"
                >
                  <a href={formData.mapsUrl} target="_blank" rel="noopener noreferrer">
                    <span>Probar en Maps</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>

            {!errors.mapsUrl && mapsPinFound === true && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Ubicación exacta detectada: el mapa de tu página marca el punto del local.</p>
            )}
            {!errors.mapsUrl && mapsPinFound === false && (
              <p className="text-xs text-amber-700 dark:text-amber-300">No pudimos leer el pin de ese enlace: el mapa se va a ubicar por la dirección escrita. Revisá que la dirección sea completa.</p>
            )}
            {errors.mapsUrl && (
              <p className="text-xs text-destructive font-medium">{errors.mapsUrl}</p>
            )}

            {/* Accesos Útiles y Guía */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMapsGuide((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{showMapsGuide ? 'Ocultar guía' : '¿Cómo obtener el enlace de mi local en Google Maps?'}</span>
                {showMapsGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {formData.address && (
                <button
                  type="button"
                  onClick={searchAddressOnGoogle}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 text-primary" />
                  <span>Buscar &ldquo;{formData.address.slice(0, 28)}{formData.address.length > 28 ? '...' : ''}&rdquo; en Maps</span>
                </button>
              )}
            </div>

            {/* Guía Desplegable Paso a Paso */}
            {showMapsGuide && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2.5 animate-in fade-in-50 duration-200">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  3 Pasos para obtener tu enlace exacto:
                </p>
                <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside leading-relaxed">
                  <li>Abrí <strong className="text-foreground">Google Maps</strong> en tu celular o computadora.</li>
                  <li>Buscá tu negocio o tocá el punto exacto de tu local en el mapa para que aparezca el pin rojo 📍.</li>
                  <li>Tocá <strong className="text-foreground">&quot;Compartir&quot;</strong> y luego <strong className="text-foreground">&quot;Copiar enlace&quot;</strong>.</li>
                  <li>Hacé clic arriba en <strong className="text-foreground">&quot;Pegar enlace&quot;</strong> y guardá los cambios.</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Redes sociales */}
      <SectionCard collapsible icon={MessageCircle} tone="fuchsia" title="Redes sociales" description="Enlaza el perfil de la empresa en cada red — opcional">
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

      {/* Horarios */}
      <SectionCard collapsible icon={Clock} tone="amber" title="Horarios de atención" description="Horarios mostrados a los clientes">
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
      <SectionCard collapsible icon={Building2} tone="indigo" title="Legal y negocio" description="RUC, tipo de actividad y datos fiscales">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ruc" className="text-sm font-medium">
              RUC / Tax ID <span className="text-xs font-normal text-muted-foreground">— opcional</span>
            </Label>
            <Input id="ruc" value={formData.ruc || ''} onChange={(e) => handleChange('ruc', e.target.value)} placeholder="12345678-9" maxLength={50} className="h-11" />
          </div>
          {/* El tipo de negocio se movio a Configuracion > Empresa. Se sigue
              guardando en company_info, asi que este formulario lo conserva al
              enviar (ver sanitizedData): sacarlo del payload lo borraria. */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Tipo de negocio</Label>
            <p className="text-sm text-muted-foreground">
              Se configura en{' '}
              <Link href="/admin/settings" className="font-medium text-primary hover:underline">
                Configuración › Empresa
              </Link>
              .
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Historial de Logos e Imágenes — Gestión y limpieza de espacio */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-primary/15 via-primary/5 to-card p-5 sm:p-6 shadow-md transition-all hover:border-primary hover:shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20">
              <Images className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Historial de Logos e Imágenes
                </h3>
                <span className="rounded-full bg-primary/20 border border-primary/30 px-2.5 py-0.5 text-xs font-bold text-primary">
                  Máx. 20 imágenes
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Espacio liberable
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Visualizá, seleccioná y gestioná todas las imágenes subidas para tu sitio web (logos, banners del carrusel, carteles de aviso y marcas). Reutilizalas con un clic o eliminalas definitivamente para liberar espacio en tu cuenta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
            <Button
              type="button"
              size="lg"
              onClick={() => setLogoMediaOpen(true)}
              className="gap-2.5 font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-5 h-11 rounded-xl cursor-pointer"
            >
              <Images className="h-4 w-4" />
              <span>Abrir Historial de Imágenes</span>
            </Button>
          </div>
        </div>
      </div>

      <WebsiteMediaLibraryDialog
        open={logoMediaOpen}
        onOpenChange={setLogoMediaOpen}
        filterSection="logo"
        currentActiveUrl={formData.logoUrl}
        title="Historial de Logos e Imágenes"
        description="Seleccioná un logo o imagen previamente subida o eliminá archivos definitivamente para liberar espacio (máx. 20)."
        onSelect={(url) => {
          handleChange('logoUrl', url)
          toast.success('Logo seleccionado del historial')
        }}
      />

      {/* Save bar */}
      <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border bg-background/95 p-3 sm:p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            )}
            aria-hidden="true"
          />
          <span className="font-semibold text-foreground">
            {hasChanges ? 'Hay cambios sin guardar' : 'Configuración de empresa al día'}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null)
                setErrors({})
              }}
              className="h-10 px-4 rounded-xl text-xs font-semibold flex-1 sm:flex-none"
            >
              Descartar
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSaving || isSyncing || !hasChanges}
            className="h-10 px-5 rounded-xl text-xs font-bold gap-2 flex-1 sm:flex-none"
          >
            {isSaving || isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar cambios</span>
              </>
            )}
          </Button>
        </div>
      </div>
      <Dialog open={confirmPublication} onOpenChange={(open) => { if (!isSyncing) setConfirmPublication(open) }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Revisar y publicar tienda</DialogTitle><DialogDescription>Al confirmar, los visitantes podrán acceder al contenido guardado de tu tienda.</DialogDescription></DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Empresa</dt><dd className="break-words font-medium">{formData.name}</dd>
            <dt className="text-muted-foreground">Enlace</dt><dd className="break-all">/{formData.slug}/inicio</dd>
            <dt className="text-muted-foreground">Modalidad</dt><dd>{settings?.checkout.commerceMode === 'whatsapp' ? 'Consulta por WhatsApp' : settings?.checkout.commerceMode === 'catalog' ? 'Solo catálogo' : 'Carrito de compras'}</dd>
            <dt className="text-muted-foreground">Marketplace</dt><dd>{formData.marketplacePublic ? 'Aparecerá en el directorio y catálogo general' : 'No aparecerá; solo enlace directo'}</dd>
            <dt className="text-muted-foreground">Contacto</dt><dd>{formData.whatsapp || formData.phone}</dd>
          </dl>
          <p className="rounded-lg bg-muted p-3 text-sm">Revisá los productos activos, precios y textos guardados. Podés volver a ocultar la tienda desde Empresa sin borrar información.</p>
          <DialogFooter><Button type="button" variant="outline" disabled={isSyncing} onClick={() => setConfirmPublication(false)}>Volver a revisar</Button><Button type="button" disabled={isSyncing} onClick={(event) => { void handleSubmit(event, true) }}>{isSyncing ? 'Publicando…' : 'Confirmar publicación'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
