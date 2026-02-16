'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Phone, Mail, MapPin, Clock, Check, Sparkles } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CompanyInfo } from '@/types/website-settings'

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [formData, setFormData] = useState<CompanyInfo | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings?.company_info) {
      setFormData(settings.company_info)
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        hours: { weekdays: '', saturday: '', sunday: '' },
        logoUrl: '',
        brandColor: 'blue',
        headerStyle: 'glass',
        showTopBar: true
      })
    }
  }, [settings?.company_info])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

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

    const result = await updateSetting('company_info', formData)
    if (result.success) {
      toast.success('Información de empresa actualizada', {
        description: 'Los cambios se reflejarán en el portal público',
        icon: <Check className="h-4 w-4" />
      })
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Error al guardar')
    }
  }

  const handleChange = (field: keyof CompanyInfo | string, value: string) => {
    if (!formData) return
    setHasChanges(true)

    if (field.startsWith('hours.')) {
      const hourField = field.split('.')[1] as 'weekdays' | 'saturday' | 'sunday'
      setFormData({
        ...formData,
        hours: {
          ...formData.hours,
          [hourField]: value
        }
      })
    } else {
      setFormData({
        ...formData,
        [field]: value
      })
    }
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

  if (!formData) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            No se encontró información de empresa configurada.
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
            <div className="space-y-2 md:col-span-1">
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

            {/* Color de marca */}
            <div className="space-y-2 md:col-span-1">
              <Label className="text-sm font-medium">Color de marca</Label>
              <div className="flex flex-wrap gap-2">
                {['blue','green','purple','orange','red','indigo','teal'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChange('brandColor', c)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      (formData.brandColor || 'blue') === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                    } ${
                      c === 'blue' ? 'bg-blue-500 border-blue-600' :
                      c === 'green' ? 'bg-green-500 border-green-600' :
                      c === 'purple' ? 'bg-purple-500 border-purple-600' :
                      c === 'orange' ? 'bg-orange-500 border-orange-600' :
                      c === 'red' ? 'bg-red-500 border-red-600' :
                      c === 'indigo' ? 'bg-indigo-500 border-indigo-600' :
                      'bg-teal-500 border-teal-600'
                    }`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Logo URL */}
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="logoUrl" className="text-sm font-medium">Logo (URL)</Label>
              <Input
                id="logoUrl"
                value={formData.logoUrl || ''}
                onChange={(e) => handleChange('logoUrl', e.target.value)}
                placeholder="https://cdn.miempresa.com/logo.png"
                maxLength={300}
                className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personalización Visual */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg md:text-xl">Personalización Visual</CardTitle>
              <CardDescription className="text-xs md:text-sm">Colores de marca y estilo del sitio</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Gama de Colores */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Color de Marca Principal</Label>
              <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-12">
                {[
                  'blue','green','purple','orange','red','indigo','teal',
                  'rose','amber','emerald','cyan','sky'
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChange('brandColor', c)}
                    className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                      (formData.brandColor || 'blue') === c ? 'ring-2 ring-offset-2 ring-pink-500 border-white' : 'border-transparent'
                    } ${
                      c === 'blue' ? 'bg-blue-500' :
                      c === 'green' ? 'bg-green-500' :
                      c === 'purple' ? 'bg-purple-500' :
                      c === 'orange' ? 'bg-orange-500' :
                      c === 'red' ? 'bg-red-500' :
                      c === 'indigo' ? 'bg-indigo-500' :
                      c === 'teal' ? 'bg-teal-500' :
                      c === 'rose' ? 'bg-rose-500' :
                      c === 'amber' ? 'bg-amber-500' :
                      c === 'emerald' ? 'bg-emerald-500' :
                      c === 'cyan' ? 'bg-cyan-500' :
                      'bg-sky-500'
                    }`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Estilo de Header */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="headerStyle" className="text-sm font-medium">Estilo del Header</Label>
                  <Select 
                    value={formData.headerStyle || 'glass'} 
                    onValueChange={(v) => handleChange('headerStyle', v)}
                  >
                    <SelectTrigger id="headerStyle" className="h-11">
                      <SelectValue placeholder="Seleccionar estilo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glass text-sm">Cristal (Moderno)</SelectItem>
                      <SelectItem value="solid">Sólido Blanco</SelectItem>
                      <SelectItem value="accent">Color de Marca</SelectItem>
                      <SelectItem value="dark">Negro Elegante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <Label htmlFor="showTopBar" className="text-sm font-medium">Barra superior</Label>
                  <div className="flex items-center space-x-2 h-11">
                    <Switch
                      id="showTopBar"
                      checked={formData.showTopBar !== false}
                      onCheckedChange={(checked) => {
                        setHasChanges(true)
                        setFormData({ ...formData, showTopBar: checked })
                      }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.showTopBar !== false ? 'Visible' : 'Oculta'}
                    </span>
                  </div>
                </div>
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
                placeholder="+595 123 456 789"
                maxLength={20}
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 h-11"
              />
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
                maxLength={200}
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
