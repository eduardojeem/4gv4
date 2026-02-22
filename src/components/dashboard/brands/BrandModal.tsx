'use client'

import React, { useState, useEffect } from 'react'
import { Building2, Globe, MapPin, Calendar, Mail, Phone, Save, X, AlertCircle } from 'lucide-react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Brand } from '@/hooks/useBrands'
import type { Database } from '@/lib/supabase/types'

type BrandInsert = Database['public']['Tables']['brands']['Insert']

interface BrandModalProps {
  isOpen: boolean
  onClose: () => void
  brand?: Brand
  onSave: (brandData: BrandInsert) => Promise<{ success: boolean; error?: string }>
}

const COUNTRIES = [
  'Estados Unidos', 'China', 'Corea del Sur', 'Japón', 'Alemania', 
  'Reino Unido', 'Francia', 'Italia', 'España', 'Canadá', 'Australia',
  'Brasil', 'México', 'Argentina', 'Chile', 'Colombia', 'Perú', 'Paraguay', 'Uruguay'
]

const CURRENT_YEAR = new Date().getFullYear()

export function BrandModal({
  isOpen,
  onClose,
  brand,
  onSave
}: BrandModalProps) {
  const [formData, setFormData] = useState<BrandInsert>({
    name: '',
    description: '',
    website: '',
    country: '',
    founded_year: undefined,
    is_active: true
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form when brand changes
  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name,
        description: brand.description || '',
        website: brand.website || '',
        country: brand.country || '',
        founded_year: brand.founded_year,
        is_active: brand.is_active
      })
    } else {
      setFormData({
        name: '',
        description: '',
        website: '',
        country: '',
        founded_year: undefined,
        is_active: true
      })
    }
    setErrors({})
  }, [brand, isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (formData.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    }

    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'El sitio web debe ser una URL válida (http:// o https://)'
    }

    if (formData.founded_year && (formData.founded_year < 1800 || formData.founded_year > CURRENT_YEAR)) {
      newErrors.founded_year = `El año debe estar entre 1800 y ${CURRENT_YEAR}`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof BrandInsert, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
      // Clean up data before sending - ensure proper null values
      const dataToSend: BrandInsert = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        website: formData.website?.trim() || null,
        country: formData.country || null,
        founded_year: formData.founded_year || null,
        is_active: formData.is_active ?? true
      }

      console.log('Submitting brand data:', dataToSend)
      const result = await onSave(dataToSend)
      
      if (result.success) {
        toast.success(
          brand 
            ? 'Marca actualizada exitosamente' 
            : 'Marca creada exitosamente'
        )
        onClose()
      } else {
        toast.error(result.error || 'Error al guardar la marca')
        console.error('Error saving brand:', result)
      }
    } catch (error) {
      toast.error('Error al guardar la marca')
      console.error('Exception saving brand:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5 text-blue-600" />
            {brand ? 'Editar Marca' : 'Agregar Nueva Marca'}
          </DialogTitle>
          <DialogDescription>
            {brand 
              ? 'Modifica la información de la marca'
              : 'Registra una nueva marca para tus productos'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Detalles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Información Básica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Descripción
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe la marca..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium">
                      Sitio Web
                    </Label>
                    <Input
                      id="website"
                      value={formData.website || ''}
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
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        País de Origen
                      </Label>
                      <Select 
                        value={formData.country || ''} 
                        onValueChange={(value) => handleInputChange('country', value)}
                      >
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

                    <div className="space-y-2">
                      <Label htmlFor="founded_year" className="text-sm font-medium">
                        Año de Fundación
                      </Label>
                      <Input
                        id="founded_year"
                        type="number"
                        min="1800"
                        max={CURRENT_YEAR}
                        value={formData.founded_year || ''}
                        onChange={(e) => handleInputChange('founded_year', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Ej: 1976"
                        className={cn(errors.founded_year && 'border-red-500')}
                      />
                      {errors.founded_year && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.founded_year}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
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
                  {brand ? 'Actualizar Marca' : 'Crear Marca'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
