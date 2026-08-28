'use client'

import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Store,
  Upload,
  X,
  Check,
  RefreshCw,
  Sun,
  Moon,
  Globe,
  Building2,
  Eye,
  Copy,
  Link2,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Sliders,
  Type,
  MousePointerClick,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_PLATFORM_BRANDING,
  type PlatformBranding,
} from '@/lib/platform/branding'

type SaveResponse = {
  success?: boolean
  error?: string
  branding?: PlatformBranding
}

type AssetType = 'logo_light' | 'logo_dark' | 'favicon'

interface BrandAssetUploaderProps {
  label: string
  description: string
  value: string
  field: keyof PlatformBranding
  assetType: AssetType
  onChange: (field: keyof PlatformBranding, value: string) => void
  recommendedDimensions: string
  badgeText?: string
}

function BrandAssetUploader({
  label,
  description,
  value,
  field,
  assetType,
  onChange,
  recommendedDimensions,
  badgeText,
}: BrandAssetUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showManualUrl, setShowManualUrl] = useState(false)
  const [bgPreview, setBgPreview] = useState<'white' | 'dark' | 'checker'>('checker')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!file) return

    // Validar tipo de archivo
    const validTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/gif',
      'image/avif',
    ]

    if (!validTypes.includes(file.type) && !file.name.endsWith('.svg') && !file.name.endsWith('.ico')) {
      toast.error('Formato no soportado. Usa PNG, JPG, WebP, SVG o ICO.')
      return
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe superar los 5 MB.')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetType', assetType)

      const response = await fetch('/api/superadmin/platform-branding/logo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Error al subir la imagen')
      }

      onChange(field, data.url)
      toast.success(`${label} subido correctamente`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0])
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0])
    }
  }

  function copyUrl() {
    if (!value) return
    navigator.clipboard.writeText(value)
    toast.success('URL copiada al portapapeles')
  }

  const bgClasses = {
    white: 'bg-white border-slate-200',
    dark: 'bg-slate-950 border-slate-800 text-white',
    checker:
      'bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0px] dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)]',
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-bold text-slate-900 dark:text-slate-100">{label}</Label>
            {badgeText && (
              <Badge variant="outline" className="text-[10px] uppercase font-semibold px-2 py-0.5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30">
                {badgeText}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] font-medium text-slate-500">
          {recommendedDimensions}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        {/* Zona de Drop / Subida */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 scale-[1.01]'
              : 'border-slate-200 bg-slate-50/70 hover:border-cyan-400 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/40 dark:hover:border-cyan-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-xs font-semibold">Subiendo a CDN...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs group-hover:scale-110 transition-transform text-cyan-600 dark:bg-slate-800 dark:text-cyan-400 border border-slate-200/80 dark:border-slate-700">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span className="text-cyan-600 dark:text-cyan-400 underline decoration-cyan-500/40 underline-offset-2">
                    Haz clic para explorar
                  </span>{' '}
                  o arrastra tu archivo aquí
                </p>
                <p className="mt-1 text-[11px] text-slate-400">PNG, SVG, WebP o JPG (máx. 5MB)</p>
              </div>
            </div>
          )}
        </div>

        {/* Zona de Vista Previa y Controles */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Vista previa</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Fondo claro"
                  onClick={() => setBgPreview('white')}
                  className={`h-4 w-4 rounded-full border ${bgPreview === 'white' ? 'ring-2 ring-cyan-500' : ''} bg-white border-slate-300`}
                />
                <button
                  type="button"
                  title="Fondo oscuro"
                  onClick={() => setBgPreview('dark')}
                  className={`h-4 w-4 rounded-full border ${bgPreview === 'dark' ? 'ring-2 ring-cyan-500' : ''} bg-slate-900 border-slate-700`}
                />
                <button
                  type="button"
                  title="Fondo transparente cuadrícula"
                  onClick={() => setBgPreview('checker')}
                  className={`h-4 w-4 rounded-full border ${bgPreview === 'checker' ? 'ring-2 ring-cyan-500' : ''} bg-slate-300`}
                />
              </div>
            </div>

            <div
              className={`flex h-20 w-full items-center justify-center rounded-lg border p-2 overflow-hidden transition-colors ${bgClasses[bgPreview]}`}
            >
              {value ? (
                <img
                  src={value}
                  alt={label}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="h-5 w-5 opacity-40" />
                  <span className="text-[10px]">Sin imagen</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1">
            {value && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  onClick={copyUrl}
                  title="Copiar URL directa"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                  onClick={() => onChange(field, '')}
                  title="Eliminar logo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] text-slate-600 dark:text-slate-300"
              onClick={() => setShowManualUrl(!showManualUrl)}
            >
              <Link2 className="mr-1 h-3 w-3" />
              {showManualUrl ? 'Ocultar URL' : 'URL manual'}
            </Button>
          </div>
        </div>
      </div>

      {showManualUrl && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/70">
          <Label className="text-[11px] text-slate-500 mb-1 block">URL directa del recurso:</Label>
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder="https://cdn.tusitio.com/logo.svg"
              className="h-8 text-xs font-mono bg-white dark:bg-slate-900"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={() => setShowManualUrl(false)}
            >
              Listo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  helperText,
  icon,
}: {
  id: keyof PlatformBranding
  label: string
  value: string
  onChange: (field: keyof PlatformBranding, value: string) => void
  placeholder?: string
  maxLength?: number
  helperText?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        {maxLength && (
          <span className="text-[10px] text-slate-400 tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(id, event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-9 text-sm"
      />
      {helperText && <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>}
    </div>
  )
}

export function PlatformBrandingForm({ initial }: { initial: PlatformBranding }) {
  const [draft, setDraft] = useState<PlatformBranding>(initial)
  const [savedState, setSavedState] = useState<PlatformBranding>(initial)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<'navbar' | 'login' | 'browser' | 'marketplace'>('navbar')
  const [navbarThemePreview, setNavbarThemePreview] = useState<'light' | 'dark'>('light')

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedState)

  function updateField<K extends keyof PlatformBranding>(field: K, value: PlatformBranding[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function handleResetDefaults() {
    if (confirm('¿Estás seguro de restablecer todos los valores a la configuración predeterminada de fábrica?')) {
      setDraft(DEFAULT_PLATFORM_BRANDING)
      toast.info('Valores restablecidos a la configuración de fábrica. Recuerda presionar Guardar.')
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch('/api/superadmin/platform-branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding: draft }),
      })
      const payload = (await response.json().catch(() => null)) as SaveResponse | null

      if (!response.ok || !payload?.success || !payload.branding) {
        throw new Error(payload?.error || 'No se pudo guardar la marca SaaS.')
      }

      setDraft(payload.branding)
      setSavedState(payload.branding)
      toast.success('Marca SaaS actualizada exitosamente en toda la plataforma')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la marca SaaS.')
    } finally {
      setSaving(false)
    }
  }

  // Atajo de teclado Ctrl+S / Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draft])

  // Logo a mostrar según el tema en el simulador
  const activeNavbarLogo =
    navbarThemePreview === 'dark' && draft.logoDarkUrl
      ? draft.logoDarkUrl
      : draft.logoUrl || draft.logoDarkUrl

  const previewHeightMap = {
    sm: 'h-7 max-w-[120px]',
    md: 'h-9 max-w-[160px]',
    lg: 'h-11 max-w-[200px]',
    xl: 'h-13 max-w-[240px]',
  }
  const previewLogoHeight = previewHeightMap[draft.logoHeight || 'md']
  const previewGlow =
    navbarThemePreview === 'dark' && draft.logoGlowDark !== false
      ? 'drop-shadow-[0_2px_14px_rgba(6,182,212,0.35)]'
      : ''

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-6 pb-16">
      {/* Top Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              <Link href="/superadmin/web-content">
                <ArrowLeft className="h-3.5 w-3.5" />
                Contenido web
              </Link>
            </Button>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
              Personalización Global
            </div>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Identidad de Marca & Logotipos
            </h1>
            {hasChanges && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px]">
                Cambios sin guardar
              </Badge>
            )}
          </div>
          <p className="max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configura el logo oficial, favicon, nombres comerciales y textos globales que se aplican automáticamente en la landing SaaS, navegación, login y marketplace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 h-9"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Por defecto
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9"
          >
            <a href="/saas" target="_blank" rel="noreferrer">
              <Globe className="h-3.5 w-3.5 text-cyan-600" />
              Ver Landing
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/20 px-4 h-9"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </header>

      {/* Main Grid: Form Tabs (Left) + Interactive Live Preview Simulator (Right) */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Left Column: Form Tabs */}
        <div className="space-y-6">
          <Tabs defaultValue="logos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100/80 p-1 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl h-11">
              <TabsTrigger value="logos" className="text-xs gap-1.5 font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
                <ImageIcon className="h-3.5 w-3.5 text-cyan-600" />
                <span className="hidden sm:inline">Logotipos</span>
                <span className="sm:hidden">Logos</span>
              </TabsTrigger>
              <TabsTrigger value="identity" className="text-xs gap-1.5 font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden sm:inline">Identidad</span>
                <span className="sm:hidden">Marca</span>
              </TabsTrigger>
              <TabsTrigger value="ctas" className="text-xs gap-1.5 font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
                <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
                <span>Botones</span>
              </TabsTrigger>
              <TabsTrigger value="seo" className="text-xs gap-1.5 font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-xs">
                <Search className="h-3.5 w-3.5 text-indigo-600" />
                <span>SEO & Login</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: LOGOTIPOS */}
            <TabsContent value="logos" className="mt-5 space-y-5">
              <BrandAssetUploader
                label="Logo Principal (Modo Claro / Default)"
                badgeText="Recomendado"
                description="Se utiliza en fondos claros: barra de navegación pública, correos electrónicos, facturación y reportes."
                value={draft.logoUrl}
                field="logoUrl"
                assetType="logo_light"
                onChange={updateField}
                recommendedDimensions="Horizontal (200x50px o SVG)"
              />

              <BrandAssetUploader
                label="Logo para Modo Oscuro (Opcional)"
                badgeText="Alto Contraste"
                description="Versión en blanco o colores claros para fondos oscuros (login, navbar en modo oscuro, terminales POS dark)."
                value={draft.logoDarkUrl || ''}
                field="logoDarkUrl"
                assetType="logo_dark"
                onChange={updateField}
                recommendedDimensions="Horizontal (200x50px o SVG)"
              />

              <BrandAssetUploader
                label="Favicon e Isotipo / Icono Cuadrado"
                badgeText="Icono Web"
                description="Icono cuadrado que aparece en la pestaña del navegador, accesos directos y PWA en móviles."
                value={draft.faviconUrl || ''}
                field="faviconUrl"
                assetType="favicon"
                onChange={updateField}
                recommendedDimensions="Cuadrado (64x64px o 192x192px)"
              />

              {/* Opciones de Visualización en Cabeceras & Navbar */}
              <Card className="border-slate-200/90 bg-white/90 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <CardTitle className="text-sm font-bold">
                      Opciones de Visualización en Cabecera & Navbar
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Controla la visualización del nombre, slogan, tamaño y efectos del logo en la barra superior pública.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Switch: Ocultar nombre de plataforma */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="hideNavBrandText" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                          Ocultar nombre de plataforma junto al logo
                        </Label>
                        <Badge variant="outline" className="text-[10px] text-cyan-700 dark:text-cyan-300 border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/30">
                          Recomendado para logos gráficos
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Si tu logotipo gráfico ya contiene el nombre (ej: "MitiendaPy"), activa esta opción para que no se duplique en texto plano al costado.
                      </p>
                    </div>
                    <Switch
                      id="hideNavBrandText"
                      checked={Boolean(draft.hideNavBrandText)}
                      onCheckedChange={(checked) => updateField('hideNavBrandText', checked)}
                    />
                  </div>

                  {/* Switch: Ocultar slogan/subtítulo */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="space-y-0.5">
                      <Label htmlFor="hideNavTagline" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                        Ocultar slogan / subtítulo en la cabecera
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Oculta el texto descriptivo secundario debajo del logo para un diseño más limpio y espacioso.
                      </p>
                    </div>
                    <Switch
                      id="hideNavTagline"
                      checked={Boolean(draft.hideNavTagline)}
                      onCheckedChange={(checked) => updateField('hideNavTagline', checked)}
                    />
                  </div>

                  {/* Switch: Resplandor Neón Modo Oscuro */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="space-y-0.5">
                      <Label htmlFor="logoGlowDark" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                        Resplandor Neón en Modo Oscuro
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Aplica un halo luminoso suave alrededor del logo en fondos oscuros para resaltar sobre fondos negros.
                      </p>
                    </div>
                    <Switch
                      id="logoGlowDark"
                      checked={draft.logoGlowDark !== false}
                      onCheckedChange={(checked) => updateField('logoGlowDark', checked)}
                    />
                  </div>

                  {/* Selector de Tamaño del Logo */}
                  <div className="space-y-2 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Tamaño / Altura del Logo en Cabecera
                      </Label>
                      <span className="text-[11px] text-slate-500 font-mono font-medium">
                        {draft.logoHeight === 'sm' ? 'Compacto (32px)' : draft.logoHeight === 'lg' ? 'Grande (56px)' : draft.logoHeight === 'xl' ? 'Extra Grande (64px)' : 'Estándar (44px)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { key: 'sm', label: 'Compacto', height: '32px' },
                        { key: 'md', label: 'Estándar', height: '44px' },
                        { key: 'lg', label: 'Grande', height: '56px' },
                        { key: 'xl', label: 'Extra Grande', height: '64px' },
                      ].map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => updateField('logoHeight', preset.key as any)}
                          className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-center transition-all ${
                            (draft.logoHeight || 'md') === preset.key
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-bold shadow-xs dark:bg-cyan-950/50 dark:text-cyan-200'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                          }`}
                        >
                          <span className="text-xs">{preset.label}</span>
                          <span className="text-[10px] text-slate-400 opacity-80">{preset.height}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: IDENTIDAD */}
            <TabsContent value="identity" className="mt-5 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-600" />
                    Plataforma SaaS Principal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Nombres y textos que identifican al sistema globalmente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="platformName"
                    label="Nombre de la Plataforma"
                    value={draft.platformName}
                    onChange={updateField}
                    placeholder="Ej: SERVIX 360"
                    maxLength={80}
                    helperText="Aparece en el navbar, emails y títulos."
                  />
                  <Field
                    id="platformTagline"
                    label="Slogan / Subtítulo Corto"
                    value={draft.platformTagline}
                    onChange={updateField}
                    placeholder="Ej: POS, inventario, marketplace y servicios"
                    maxLength={140}
                    helperText="Se muestra debajo del logo en el navbar."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="h-4 w-4 text-blue-600" />
                    Marketplace Multitienda
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Identidad visible en el directorio comercial y tiendas de clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="marketplaceName"
                    label="Nombre del Marketplace"
                    value={draft.marketplaceName}
                    onChange={updateField}
                    placeholder="Ej: Marketplace"
                    maxLength={80}
                  />
                  <Field
                    id="marketplaceTagline"
                    label="Subtítulo del Marketplace"
                    value={draft.marketplaceTagline}
                    onChange={updateField}
                    placeholder="Ej: Empresas y productos certificados"
                    maxLength={140}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: BOTONES Y CTAS */}
            <TabsContent value="ctas" className="mt-5 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-emerald-600" />
                    Llamadas a la Acción (Hero y Navbar)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Personaliza los botones de conversión que guían a tus visitantes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Botón Principal (Conversión)
                    </span>
                    <Field
                      id="primaryCtaLabel"
                      label="Texto del botón"
                      value={draft.primaryCtaLabel}
                      onChange={updateField}
                      placeholder="Ej: Empezar Prueba Gratis"
                      maxLength={50}
                    />
                    <Field
                      id="primaryCtaHref"
                      label="Enlace de destino"
                      value={draft.primaryCtaHref}
                      onChange={updateField}
                      placeholder="/register"
                      maxLength={500}
                      helperText="Ruta local (ej: /register) o URL externa."
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Botón Secundario (Exploración)
                    </span>
                    <Field
                      id="secondaryCtaLabel"
                      label="Texto del botón"
                      value={draft.secondaryCtaLabel}
                      onChange={updateField}
                      placeholder="Ej: Ver Marketplace"
                      maxLength={50}
                    />
                    <Field
                      id="secondaryCtaHref"
                      label="Enlace de destino"
                      value={draft.secondaryCtaHref}
                      onChange={updateField}
                      placeholder="/marketplace"
                      maxLength={500}
                      helperText="Ruta local (ej: /marketplace) o URL externa."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: SEO, LOGIN Y FOOTER */}
            <TabsContent value="seo" className="mt-5 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-indigo-600" />
                    Pantalla de Inicio de Sesión
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="loginEyebrow"
                    label="Etiqueta superior (Eyebrow)"
                    value={draft.loginEyebrow}
                    onChange={updateField}
                    placeholder="Panel interno"
                    maxLength={80}
                  />
                  <Field
                    id="loginSubtitle"
                    label="Subtítulo de bienvenida"
                    value={draft.loginSubtitle}
                    onChange={updateField}
                    placeholder="Panel de administración y staff"
                    maxLength={120}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-600" />
                    Posicionamiento Web & Metadatos (SEO)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field
                    id="seoTitle"
                    label="Título SEO (Google Title)"
                    value={draft.seoTitle}
                    onChange={updateField}
                    placeholder="SERVIX 360 para POS, inventario, marketplace y servicios"
                    maxLength={160}
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="seoDescription" className="text-xs font-semibold">
                        Descripción SEO (Google Meta Description)
                      </Label>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {draft.seoDescription.length}/240
                      </span>
                    </div>
                    <Textarea
                      id="seoDescription"
                      value={draft.seoDescription}
                      onChange={(e) => updateField('seoDescription', e.target.value)}
                      placeholder="Plataforma SaaS multiempresa..."
                      maxLength={240}
                      className="min-h-20 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="footerText" className="text-xs font-semibold">
                        Texto de Pie de Página (Footer Copyright)
                      </Label>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {draft.footerText.length}/180
                      </span>
                    </div>
                    <Textarea
                      id="footerText"
                      value={draft.footerText}
                      onChange={(e) => updateField('footerText', e.target.value)}
                      maxLength={180}
                      className="min-h-16 text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Live Interactive Preview Simulator */}
        <aside className="space-y-4 lg:sticky lg:top-24 h-fit">
          <Card className="border-slate-200/90 shadow-md dark:border-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-600" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Simulador en Vivo
                  </CardTitle>
                </div>

                {/* Previews selector */}
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('navbar')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${
                      previewMode === 'navbar'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Navbar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('login')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${
                      previewMode === 'login'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('browser')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors ${
                      previewMode === 'browser'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Pestaña
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* SIMULADOR NAVBAR */}
              {previewMode === 'navbar' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Simulando barra de navegación:</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant={navbarThemePreview === 'light' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setNavbarThemePreview('light')}
                      >
                        <Sun className="h-3 w-3 mr-1 text-amber-500" />
                        Claro
                      </Button>
                      <Button
                        type="button"
                        variant={navbarThemePreview === 'dark' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setNavbarThemePreview('dark')}
                      >
                        <Moon className="h-3 w-3 mr-1 text-blue-400" />
                        Oscuro
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 transition-colors ${
                      navbarThemePreview === 'dark'
                        ? 'bg-slate-950 border-slate-800 text-white'
                        : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {activeNavbarLogo ? (
                          <div className="flex items-center shrink-0">
                            <img
                              src={activeNavbarLogo}
                              alt={draft.platformName}
                              className={`${previewLogoHeight} w-auto object-contain ${previewGlow}`}
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              navbarThemePreview === 'dark'
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            <Building2 className="h-4 w-4" />
                          </div>
                        )}
                        {!draft.hideNavBrandText && (
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold leading-tight">
                              {draft.platformName}
                            </p>
                            {!draft.hideNavTagline && (
                              <p
                                className={`truncate text-[10px] ${
                                  navbarThemePreview === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                }`}
                              >
                                {draft.platformTagline}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-cyan-600/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                          {draft.primaryCtaLabel || 'Comenzar'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {draft.logoDarkUrl && navbarThemePreview === 'dark' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mostrando Logo Modo Oscuro exclusivo.
                    </div>
                  )}
                  {!draft.logoDarkUrl && navbarThemePreview === 'dark' && draft.logoUrl && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Usando Logo Principal (puedes subir uno especial para modo oscuro).
                    </div>
                  )}
                </div>
              )}

              {/* SIMULADOR LOGIN */}
              {previewMode === 'login' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Así se verá el encabezado en la pantalla de inicio de sesión:
                  </p>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-xl">
                    <div className="flex items-center gap-3">
                      {draft.logoDarkUrl || draft.logoUrl ? (
                        <div className="flex h-10 items-center">
                          <img
                            src={draft.logoDarkUrl || draft.logoUrl}
                            alt={draft.platformName}
                            className="h-9 w-auto max-w-[150px] object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-md">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-100">{draft.platformName}</p>
                        <p className="truncate text-[10px] text-slate-400">{draft.loginEyebrow}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/90 p-3.5">
                      <p className="text-sm font-bold text-white">Iniciar sesión</p>
                      <p className="mt-0.5 text-xs text-slate-400">{draft.loginSubtitle}</p>
                      <div className="mt-3 h-7 w-full rounded-md bg-slate-800/60" />
                    </div>
                  </div>
                </div>
              )}

              {/* SIMULADOR PESTAÑA NAVEGADOR */}
              {previewMode === 'browser' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Pestaña del navegador y resultado en Google:
                  </p>

                  {/* Browser Tab */}
                  <div className="rounded-xl border border-slate-300 bg-slate-200 p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-xs dark:bg-slate-900">
                      {draft.faviconUrl ? (
                        <img
                          src={draft.faviconUrl}
                          alt="Favicon"
                          className="h-4 w-4 shrink-0 object-contain rounded-sm"
                        />
                      ) : draft.logoUrl ? (
                        <img
                          src={draft.logoUrl}
                          alt="Favicon"
                          className="h-4 w-4 shrink-0 object-contain"
                        />
                      ) : (
                        <Globe className="h-4 w-4 text-cyan-600" />
                      )}
                      <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                        {draft.seoTitle || draft.platformName}
                      </span>
                    </div>
                  </div>

                  {/* Google SERP Snippet Preview */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="truncate">https://tu-dominio.com</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer line-clamp-1">
                      {draft.seoTitle || draft.platformName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 line-clamp-2 dark:text-slate-400">
                      {draft.seoDescription || draft.platformTagline}
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Info Box */}
              <div className="rounded-xl bg-cyan-50/70 p-3 text-xs text-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200 border border-cyan-200/60 dark:border-cyan-800/40">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Actualización Instantánea</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-300">
                      Al guardar, los logos y textos se reflejarán de inmediato en todos los usuarios conectados sin necesidad de reiniciar el servidor.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
