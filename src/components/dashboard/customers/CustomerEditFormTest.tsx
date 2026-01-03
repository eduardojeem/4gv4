'use client'

/**
 * CustomerEditFormTest - Componente de prueba para el formulario mejorado
 * 
 * Permite probar el formulario con datos de ejemplo
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CustomerEditFormV2 } from './CustomerEditFormV2'
import { Customer } from '@/hooks/use-customer-state'
import { toast } from 'sonner'
import { Play, CheckCircle2, AlertCircle } from 'lucide-react'

// Mock customer data for testing
const testCustomer: Customer = {
  id: 'test-customer-1',
  customerCode: 'CLI-TEST001',
  name: 'María González López',
  email: 'maria.gonzalez@test.com',
  phone: '+52 55 1234 5678',
  whatsapp: '+52 55 1234 5678',
  address: 'Av. Reforma 123, Col. Juárez',
  city: 'Ciudad de México',
  company: 'Tecnología Avanzada S.A.',
  position: 'Directora de Operaciones',
  ruc: 'RFC123456789',
  customer_type: 'premium',
  segment: 'vip',
  status: 'active',
  credit_limit: 100000,
  discount_percentage: 20,
  payment_terms: '45 días',
  preferred_contact: 'email',
  tags: ['VIP', 'Tecnología', 'Corporativo', 'Frecuente'],
  notes: 'Cliente estratégico con excelente historial de pagos. Requiere atención personalizada.',
  birthday: '1980-03-15',
  total_purchases: 45,
  total_repairs: 12,
  registration_date: '2022-06-15T10:00:00Z',
  last_visit: '2024-01-15T16:30:00Z',
  last_activity: '2024-01-15T16:30:00Z',
  credit_score: 9.8,
  satisfaction_score: 9.5,
  lifetime_value: 250000,
  avg_order_value: 5555,
  purchase_frequency: 'high',
  loyalty_points: 5000,
  current_balance: 0,
  pending_amount: 0,
  referral_source: 'Recomendación empresarial',
  assigned_salesperson: 'Carlos Mendoza',
  last_purchase_amount: 15000,
  total_spent_this_year: 85000,
  avatar: undefined
}

export function CustomerEditFormTest() {
  const [showForm, setShowForm] = useState(false)
  const [testResults, setTestResults] = useState<{
    success: boolean
    message: string
    data?: any
  } | null>(null)

  const handleSave = async (formData: any) => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Simulate success
      console.log('Form data saved:', formData)
      
      setTestResults({
        success: true,
        message: 'Formulario guardado exitosamente',
        data: formData
      })
      
      toast.success('¡Prueba exitosa! Datos guardados correctamente')
      
      // Close form after success
      setTimeout(() => {
        setShowForm(false)
      }, 2000)
      
    } catch (error) {
      setTestResults({
        success: false,
        message: 'Error al guardar el formulario'
      })
      
      toast.error('Error en la prueba')
      throw error
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setTestResults(null)
  }

  if (showForm) {
    return (
      <CustomerEditFormV2
        customer={testCustomer}
        onSave={handleSave}
        onCancel={handleCancel}
        autoSave={true}
        showPreview={true}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Prueba del Formulario de Edición V2
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Prueba todas las funcionalidades del nuevo formulario mejorado
        </p>
      </div>

      {/* Test Customer Info */}
      <Card className="border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Play className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Cliente de Prueba
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Información Básica
              </h3>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li><strong>Nombre:</strong> {testCustomer.name}</li>
                <li><strong>Email:</strong> {testCustomer.email}</li>
                <li><strong>Teléfono:</strong> {testCustomer.phone}</li>
                <li><strong>Empresa:</strong> {testCustomer.company}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Clasificación
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                  {testCustomer.customer_type}
                </Badge>
                <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {testCustomer.segment}
                </Badge>
                <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  {testCustomer.status}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {testCustomer.tags?.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features to Test */}
      <Card className="border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">
            Funcionalidades a Probar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Navegación</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Navegación por pasos</li>
                <li>• Indicador de progreso</li>
                <li>• Validación por pasos</li>
                <li>• Navegación con teclado</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Funcionalidades</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Auto-guardado activado</li>
                <li>• Vista previa en tiempo real</li>
                <li>• Gestión de tags</li>
                <li>• Configuración de notificaciones</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Validaciones</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Validación en tiempo real</li>
                <li>• Mensajes de error claros</li>
                <li>• Campos requeridos</li>
                <li>• Formatos de datos</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Accesibilidad</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Navegación con teclado</li>
                <li>• Etiquetas ARIA</li>
                <li>• Lectores de pantalla</li>
                <li>• Contraste de colores</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card className={`border-2 ${testResults.success 
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20' 
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <span className={`font-medium ${testResults.success 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
              }`}>
                {testResults.message}
              </span>
            </div>
            {testResults.data && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                  Ver datos guardados
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                  {JSON.stringify(testResults.data, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start Test Button */}
      <div className="text-center">
        <Button
          onClick={() => setShowForm(true)}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Play className="h-5 w-5 mr-2" />
          Iniciar Prueba del Formulario
        </Button>
      </div>
    </div>
  )
}