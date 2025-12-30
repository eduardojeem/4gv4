'use client'

/**
 * CustomerModal Simplificado
 *
 * Modal simplificado de cliente basado en el patrón del sistema de reparaciones:
 * - Interfaz limpia y directa
 * - Solo funcionalidades esenciales
 * - Fácil de usar y entender
 * - Formulario simplificado integrado
 */

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Edit,
  X,
  Star,
  Calendar
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCustomerActions } from '@/hooks/use-customer-actions'
import { CustomerFormSimple, SimpleCustomerFormData } from '../customer-form-simple'
import { toast } from 'sonner'

interface CustomerModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  mode: 'view' | 'edit' | 'create'
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  mode: initialMode
}) => {
  const [mode, setMode] = useState(initialMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { updateCustomer, createCustomer } = useCustomerActions()

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const handleFormSubmit = async (formData: SimpleCustomerFormData) => {
    setIsSubmitting(true)
    try {
      let result

      if (mode === 'create') {
        // Convertir datos del formulario simple al formato completo del cliente
        const customerData = {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          status: 'active' as const,
          segment: formData.customerType === 'individual' ? 'regular' as const :
            formData.customerType === 'mayorista' ? 'wholesale' as const : 'business' as const,
          tags: [],
          notes: formData.notes,
          totalSpent: 0,
          lastPurchase: null,
          joinDate: new Date().toISOString(),
          avatar: undefined
        }

        result = await createCustomer(customerData)
        toast.success('Cliente creado exitosamente')
      } else if (customer) {
        // Actualizar cliente existente
        const updatedData = {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes,
          segment: formData.customerType === 'individual' ? 'regular' as const :
            formData.customerType === 'mayorista' ? 'wholesale' as const : 'business' as const,
          credit_limit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          payment_terms: formData.paymentTerms || 'contado',
        }

        result = await updateCustomer(customer.id, updatedData)
        toast.success('Cliente actualizado exitosamente')
      }

      if (result?.success) {
        onClose()
      }
    } catch (error) {
      toast.error('Error al guardar el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getInitialFormData = (): Partial<SimpleCustomerFormData> => {
    if (!customer) return {}

    const nameParts = customer.name?.split(' ') || []
    return {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      customerType: customer.segment === 'wholesale' ? 'mayorista' :
        customer.segment === 'business' ? 'empresa' : 'individual',
      creditLimit: customer.credit_limit?.toString() || '',
      paymentTerms: customer.payment_terms || 'contado',
      notes: customer.notes || ''
    }
  }

  const getSegmentBadge = (segment: string) => {
    const variants = {
      regular: { label: 'Regular', variant: 'default' as const },
      premium: { label: 'Premium', variant: 'secondary' as const },
      vip: { label: 'VIP', variant: 'destructive' as const },
      wholesale: { label: 'Mayorista', variant: 'outline' as const },
      business: { label: 'Empresa', variant: 'outline' as const }
    }

    const config = variants[segment as keyof typeof variants] || variants.regular
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { label: 'Activo', variant: 'default' as const },
      inactive: { label: 'Inactivo', variant: 'secondary' as const },
      suspended: { label: 'Suspendido', variant: 'destructive' as const }
    }

    const config = variants[status as keyof typeof variants] || variants.active
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {mode === 'create' ? (
                  <>
                    <User className="h-5 w-5" />
                    Nuevo Cliente
                  </>
                ) : (
                  <>
                    <User className="h-5 w-5" />
                    {customer?.name}
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {mode === 'create'
                  ? 'Crear un nuevo cliente en el sistema'
                  : mode === 'edit'
                    ? 'Editar información del cliente'
                    : 'Información del cliente'
                }
              </DialogDescription>
            </div>

            {mode === 'view' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('edit')}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {mode === 'view' && customer ? (
            // Vista de solo lectura
            <div className="space-y-6">
              {/* Información básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={customer.avatar || undefined} />
                      <AvatarFallback className="text-lg">
                        {customer.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">{customer.name}</h3>
                      <div className="flex gap-2">
                        {getStatusBadge(customer.status)}
                        {getSegmentBadge(customer.segment)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.address}</span>
                    </div>
                  </div>

                  {customer.notes && (
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Notas</h4>
                      <p className="text-muted-foreground">{customer.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Información adicional */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Total gastado</span>
                      <p className="text-lg font-semibold">${customer.lifetime_value?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Fecha de registro</span>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {customer.registration_date ? new Date(customer.registration_date).toLocaleDateString() : 'No disponible'}
                      </p>
                    </div>
                  </div>

                  {customer.tags && customer.tags.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Etiquetas</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {customer.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            // Formulario de edición/creación
            <CustomerFormSimple
              initialData={getInitialFormData()}
              onSubmit={handleFormSubmit}
              onCancel={() => mode === 'edit' ? setMode('view') : onClose()}
              submitLabel={mode === 'create' ? 'Crear Cliente' : 'Actualizar Cliente'}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}