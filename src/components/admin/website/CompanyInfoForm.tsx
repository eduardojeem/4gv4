'use client'

import { useRef, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Phone, Mail, MapPin, Clock, Check, Sparkles, MessageCircle, Building2, Upload } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CompanyInfo } from '@/types/website-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [draft, setDraft] = useState<CompanyInfo | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formData = draft ?? settings?.company_info ?? getWebsiteSettingsDefaults().company_info
  const hasChanges = draft !== null

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/website/logo', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({})) as { url?: string; error?: string }
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

    // Validar nombre
    if (!formData.name || formData.name.trim().length < 2) {
      toast.error('Nombre inválido', {
        description: 'El nombre debe tener al menos 2 caracteres'
      })
      return
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Email inválido', {
        description: 'Por favor ingresa un email válido'
      })
      return
    }

    // Validar teléfono
    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 9) {
      toast.error('Teléfono inválido', {
        description: 'El teléfono debe tener al menos 9 dígitos'
      })
      return
    }

    // Validar dirección
    if (formData.address.trim().length < 10) {
      toast.error('Dirección muy corta', {
        description: 'La dirección debe tener al menos 10 caracteres'
      })
      return
    }

    // Validar logo URL (opcional)
    if (formData.logoUrl) {
      try {
        const u = new URL(formData.logoUrl)
        if (!(u.protocol === 'http:' || u.protocol === 'https:')) throw new Error('bad')
      } catch {
        toast.error('URL de logo inválida', {
          description: 'Debe ser una URL http(s) válida'
        })
        return
      }
    }

    // Ensure formData has all required fields with proper types
    const sanitizedData = {
      ...formData,
      hours: formData.hours || { weekdays: '', saturday: '', sunday: '' },
      logoUrl: formData.logoUrl || '',
      brandColor: formData.brandColor || 'blue',
      headerStyle: formData.headerStyle || 'glass',
      headerColor: formData.headerColor || '',
      showTopBar: formData.showTopBar !== undefined ? formData.showTopBar : true,
      whatsapp: formData.whatsapp || '',
      ruc: formData.ruc || '',
      businessType: formData.businessType || '',
      instagram: formData.instagram || '',
      facebook: formData.facebook || '',
      tiktok: formData.tiktok || '',
    }

    const result = await updateSetting('company_info', sanitizedData)
    if (result.success) {
      toast.success('Información de empresa actualizada', {
        description: 'Los cambios se reflejarán en el portal público',
        icon: <Check className="h-4 w-4" />
      })
      setDraft(null)

      // Sync name/phone/address to organizations, organization_settings and default branch
      fetch('/api/admin/website/sync-company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitizedData.name,
          phone: sanitizedData.phone,
          address: sanitizedData.address,
          email: sanitizedData.email,
        }),
      }).catch(() => null)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleChange = (field: keyof CompanyInfo | string, value: string) => {
    setDraft((current) => {
      const next = current ?? formData

      if (field.startsWith('hours.')) {
        const hourField = field.split('.')[1] as 'weekdays' | 'saturday' | 'sunday'
        return {
          ...next,
          hours: {
            ...next.hours,
            [hourField]: value
          }
        }
      }

      return {
        ...next,
        [field]: value
      } as CompanyInfo
    })
  }

  if (isLoading) {
    return (
      <Card className="border-none shadow-lg">
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
      <Card className="border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="text-center text-sm text-red-600">
            Error al cargar información: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20 md:pb-0">
      {/* Identidad de la empresa */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 shrink-0">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Identidad</CardTitle>
              <CardDescription className="text-xs md:text-sm">Nombre, color de marca y logo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Nombre de la empresa */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName" className="text-sm font-medium">Nombre de la empresa</Label>
              <Input
                id="companyName"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Mi Empresa S.A."
                maxLength={100}
                className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 h-11"
              />
            </div>

            {/* Logo */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="logoUrl" className="text-sm font-medium">Logo</Label>
              <div className="flex items-start gap-3">
                {formData.logoUrl && (
                  <img
                    src={formData.logoUrl}
                    alt="Logo"
                    className="h-11 w-11 shrink-0 rounded-lg border border-border object-contain bg-gray-50"
                  />
                )}
                <div className="flex-1 flex gap-2">
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl || ''}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    placeholder="https://cdn.miempresa.com/logo.png"
                    maxLength={500}
                    className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    title="Subir imagen"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  >
                    {logoUploading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Upload className="h-4 w-4" />
                    }
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
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP o SVG — máx. 2 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personalización Visual */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 dark:from-pink-950/20 dark:via-rose-950/20 dark:to-amber-950/20 p-4 md:p-6 border-b border-rose-100/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl font-bold tracking-tight">Personalización Visual</CardTitle>
              <CardDescription className="text-xs md:text-sm text-muted-foreground">Configura la identidad de marca, los colores y la experiencia del portal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-8 lg:grid-cols-12">
            
            {/* Columna Izquierda: Configuración (7 cols) */}
            <div className="space-y-6 lg:col-span-7">
              {/* Gama de Colores */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Color de Marca Principal</Label>
                <p className="text-xs text-muted-foreground mb-3">Define el color de acento principal para botones, enlaces y estados destacados</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {[
                    { key: 'blue', color: 'bg-blue-500', name: 'Azul' },
                    { key: 'green', color: 'bg-green-500', name: 'Verde' },
                    { key: 'purple', color: 'bg-purple-500', name: 'Morado' },
                    { key: 'orange', color: 'bg-orange-500', name: 'Naranja' },
                    { key: 'red', color: 'bg-red-500', name: 'Rojo' },
                    { key: 'indigo', color: 'bg-indigo-500', name: 'Índigo' },
                    { key: 'teal', color: 'bg-teal-500', name: 'Teal' },
                    { key: 'rose', color: 'bg-rose-500', name: 'Rosa' },
                    { key: 'amber', color: 'bg-amber-500', name: 'Ámbar' },
                    { key: 'emerald', color: 'bg-emerald-500', name: 'Esmeralda' },
                    { key: 'cyan', color: 'bg-cyan-500', name: 'Cian' },
                    { key: 'sky', color: 'bg-sky-500', name: 'Cielo' }
                  ].map((c) => {
                    const isSelected = (formData.brandColor || 'blue') === c.key
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => handleChange('brandColor', c.key)}
                        className={`group relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${
                          isSelected
                            ? 'border-pink-500 bg-pink-50/20 dark:bg-pink-950/10 shadow-sm shadow-pink-500/10 ring-2 ring-pink-500/20'
                            : 'border-gray-100 hover:border-gray-300 dark:border-gray-800'
                        }`}
                      >
                        <span className={`h-6 w-6 rounded-full shadow-inner ${c.color} transition-transform group-hover:scale-110`} />
                        <span className={`mt-1.5 text-2xs font-medium ${isSelected ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-muted-foreground'}`}>
                          {c.name}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pink-500 text-white text-3xs font-bold scale-100 animate-in zoom-in-50 duration-200">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Estilo de Header y Barra Superior */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="headerStyle" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Estilo del Header</Label>
                  <Select 
                    value={formData.headerStyle || 'glass'} 
                    onValueChange={(v) => handleChange('headerStyle', v)}
                  >
                    <SelectTrigger id="headerStyle" className="h-11 rounded-xl border-gray-200 focus:ring-pink-500 focus:border-pink-500">
                      <SelectValue placeholder="Seleccionar estilo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="glass" className="focus:bg-pink-50 focus:text-pink-700">Cristal (Efecto translúcido)</SelectItem>
                      <SelectItem value="solid" className="focus:bg-pink-50 focus:text-pink-700">Sólido Blanco</SelectItem>
                      <SelectItem value="accent" className="focus:bg-pink-50 focus:text-pink-700">Color de Marca</SelectItem>
                      <SelectItem value="dark" className="focus:bg-pink-50 focus:text-pink-700">Negro Elegante</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-3xs text-muted-foreground leading-relaxed mt-1">
                    {formData.headerStyle === 'solid' ? 'Header de fondo blanco minimalista ideal para logos oscuros.' :
                     formData.headerStyle === 'accent' ? 'Fondo con el color de marca seleccionado. Diseño llamativo.' :
                     formData.headerStyle === 'dark' ? 'Header oscuro premium. Contraste de alta gama.' :
                     'Efecto cristal translúcido con desenfoque de fondo (glassmorphism) de última tendencia.'}
                  </p>
                </div>

                <div className="flex flex-col justify-between p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="showTopBar" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Barra Superior</Label>
                      <p className="text-3xs text-muted-foreground pr-2 mt-0.5">Muestra datos de contacto rápidos arriba del menú</p>
                    </div>
                    <Switch
                      id="showTopBar"
                      checked={formData.showTopBar !== false}
                      onCheckedChange={(checked) => {
                        setDraft((current) => ({
                          ...(current ?? formData),
                          showTopBar: checked
                        }))
                      }}
                      className="data-[state=checked]:bg-pink-500"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-3xs font-medium ${
                      formData.showTopBar !== false ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
                    }`}>
                      {formData.showTopBar !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Vista Previa Interactiva en Tiempo Real (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between border border-gray-100 dark:border-gray-800 rounded-2xl p-4 bg-gradient-to-b from-gray-50/50 via-white to-gray-50/30 dark:from-gray-950/10 dark:via-gray-900/5 dark:to-gray-950/10 shadow-inner">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100/50 pb-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Previsualizador en Vivo</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                {/* Contenedor del Header Miniatura Simulador */}
                <div className="relative h-44 rounded-xl border border-gray-200/60 dark:border-gray-800 overflow-hidden bg-gray-900 shadow-lg">
                  {/* Fondo del Header (Imagen abstracta de simulador) */}
                  <div className="absolute inset-0 bg-cover bg-center opacity-30 select-none pointer-events-none" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80")' }} />
                  
                  {/* Top Bar Simulador */}
                  {formData.showTopBar !== false && (
                    <div className="relative z-10 flex items-center justify-between px-3 py-1 bg-black/40 backdrop-blur-2xs text-3xs text-white/90 border-b border-white/5 select-none font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">📞 {formData.phone || '+595...'}</span>
                        <span className="hidden sm:inline">| ✉️ {formData.email || 'info@...'}</span>
                      </div>
                      <span>🕒 {formData.hours?.weekdays || '8:00 - 18:00'}</span>
                    </div>
                  )}

                  {/* Menú Principal Header Simulador */}
                  <div className={`relative z-10 flex items-center justify-between px-3 py-2 border-b select-none transition-all duration-300 ${
                    formData.headerStyle === 'accent' 
                      ? `${
                          formData.brandColor === 'green' ? 'bg-green-600 text-white border-green-500' :
                          formData.brandColor === 'purple' ? 'bg-purple-600 text-white border-purple-500' :
                          formData.brandColor === 'orange' ? 'bg-orange-600 text-white border-orange-500' :
                          formData.brandColor === 'red' ? 'bg-red-600 text-white border-red-500' :
                          formData.brandColor === 'indigo' ? 'bg-indigo-600 text-white border-indigo-500' :
                          formData.brandColor === 'teal' ? 'bg-teal-600 text-white border-teal-500' :
                          formData.brandColor === 'rose' ? 'bg-rose-600 text-white border-rose-500' :
                          formData.brandColor === 'amber' ? 'bg-amber-600 text-white border-amber-500' :
                          formData.brandColor === 'emerald' ? 'bg-emerald-600 text-white border-emerald-500' :
                          formData.brandColor === 'cyan' ? 'bg-cyan-600 text-white border-cyan-500' :
                          formData.brandColor === 'sky' ? 'bg-sky-600 text-white border-sky-500' :
                          'bg-blue-600 text-white border-blue-500'
                        }`
                      : formData.headerStyle === 'dark'
                      ? 'bg-gray-950 text-white border-gray-900'
                      : formData.headerStyle === 'solid'
                      ? 'bg-white text-gray-800 border-gray-100 shadow-sm'
                      : 'bg-white/10 text-white border-white/10 backdrop-blur-md'
                  }`}>
                    {/* Logo */}
                    <div className="flex items-center gap-1">
                      {formData.logoUrl ? (
                        <img src={formData.logoUrl} alt="Logo" className="h-5 w-5 object-contain" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-white/20 text-3xs font-extrabold text-white">4G</span>
                      )}
                      <span className="text-2xs font-extrabold tracking-tight">{formData.name || 'Empresa'}</span>
                    </div>

                    {/* Menú Enlaces de Navegación */}
                    <div className="hidden sm:flex items-center gap-2.5 text-4xs font-bold uppercase tracking-wider opacity-90">
                      <span>Inicio</span>
                      <span>Productos</span>
                      <span>Servicios</span>
                    </div>

                    {/* Botón de CTA */}
                    <button 
                      type="button" 
                      className={`px-2.5 py-1 rounded-md text-3xs font-bold transition-all shadow-sm ${
                        formData.headerStyle === 'accent'
                          ? 'bg-white text-gray-800 hover:bg-gray-50'
                          : `${
                              formData.brandColor === 'green' ? 'bg-green-600 hover:bg-green-700 text-white' :
                              formData.brandColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                              formData.brandColor === 'orange' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                              formData.brandColor === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' :
                              formData.brandColor === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                              formData.brandColor === 'teal' ? 'bg-teal-600 hover:bg-teal-700 text-white' :
                              formData.brandColor === 'rose' ? 'bg-rose-600 hover:bg-rose-700 text-white' :
                              formData.brandColor === 'amber' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                              formData.brandColor === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
                              formData.brandColor === 'cyan' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' :
                              formData.brandColor === 'sky' ? 'bg-sky-600 hover:bg-sky-700 text-white' :
                              'bg-blue-600 hover:bg-blue-700 text-white'
                            }`
                      }`}
                    >
                      Contacto
                    </button>
                  </div>

                  {/* Cuerpo Principal del Simulador */}
                  <div className="absolute bottom-2 left-3 right-3 z-10 p-3 rounded-lg bg-black/60 backdrop-blur-2xs border border-white/5 select-none">
                    <h4 className="text-3xs font-extrabold text-white tracking-wide uppercase">Contenido Destacado</h4>
                    <p className="text-4xs text-white/70 leading-relaxed mt-0.5">El color de marca se aplicará a botones, enlaces, tarjetas de servicios y estados de tus reparaciones públicas.</p>
                    <div className="mt-2 flex gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        formData.brandColor === 'green' ? 'bg-green-500' :
                        formData.brandColor === 'purple' ? 'bg-purple-500' :
                        formData.brandColor === 'orange' ? 'bg-orange-500' :
                        formData.brandColor === 'red' ? 'bg-red-500' :
                        formData.brandColor === 'indigo' ? 'bg-indigo-500' :
                        formData.brandColor === 'teal' ? 'bg-teal-500' :
                        formData.brandColor === 'rose' ? 'bg-rose-500' :
                        formData.brandColor === 'amber' ? 'bg-amber-500' :
                        formData.brandColor === 'emerald' ? 'bg-emerald-500' :
                        formData.brandColor === 'cyan' ? 'bg-cyan-500' :
                        formData.brandColor === 'sky' ? 'bg-sky-500' :
                        'bg-blue-500'
                      }`} />
                      <span className={`h-1.5 w-8 rounded-full ${
                        formData.brandColor === 'green' ? 'bg-green-500' :
                        formData.brandColor === 'purple' ? 'bg-purple-500' :
                        formData.brandColor === 'orange' ? 'bg-orange-500' :
                        formData.brandColor === 'red' ? 'bg-red-500' :
                        formData.brandColor === 'indigo' ? 'bg-indigo-500' :
                        formData.brandColor === 'teal' ? 'bg-teal-500' :
                        formData.brandColor === 'rose' ? 'bg-rose-500' :
                        formData.brandColor === 'amber' ? 'bg-amber-500' :
                        formData.brandColor === 'emerald' ? 'bg-emerald-500' :
                        formData.brandColor === 'cyan' ? 'bg-cyan-500' :
                        formData.brandColor === 'sky' ? 'bg-sky-500' :
                        'bg-blue-500'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-3xs text-center text-muted-foreground mt-3 italic">
                * La previsualización representa el estilo del Header responsivo del sitio web público.
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Información de Contacto</CardTitle>
              <CardDescription className="text-xs md:text-sm">Datos de contacto mostrados en el portal público</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-blue-600" />
                Teléfono
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+595 981 000 000"
                maxLength={50}
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 h-11"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp <span className="text-xs font-normal text-muted-foreground">— opcional</span>
              </Label>
              <Input
                id="whatsapp"
                type="tel"
                value={formData.whatsapp || ''}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                placeholder="+595 981 000 000"
                maxLength={50}
                className="border-gray-200 focus:border-green-500 focus:ring-green-500 h-11"
              />
              {formData.whatsapp && (
                <p className="text-xs text-muted-foreground">wa.me/{formData.whatsapp.replace(/\D/g, '')}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-indigo-600" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="info@empresa.com"
                maxLength={100}
                className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 h-11"
              />
            </div>

            {/* Dirección */}
            <div className="col-span-full space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-purple-600" />
                Dirección
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Av. Principal 123, Ciudad"
                maxLength={300}
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500 h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Horarios de Atención</CardTitle>
              <CardDescription className="text-xs md:text-sm">Horarios mostrados a los clientes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weekdays" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lunes - Viernes
              </Label>
              <Input
                id="weekdays"
                value={formData.hours.weekdays}
                onChange={(e) => handleChange('hours.weekdays', e.target.value)}
                placeholder="8:00 - 18:00"
                maxLength={50}
                className="border-gray-200 focus:border-green-500 focus:ring-green-500 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saturday" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sábados
              </Label>
              <Input
                id="saturday"
                value={formData.hours.saturday}
                onChange={(e) => handleChange('hours.saturday', e.target.value)}
                placeholder="9:00 - 13:00"
                maxLength={50}
                className="border-gray-200 focus:border-green-500 focus:ring-green-500 h-11"
              />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="sunday" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Domingos
              </Label>
              <Input
                id="sunday"
                value={formData.hours.sunday}
                onChange={(e) => handleChange('hours.sunday', e.target.value)}
                placeholder="Cerrado"
                maxLength={50}
                className="border-gray-200 focus:border-green-500 focus:ring-green-500 h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal y negocio */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/20 dark:to-gray-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Legal y Negocio</CardTitle>
              <CardDescription className="text-xs md:text-sm">RUC, tipo de actividad y datos fiscales</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ruc" className="text-sm font-medium">
                RUC / Tax ID <span className="text-xs font-normal text-muted-foreground">— opcional</span>
              </Label>
              <Input
                id="ruc"
                value={formData.ruc || ''}
                onChange={(e) => handleChange('ruc', e.target.value)}
                placeholder="12345678-9"
                maxLength={50}
                className="border-gray-200 focus:border-slate-500 focus:ring-slate-500 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType" className="text-sm font-medium">Tipo de negocio</Label>
              <select
                id="businessType"
                value={formData.businessType || ''}
                onChange={(e) => handleChange('businessType', e.target.value)}
                className="flex h-11 w-full rounded-md border border-gray-200 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Seleccionar...</option>
                <option value="retail">Minorista (tienda fisica)</option>
                <option value="repair">Reparaciones tecnicas</option>
                <option value="wholesale">Mayorista / distribucion</option>
                <option value="service">Servicios profesionales</option>
                <option value="mixed">Mixto (venta + servicio)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes sociales */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400 shrink-0">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Redes Sociales</CardTitle>
              <CardDescription className="text-xs md:text-sm">Enlaza el perfil de la empresa en cada red — opcional</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="instagram" className="text-sm font-medium">Instagram</Label>
              <div className="flex overflow-hidden rounded-md border border-gray-200 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-gray-200 bg-muted/40 px-3 text-xs text-muted-foreground">instagram.com/</span>
                <Input
                  id="instagram"
                  value={formData.instagram || ''}
                  onChange={(e) => handleChange('instagram', e.target.value)}
                  placeholder="tu_usuario"
                  maxLength={100}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook" className="text-sm font-medium">Facebook</Label>
              <div className="flex overflow-hidden rounded-md border border-gray-200 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-gray-200 bg-muted/40 px-3 text-xs text-muted-foreground">facebook.com/</span>
                <Input
                  id="facebook"
                  value={formData.facebook || ''}
                  onChange={(e) => handleChange('facebook', e.target.value)}
                  placeholder="tu_pagina"
                  maxLength={100}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tiktok" className="text-sm font-medium">TikTok</Label>
              <div className="flex overflow-hidden rounded-md border border-gray-200 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="flex shrink-0 items-center border-r border-gray-200 bg-muted/40 px-3 text-xs text-muted-foreground">tiktok.com/@</span>
                <Input
                  id="tiktok"
                  value={formData.tiktok || ''}
                  onChange={(e) => handleChange('tiktok', e.target.value)}
                  placeholder="tu_usuario"
                  maxLength={100}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón de guardar flotante */}
      <div className="fixed bottom-6 right-6 md:sticky md:bottom-6 md:flex md:justify-end z-50">
        <Button 
          type="submit" 
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 rounded-full md:rounded-xl px-8 md:px-6 h-14 md:h-12"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="hidden md:inline">Guardando...</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              <span className="hidden md:inline">Guardar Cambios</span>
              <span className="md:hidden">Guardar</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
