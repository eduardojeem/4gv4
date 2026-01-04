'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Mail, Phone, MapPin, Globe, Star,
  Package, Truck, User, Sparkles, Tag, AlertCircle
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { validateSupplier, formatValidationErrors, businessTypeLabels, statusLabels, type SupplierFormData } from '@/lib/validations/supplier'
import type { UISupplier } from '@/lib/types/supplier-ui'

interface SupplierModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (supplier: Partial<UISupplier>) => Promise<void>
  supplier?: Partial<UISupplier> | null
  mode: 'add' | 'edit'
  loading?: boolean
}

const BUSINESS_TYPES = [
  { value: 'manufacturer', label: 'Fabricante' },
  { value: 'distributor', label: 'Distribuidor' },
  { value: 'wholesaler', label: 'Mayorista' },
  { value: 'service_provider', label: 'Proveedor de Servicios' },
  { value: 'retailer', label: 'Minorista' }
]

export function SupplierModal({ isOpen, onClose, onSave, supplier, mode, loading = false }: SupplierModalProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postal_code: '',
    website: '',
    business_type: 'manufacturer',
    status: 'pending',
    rating: 0,
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (supplier && mode === 'edit') {
      setFormData({
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        country: supplier.country || '',
        postal_code: supplier.postal_code || '',
        website: supplier.website || '',
        business_type: supplier.business_type || 'manufacturer',
        status: supplier.status || 'pending',
        rating: supplier.rating || 0,
        notes: supplier.notes || ''
      })
    } else {
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        postal_code: '',
        website: '',
        business_type: 'manufacturer',
        status: 'pending',
        rating: 0,
        notes: ''
      })
    }
    setErrors({})
    setActiveTab('basic')
  }, [supplier, mode, isOpen])

  const handleInputChange = (field: keyof SupplierFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form data
    const validation = validateSupplier(formData)
    
    if (!validation.success) {
      const formattedErrors = formatValidationErrors(validation.errors)
      setErrors(formattedErrors)
      
      // Switch to the tab with the first error
      const firstErrorField = Object.keys(formattedErrors)[0]
      if (['name', 'contact_person', 'email', 'phone'].includes(firstErrorField)) {
        setActiveTab('basic')
      } else if (['address', 'city', 'country', 'postal_code', 'website'].includes(firstErrorField)) {
        setActiveTab('contact')
      } else {
        setActiveTab('business')
      }
      
      return
    }

    try {
      setIsSubmitting(true)
      await onSave(validation.data)
      onClose()
    } catch (error) {
      console.error('Error saving supplier:', error)
      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes('duplicate key') || error.message.includes('23505')) {
          setErrors({ email: 'Ya existe un proveedor con este email' })
          setActiveTab('basic')
        } else {
          setErrors({ general: 'Error al guardar el proveedor. Intenta nuevamente.' })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold">
                {mode === 'add' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'add' ? 'Agregar un nuevo proveedor al sistema' : `Editar: ${supplier?.name}`}
              </DialogDescription>
            </div>
          </div>

          {/* General Error Alert */}
          {errors.general && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Básico
                  {(errors.name || errors.business_type || errors.status) && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contacto
                  {(errors.contact_person || errors.email || errors.phone) && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="additional" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Adicional
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto py-6">
                {/* Basic Information */}
                <TabsContent value="basic" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre del Proveedor *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Ej: Distribuidora ABC"
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business_type">Tipo de Negocio</Label>
                      <Select
                        value={formData.business_type}
                        onValueChange={(value) => handleInputChange('business_type', value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => handleInputChange('status', value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="pending">Pendiente</SelectItem>
                          <SelectItem value="suspended">Suspendido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Calificación</Label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleInputChange('rating', star)}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`h-5 w-5 ${
                                star <= formData.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300 hover:text-yellow-400'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-muted-foreground">{formData.rating}/5</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Contact Information */}
                <TabsContent value="contact" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="contact_person">Nombre del Contacto *</Label>
                      <Input
                        id="contact_person"
                        value={formData.contact_person}
                        onChange={(e) => handleInputChange('contact_person', e.target.value)}
                        placeholder="Juan Pérez"
                        className={errors.contact_person ? 'border-red-500' : ''}
                      />
                      {errors.contact_person && <p className="text-sm text-red-500">{errors.contact_person}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="contacto@empresa.com"
                        className={errors.email ? 'border-red-500' : ''}
                      />
                      {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+1 234 567 8900"
                        className={errors.phone ? 'border-red-500' : ''}
                      />
                      {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Sitio Web</Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="https://www.empresa.com"
                        className={errors.website ? 'border-red-500' : ''}
                      />
                      {errors.website && <p className="text-sm text-red-500">{errors.website}</p>}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Calle Principal 123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="Ciudad"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">País</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        placeholder="País"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código Postal</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => handleInputChange('postal_code', e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Additional Information */}
                <TabsContent value="additional" className="space-y-6 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas Internas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Escribe aquí cualquier nota relevante sobre este proveedor..."
                      rows={6}
                      className="resize-none"
                    />
                    {errors.notes && <p className="text-sm text-red-500">{errors.notes}</p>}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span> Guardando...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  {mode === 'add' ? 'Crear Proveedor' : 'Actualizar Proveedor'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}