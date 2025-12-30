'use client'

import { useState, useEffect } from 'react'
import {
  Building2, Mail, Phone, MapPin, Globe, Star,
  Package, Truck, User, Sparkles, Tag
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

interface SupplierModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (supplier: Partial<import('@/lib/types/supplier-ui').UISupplier>) => void
  supplier?: Partial<import('@/lib/types/supplier-ui').UISupplier> | null
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
  const [formData, setFormData] = useState({
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
    status: 'active',
    rating: 0,
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        status: supplier.status || 'active',
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
        status: 'active',
        rating: 0,
        notes: ''
      })
    }
    setErrors({})
    setActiveTab('basic')
  }, [supplier, mode, isOpen])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Nombre requerido'
    if (!formData.email.trim()) newErrors.email = 'Email requerido'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido'
    if (!formData.phone.trim()) newErrors.phone = 'Teléfono requerido'
    if (!formData.contact_person.trim()) newErrors.contact_person = 'Contacto requerido'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData as any)
    }
  }

  const renderStars = () => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 cursor-pointer transition-colors ${star <= formData.rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300 hover:text-yellow-400'
            }`}
          onClick={() => handleInputChange('rating', star)}
        />
      ))}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl h-[95vh] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-950">
        {/* Modern Header */}
        <div className="bg-slate-900 dark:bg-slate-950 px-8 py-6 text-white border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-800 dark:bg-slate-900 rounded-xl border border-slate-700">
                <Building2 className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">
                  {mode === 'add' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  {mode === 'add' ? 'Agregar un nuevo proveedor al sistema' : `Editar: ${supplier?.name}`}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
                <span className={`text-sm font-medium ${formData.status === 'active' ? 'text-green-400' : 'text-slate-400'}`}>
                  {formData.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
                <Switch
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) => handleInputChange('status', checked ? 'active' : 'inactive')}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="md:w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
              <TabsList className="flex flex-col h-auto bg-transparent w-full gap-2 p-0">
                <TabsTrigger
                  value="basic"
                  className="w-full justify-start gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg transition-all"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Información Básica</span>
                  {errors.name && <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />}
                </TabsTrigger>
                <TabsTrigger
                  value="contact"
                  className="w-full justify-start gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg transition-all"
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium">Contacto</span>
                  {(errors.email || errors.phone || errors.contact_person) && <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />}
                </TabsTrigger>
                <TabsTrigger
                  value="additional"
                  className="w-full justify-start gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 rounded-lg transition-all"
                >
                  <Tag className="h-4 w-4" />
                  <span className="font-medium">Adicional</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Quick Info */}
            {supplier && (
              <div className="mt-8 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vista Rápida</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Calificación</p>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < formData.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estado</p>
                    <Badge variant={formData.status === 'active' ? 'default' : 'secondary'} className="w-full justify-center">
                      {formData.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-3xl mx-auto" orientation="vertical">

              {/* Información Básica */}
              <TabsContent value="basic" className="space-y-8 mt-0 animate-in fade-in-50 duration-500 slide-in-from-bottom-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Datos del Proveedor</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Información principal de la empresa.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nombre del Proveedor <span className="text-red-500">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Ej: Distribuidora ABC"
                        className={`bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors ${errors.name ? 'border-red-500 focus:ring-red-200 dark:focus:ring-red-900' : 'focus:ring-slate-200 dark:focus:ring-slate-800'}`}
                      />
                      {errors.name && <p className="text-xs text-red-500 font-medium mt-1">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business_type" className="text-slate-700 dark:text-slate-300">Tipo de Negocio</Label>
                      <Select
                        value={formData.business_type}
                        onValueChange={(value) => handleInputChange('business_type', value)}
                      >
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors">
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
                      <Label htmlFor="status" className="text-slate-700 dark:text-slate-300">Estado</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="pending">Pendiente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Calificación</Label>
                      <div className="flex items-center gap-1 p-2 border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50 dark:bg-slate-900">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleInputChange('rating', star)}
                            className="focus:outline-none hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`h-5 w-5 ${
                                star <= formData.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{formData.rating}/5</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Contacto */}
              <TabsContent value="contact" className="space-y-8 mt-0 animate-in fade-in-50 duration-500 slide-in-from-bottom-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Información de Contacto</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Detalles de contacto y ubicación.</p>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">Contacto Directo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="contact_person" className="text-slate-700 dark:text-slate-300">Nombre del Contacto <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="contact_person"
                            value={formData.contact_person}
                            onChange={(e) => handleInputChange('contact_person', e.target.value)}
                            placeholder="Juan Pérez"
                            className={`pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors ${errors.contact_person ? 'border-red-500 focus:ring-red-200 dark:focus:ring-red-900' : 'focus:ring-slate-200 dark:focus:ring-slate-800'}`}
                          />
                        </div>
                        {errors.contact_person && <p className="text-xs text-red-500 font-medium mt-1">{errors.contact_person}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="contacto@empresa.com"
                            className={`pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors ${errors.email ? 'border-red-500 focus:ring-red-200 dark:focus:ring-red-900' : 'focus:ring-slate-200 dark:focus:ring-slate-800'}`}
                          />
                        </div>
                        {errors.email && <p className="text-xs text-red-500 font-medium mt-1">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-slate-700 dark:text-slate-300">Teléfono <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="+1 234 567 8900"
                            className={`pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors ${errors.phone ? 'border-red-500 focus:ring-red-200 dark:focus:ring-red-900' : 'focus:ring-slate-200 dark:focus:ring-slate-800'}`}
                          />
                        </div>
                        {errors.phone && <p className="text-xs text-red-500 font-medium mt-1">{errors.phone}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website" className="text-slate-700 dark:text-slate-300">Sitio Web</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="website"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            placeholder="https://www.empresa.com"
                            className="pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Address Details */}
                  <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">Ubicación</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="address" className="text-slate-700 dark:text-slate-300">Dirección</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            placeholder="Calle Principal 123"
                            className="pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-slate-700 dark:text-slate-300">Ciudad</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            placeholder="Ciudad"
                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-slate-700 dark:text-slate-300">País</Label>
                          <Input
                            id="country"
                            value={formData.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            placeholder="País"
                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="postal_code" className="text-slate-700 dark:text-slate-300">Código Postal</Label>
                          <Input
                            id="postal_code"
                            value={formData.postal_code}
                            onChange={(e) => handleInputChange('postal_code', e.target.value)}
                            placeholder="12345"
                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Adicional */}
              <TabsContent value="additional" className="space-y-8 mt-0 animate-in fade-in-50 duration-500 slide-in-from-bottom-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Información Adicional</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Notas y detalles extra.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-slate-700 dark:text-slate-300">Notas Internas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Escribe aquí cualquier nota relevante sobre este proveedor..."
                      rows={8}
                      className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 transition-colors focus:ring-slate-200 dark:focus:ring-slate-800 resize-none"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 px-8 py-4 flex justify-between items-center gap-4 z-10">
          <div className="text-sm text-gray-600 dark:text-slate-400 hidden md:block">
            {mode === 'add' ? 'Creando nuevo proveedor' : 'Modificando proveedor existente'}
          </div>
          <div className="flex gap-3 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="min-w-[100px] dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="min-w-[140px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white shadow-lg shadow-slate-900/20 dark:shadow-none"
            >
              {loading ? (
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
export default SupplierModal
