'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Save, Phone, Mail, MapPin, Clock, Check } from 'lucide-react'
import { CompanyInfo } from '@/types/website-settings'

export function CompanyInfoForm() {
  const { settings, isLoading, error, isSaving, updateSetting } = useAdminWebsiteSettings()
  const [formData, setFormData] = useState<CompanyInfo | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings?.company_info) {
      setFormData(settings.company_info)
    }
  }, [settings?.company_info])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Información de Contacto</CardTitle>
              <CardDescription>Datos de contacto mostrados en el portal público</CardDescription>
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
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
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
                className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
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
                className="border-gray-200 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Horarios de Atención</CardTitle>
              <CardDescription>Horarios mostrados a los clientes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
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
                className="border-gray-200 focus:border-green-500 focus:ring-green-500"
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
                className="border-gray-200 focus:border-green-500 focus:ring-green-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sunday" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Domingos
              </Label>
              <Input
                id="sunday"
                value={formData.hours.sunday}
                onChange={(e) => handleChange('hours.sunday', e.target.value)}
                placeholder="Cerrado"
                maxLength={50}
                className="border-gray-200 focus:border-green-500 focus:ring-green-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón de guardar flotante */}
      <div className="sticky bottom-6 flex justify-end">
        <Button 
          type="submit" 
          disabled={isSaving || !hasChanges}
          size="lg"
          className="shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
