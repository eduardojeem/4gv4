'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Building2, Globe, Star, MapPin, Calendar, Mail, Phone, Save, X, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Brand, BrandFormData, ValidationErrors, ModalMode } from '@/lib/types/catalog'

interface BrandModalProps {
  isOpen: boolean
  onClose: () => void
  mode: ModalMode
  brand?: Brand
  onSave: (brand: Brand) => void
  existingBrands: Brand[]
}

const COUNTRIES = [
  'Estados Unidos', 'China', 'Corea del Sur', 'Japón', 'Alemania', 
  'Reino Unido', 'Francia', 'Italia', 'España', 'Canadá', 'Australia',
  'Brasil', 'México', 'Argentina', 'Chile', 'Colombia', 'Perú'
]

const CURRENT_YEAR = new Date().getFullYear()

export function BrandModal({
  isOpen,
  onClose,
  mode,
  brand,
  onSave,
  existingBrands
}: BrandModalProps) {
  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    description: '',
    website: '',
    country: '',
    foundedYear: undefined,
    contactEmail: '',
    contactPhone: ''
  })
  
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Inicializar formulario cuando cambia la marca
  useEffect(() => {
    if (mode === 'edit' && brand) {
      setFormData({
        name: brand.name,
        description: brand.description,
        website: brand.website || '',
        country: brand.country || '',
        foundedYear: brand.foundedYear,
        contactEmail: brand.contactInfo?.email || '',
        contactPhone: brand.contactInfo?.phone || ''
      })
    } else {
      setFormData({
        name: '',
        description: '',
        website: '',
        country: '',
        foundedYear: undefined,
        contactEmail: '',
        contactPhone: ''
      })
    }
    setErrors({})
  }, [mode, brand, isOpen])

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    // Validar nombre
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (formData.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    } else {
      // Verificar duplicados
      const isDuplicate = existingBrands.some(b => 
        b.name.toLowerCase() === formData.name.toLowerCase() && 
        b.id !== brand?.id
      )
      if (isDuplicate) {
        newErrors.name = 'Ya existe una marca con este nombre'
      }
    }

    // Validar descripción
    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida'
    } else if (formData.description.length < 10) {
      newErrors.description = 'La descripción debe tener al menos 10 caracteres'
    }

    // Validar sitio web (opcional pero debe ser válido si se proporciona)
    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'El sitio web debe ser una URL válida (http:// o https://)'
    }

    // Validar año de fundación
    if (formData.foundedYear && (formData.foundedYear < 1800 || formData.foundedYear > CURRENT_YEAR)) {
      newErrors.foundedYear = `El año debe estar entre 1800 y ${CURRENT_YEAR}`
    }

    // Validar email de contacto
    if (formData.contactEmail && !formData.contactEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.contactEmail = 'El email debe tener un formato válido'
    }

    // Validar teléfono de contacto
    if (formData.contactPhone && !formData.contactPhone.match(/^[\+]?[0-9\s\-\(\)]{10,}$/)) {
      newErrors.contactPhone = 'El teléfono debe tener al menos 10 dígitos'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof BrandFormData, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Por favor corrige los errores en el formulario')
      return
    }

    setIsSubmitting(true)

    try {
      const brandData: Brand = {
        id: brand?.id || `brand_${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description.trim(),
        website: formData.website.trim() || undefined,
        country: formData.country || undefined,
        foundedYear: formData.foundedYear,
        isActive: brand?.isActive ?? true,
        productCount: brand?.productCount ?? 0,
        rating: brand?.rating,
        createdAt: brand?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contactInfo: {
          email: formData.contactEmail?.trim() || undefined,
          phone: formData.contactPhone?.trim() || undefined
        }
      }

      onSave(brandData)
      
      toast.success(
        mode === 'add' 
          ? 'Marca creada exitosamente' 
          : 'Marca actualizada exitosamente'
      )
      
      onClose()
    } catch (error) {
      toast.error('Error al guardar la marca')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5 text-blue-600" />
            {mode === 'add' ? 'Agregar Nueva Marca' : 'Editar Marca'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' 
              ? 'Registra una nueva marca para tus productos'
              : 'Modifica la información de la marca'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Detalles
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Contacto
              </TabsTrigger>
            </TabsList>

            {/* Información básica */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Nombre */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Nombre de la Marca *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Ej: Apple, Samsung, Xiaomi"
                      className={cn(errors.name && 'border-red-500')}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Descripción *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe la marca, su enfoque y características principales"
                      rows={4}
                      className={cn(errors.description && 'border-red-500')}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Detalles adicionales */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sitio web */}
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Sitio Web
                    </Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://www.ejemplo.com"
                      className={cn(errors.website && 'border-red-500')}
                    />
                    {errors.website && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.website}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* País */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        País de Origen
                      </Label>
                      <Select value={formData.country} onValueChange={(value) => handleInputChange('country', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar país" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Año de fundación */}
                    <div className="space-y-2">
                      <Label htmlFor="foundedYear" className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Año de Fundación
                      </Label>
                      <Input
                        id="foundedYear"
                        type="number"
                        min="1800"
                        max={CURRENT_YEAR}
                        value={formData.foundedYear || ''}
                        onChange={(e) => handleInputChange('foundedYear', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Ej: 1976"
                        className={cn(errors.foundedYear && 'border-red-500')}
                      />
                      {errors.foundedYear && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.foundedYear}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Información de contacto */}
            <TabsContent value="contact" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Información de Contacto
                  </CardTitle>
                  <CardDescription>
                    Información opcional para contactar con la marca
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-sm font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email de Contacto
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      placeholder="contacto@marca.com"
                      className={cn(errors.contactEmail && 'border-red-500')}
                    />
                    {errors.contactEmail && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone" className="text-sm font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Teléfono de Contacto
                    </Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className={cn(errors.contactPhone && 'border-red-500')}
                    />
                    {errors.contactPhone && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.contactPhone}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === 'add' ? 'Crear Marca' : 'Actualizar Marca'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}