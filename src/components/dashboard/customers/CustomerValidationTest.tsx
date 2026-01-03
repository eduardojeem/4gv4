'use client'

/**
 * CustomerValidationTest - Componente para probar las validaciones mejoradas
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  CheckCircle2, AlertTriangle, TestTube, 
  Phone, Mail, User, Building
} from 'lucide-react'
import { validateCustomerData, updateCustomerSchema } from '@/lib/validations/customer'

const testCases = [
  {
    name: 'Datos Válidos',
    data: {
      name: 'Juan Pérez',
      email: 'juan@email.com',
      phone: '+1234567890',
      whatsapp: '+1234567890'
    },
    shouldPass: true
  },
  {
    name: 'Teléfono Vacío (Permitido)',
    data: {
      name: 'María García',
      email: 'maria@email.com',
      phone: '',
      whatsapp: ''
    },
    shouldPass: true
  },
  {
    name: 'Teléfono [REDACTED] (Filtrado)',
    data: {
      name: 'Carlos López',
      email: 'carlos@email.com',
      phone: '[REDACTED]',
      whatsapp: '[REDACTED]'
    },
    shouldPass: true
  },
  {
    name: 'Email Inválido',
    data: {
      name: 'Ana Martín',
      email: 'email-invalido',
      phone: '+1234567890'
    },
    shouldPass: false
  },
  {
    name: 'Teléfono Muy Corto',
    data: {
      name: 'Pedro Ruiz',
      email: 'pedro@email.com',
      phone: '123'
    },
    shouldPass: false
  }
]

export function CustomerValidationTest() {
  const [testResults, setTestResults] = useState<Array<{
    name: string
    passed: boolean
    error?: string
  }>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [customData, setCustomData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: ''
  })

  const runTests = async () => {
    setIsRunning(true)
    const results = []

    for (const testCase of testCases) {
      try {
        const validation = validateCustomerData(updateCustomerSchema, testCase.data)
        
        if (validation.success && testCase.shouldPass) {
          results.push({ name: testCase.name, passed: true })
        } else if (!validation.success && !testCase.shouldPass) {
          results.push({ name: testCase.name, passed: true })
        } else {
          results.push({ 
            name: testCase.name, 
            passed: false, 
            error: validation.success ? 'Debería haber fallado' : 'Debería haber pasado'
          })
        }
      } catch (error) {
        results.push({ 
          name: testCase.name, 
          passed: false, 
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    setTestResults(results)
    setIsRunning(false)

    const passedCount = results.filter(r => r.passed).length
    if (passedCount === results.length) {
      toast.success(`Todas las pruebas pasaron (${passedCount}/${results.length})`)
    } else {
      toast.error(`${results.length - passedCount} pruebas fallaron`)
    }
  }

  const testCustomData = () => {
    try {
      const validation = validateCustomerData(updateCustomerSchema, customData)
      
      if (validation.success) {
        toast.success('Validación exitosa')
        console.log('Datos validados:', validation.data)
      } else {
        toast.error('Validación fallida')
        console.error('Errores:', validation.errors.issues)
      }
    } catch (error) {
      toast.error('Error en validación')
      console.error('Error:', error)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-6 w-6 text-blue-600" />
            Pruebas de Validación de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300">
            Prueba las validaciones mejoradas que solucionan el error de base de datos
          </p>
        </CardContent>
      </Card>

      {/* Test Runner */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Pruebas Automáticas</span>
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? 'Ejecutando...' : 'Ejecutar Pruebas'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length > 0 && (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    result.passed 
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' 
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{result.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={result.passed ? 'default' : 'destructive'}
                      className={result.passed ? 'bg-green-100 text-green-800' : ''}
                    >
                      {result.passed ? 'PASÓ' : 'FALLÓ'}
                    </Badge>
                    {result.error && (
                      <span className="text-sm text-red-600">{result.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Test */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Prueba Personalizada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-name">Nombre</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <Input
                  id="test-name"
                  value={customData.name}
                  onChange={(e) => setCustomData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del cliente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <Input
                  id="test-email"
                  value={customData.email}
                  onChange={(e) => setCustomData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-phone">Teléfono</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <Input
                  id="test-phone"
                  value={customData.phone}
                  onChange={(e) => setCustomData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1234567890 o vacío"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-whatsapp">WhatsApp</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <Input
                  id="test-whatsapp"
                  value={customData.whatsapp}
                  onChange={(e) => setCustomData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="+1234567890 o [REDACTED]"
                />
              </div>
            </div>
          </div>

          <Button onClick={testCustomData} className="w-full">
            Probar Validación
          </Button>
        </CardContent>
      </Card>

      {/* Test Cases Display */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Casos de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testCases.map((testCase, index) => (
              <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{testCase.name}</h4>
                  <Badge variant={testCase.shouldPass ? 'default' : 'secondary'}>
                    {testCase.shouldPass ? 'Debe Pasar' : 'Debe Fallar'}
                  </Badge>
                </div>
                <pre className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border">
                  {JSON.stringify(testCase.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}