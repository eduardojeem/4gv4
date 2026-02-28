'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, User, Star, Tag, AlertCircle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { supplierSchema, type SupplierFormData } from '@/lib/validations/supplier'
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
  { value: 'retailer', label: 'Minorista' },
]

export function SupplierModal({ isOpen, onClose, onSave, supplier, mode, loading = false }: SupplierModalProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [generalError, setGeneralError] = useState<string | null>(null)

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name || '',
      contact_name: supplier?.contact_name || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      city: supplier?.city || '',
      country: supplier?.country || '',
      postal_code: supplier?.postal_code || '',
      website: supplier?.website || '',
      business_type: (supplier?.business_type as any) || 'manufacturer',
      status: (supplier?.status as any) || 'pending',
      rating: supplier?.rating || 0,
      notes: supplier?.notes || '',
    },
  })

  // Reset form when modal opens or supplier changes
  useEffect(() => {
    if (isOpen) {
      setGeneralError(null)
      setActiveTab('basic')
      
      const values: SupplierFormData = {
        name: supplier?.name || '',
        contact_name: supplier?.contact_name || '',
        email: supplier?.email || '',
        phone: supplier?.phone || '',
        address: supplier?.address || '',
        city: supplier?.city || '',
        country: supplier?.country || '',
        postal_code: supplier?.postal_code || '',
        website: supplier?.website || '',
        business_type: (supplier?.business_type as any) || 'manufacturer',
        status: (supplier?.status as any) || 'pending',
        rating: supplier?.rating || 0,
        notes: supplier?.notes || '',
      }
      form.reset(values)
    }
  }, [isOpen, supplier, mode, form])

  const onSubmit = async (data: SupplierFormData) => {
    setGeneralError(null)
    try {
      await onSave(data)
      onClose()
    } catch (error) {
      console.error('Error saving supplier:', error)
      if (error instanceof Error) {
        // Handle specific Supabase/Hook errors
        if (error.message.includes('duplicate key') || error.message.includes('23505') || error.message.includes('Ya existe')) {
          form.setError('email', { 
            type: 'manual', 
            message: 'Ya existe un proveedor con este email o nombre.' 
          })
          setGeneralError('Ya existe un proveedor con estos datos. Por favor verifica el email.')
          setActiveTab('contact')
        } else {
          setGeneralError(error.message || 'Error al guardar el proveedor. Intenta nuevamente.')
        }
      } else {
        setGeneralError('Error desconocido al guardar el proveedor.')
      }
    }
  }

  // Handle form validation errors to switch tabs
  const onError = (errors: any) => {
    const errorFields = Object.keys(errors)
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0]
      if (['name', 'business_type', 'status', 'rating'].includes(firstErrorField)) {
        setActiveTab('basic')
      } else if (['contact_name', 'email', 'phone', 'address', 'city', 'country', 'postal_code', 'website'].includes(firstErrorField)) {
        setActiveTab('contact')
      } else if (['notes'].includes(firstErrorField)) {
        setActiveTab('additional')
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !form.formState.isSubmitting && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-5 border-b shrink-0 flex flex-row items-center space-y-0 gap-4">
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
        </DialogHeader>

        {generalError && (
          <Alert variant="destructive" className="mx-6 mt-4 shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden px-6 pt-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
                <TabsList className="grid w-full grid-cols-3 shrink-0 mb-2">
                  <TabsTrigger value="basic" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Básico
                    {form.formState.errors.name || form.formState.errors.business_type || form.formState.errors.status ? (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contacto
                    {form.formState.errors.contact_name || form.formState.errors.email || form.formState.errors.phone ? (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="additional" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Adicional
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-hidden py-4">
                  <TabsContent value="basic" className="h-full mt-0 data-[state=active]:flex flex-col">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre del Proveedor *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: Distribuidora ABC" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="business_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo de Negocio *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un tipo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {BUSINESS_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un estado" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="inactive">Inactivo</SelectItem>
                                    <SelectItem value="pending">Pendiente</SelectItem>
                                    <SelectItem value="suspended">Suspendido</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="rating"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Calificación</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => field.onChange(star)}
                                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                      >
                                        <Star
                                          className={`h-5 w-5 ${
                                            star <= field.value
                                              ? 'fill-yellow-400 text-yellow-400'
                                              : 'text-gray-300 hover:text-yellow-400'
                                          }`}
                                        />
                                      </button>
                                    ))}
                                    <span className="ml-2 text-sm text-muted-foreground">{field.value}/5</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="contact" className="h-full mt-0 data-[state=active]:flex flex-col">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="contact_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre del Contacto *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Juan Pérez" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email *</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="contacto@empresa.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Teléfono *</FormLabel>
                                <FormControl>
                                  <Input placeholder="+1 234 567 8900" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Sitio Web</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://www.empresa.com" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Dirección</FormLabel>
                                <FormControl>
                                  <Input placeholder="Calle Principal 123" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ciudad</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ciudad" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>País</FormLabel>
                                <FormControl>
                                  <Input placeholder="País" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="postal_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código Postal</FormLabel>
                                <FormControl>
                                  <Input placeholder="12345" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="additional" className="h-full mt-0 data-[state=active]:flex flex-col">
                    <ScrollArea className="h-full pr-4">
                      <div className="space-y-6 pb-6">
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notas Internas</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Escribe aquí cualquier nota relevante sobre este proveedor..."
                                  rows={6}
                                  className="resize-none"
                                  {...field}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between border rounded-lg p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Proveedor activo</FormLabel>
                                <DialogDescription>
                                  Habilita o deshabilita este proveedor en el sistema
                                </DialogDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value === 'active'}
                                  onCheckedChange={(checked) => field.onChange(checked ? 'active' : 'inactive')}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0 bg-background">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading || form.formState.isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || form.formState.isSubmitting}>
                {loading || form.formState.isSubmitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 mr-2" />
                    {mode === 'add' ? 'Crear Proveedor' : 'Actualizar Proveedor'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
