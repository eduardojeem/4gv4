"use client"

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import customerService from '@/services/customer-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, XCircle, Database, Users, Settings } from 'lucide-react'

interface DiagnosticResult {
  test: string
  status: 'success' | 'error' | 'warning' | 'info'
  message: string
  details?: any
}

export function SupabaseDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState(false)
  const [fixingData, setFixingData] = useState(false)

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result])
  }

  const createSampleData = async () => {
    setFixingData(true)
    try {
      const supabase = createClient()
      
      // Insertar datos de ejemplo
      const sampleCustomers = [
        {
          name: 'Juan Pérez',
          email: 'juan.perez@email.com',
          phone: '+595981123456',
          city: 'Asunción',
          customer_type: 'premium',
          segment: 'vip',
          lifetime_value: 2500000,
          credit_score: 8,
          satisfaction_score: 9
        },
        {
          name: 'María González',
          email: 'maria.gonzalez@email.com',
          phone: '+595981234567',
          city: 'Ciudad del Este',
          customer_type: 'regular',
          segment: 'regular',
          lifetime_value: 850000,
          credit_score: 6,
          satisfaction_score: 7
        },
        {
          name: 'Carlos López',
          email: 'carlos.lopez@email.com',
          phone: '+595981345678',
          city: 'Encarnación',
          customer_type: 'empresa',
          segment: 'premium',
          lifetime_value: 1200000,
          credit_score: 7,
          satisfaction_score: 8
        },
        {
          name: 'Ana Rodríguez',
          email: 'ana.rodriguez@email.com',
          phone: '+595981456789',
          city: 'Asunción',
          customer_type: 'regular',
          segment: 'regular',
          lifetime_value: 650000,
          credit_score: 5,
          satisfaction_score: 6
        },
        {
          name: 'Luis Martínez',
          email: 'luis.martinez@email.com',
          phone: '+595981567890',
          city: 'San Lorenzo',
          customer_type: 'premium',
          segment: 'vip',
          lifetime_value: 3200000,
          credit_score: 9,
          satisfaction_score: 10
        }
      ]

      const { data, error } = await supabase
        .from('customers')
        .insert(sampleCustomers)
        .select()

      if (error) {
        throw error
      }

      addResult({
        test: 'Creación de datos de ejemplo',
        status: 'success',
        message: `${data.length} clientes de ejemplo creados exitosamente`,
        details: { insertedRecords: data.length, records: data }
      })

      // Ejecutar diagnósticos nuevamente
      setTimeout(() => {
        runDiagnostics()
      }, 1000)

    } catch (error: any) {
      addResult({
        test: 'Creación de datos de ejemplo',
        status: 'error',
        message: `Error al crear datos: ${error.message}`,
        details: error
      })
    } finally {
      setFixingData(false)
    }
  }

  const runDiagnostics = async () => {
    setLoading(true)
    setResults([])

    // Test 1: Configuración
    addResult({
      test: 'Configuración de Supabase',
      status: config.supabase.isConfigured ? 'success' : 'error',
      message: config.supabase.isConfigured 
        ? 'Variables de entorno configuradas correctamente'
        : 'Variables de entorno faltantes',
      details: {
        url: config.supabase.url ? '✅ Configurada' : '❌ Faltante',
        anonKey: config.supabase.anonKey ? '✅ Configurada' : '❌ Faltante',
        isConfigured: config.supabase.isConfigured
      }
    })

    // Test 2: Conexión básica
    try {
      const supabase = createClient()
      addResult({
        test: 'Cliente Supabase',
        status: 'success',
        message: 'Cliente Supabase creado exitosamente',
        details: { clientType: typeof supabase }
      })

      // Test 3: Conexión a la base de datos
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('count', { count: 'exact', head: true })

        if (error) {
          addResult({
            test: 'Conexión a tabla customers',
            status: 'error',
            message: `Error al conectar: ${error.message}`,
            details: error
          })
        } else {
          addResult({
            test: 'Conexión a tabla customers',
            status: 'success',
            message: `Conexión exitosa. Total registros: ${data || 0}`,
            details: { count: data }
          })
        }
      } catch (err: any) {
        addResult({
          test: 'Conexión a tabla customers',
          status: 'error',
          message: `Error de conexión: ${err.message}`,
          details: err
        })
      }

      // Test 4: Consulta de datos
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .limit(5)

        if (error) {
          addResult({
            test: 'Consulta de datos',
            status: 'error',
            message: `Error en consulta: ${error.message}`,
            details: error
          })
        } else {
          addResult({
            test: 'Consulta de datos',
            status: data && data.length > 0 ? 'success' : 'warning',
            message: data && data.length > 0 
              ? `${data.length} registros encontrados`
              : 'Tabla vacía - no hay registros',
            details: { records: data?.length || 0, firstRecord: data?.[0] }
          })
        }
      } catch (err: any) {
        addResult({
          test: 'Consulta de datos',
          status: 'error',
          message: `Error en consulta: ${err.message}`,
          details: err
        })
      }

      // Test 5: Servicio de clientes
      try {
        const response = await customerService.getCustomers(1, 5)
        
        addResult({
          test: 'Servicio de clientes',
          status: response.success ? 'success' : 'error',
          message: response.success 
            ? `Servicio funcionando. ${response.data?.length || 0} clientes cargados`
            : `Error en servicio: ${response.error}`,
          details: {
            success: response.success,
            dataLength: response.data?.length,
            pagination: response.pagination,
            error: response.error
          }
        })
      } catch (err: any) {
        addResult({
          test: 'Servicio de clientes',
          status: 'error',
          message: `Error en servicio: ${err.message}`,
          details: err
        })
      }

      // Test 6: Verificar estructura de tabla
      try {
        // Intentar consulta directa para verificar estructura
        const { data: sampleData, error: sampleError } = await supabase
          .from('customers')
          .select('*')
          .limit(1)
          .single()

        if (sampleError) {
          if (sampleError.code === 'PGRST116') {
            // Tabla existe pero está vacía
            addResult({
              test: 'Estructura de tabla',
              status: 'warning',
              message: 'Tabla existe pero está vacía - necesita datos de ejemplo',
              details: { 
                code: sampleError.code, 
                message: sampleError.message,
                solution: 'Ejecutar script SQL para insertar datos de ejemplo'
              }
            })
          } else if (sampleError.message.includes('relation "customers" does not exist')) {
            // Tabla no existe
            addResult({
              test: 'Estructura de tabla',
              status: 'error',
              message: 'La tabla "customers" no existe en la base de datos',
              details: { 
                code: sampleError.code, 
                message: sampleError.message,
                solution: 'Ejecutar script SQL para crear la tabla'
              }
            })
          } else {
            // Otro error
            addResult({
              test: 'Estructura de tabla',
              status: 'error',
              message: `Error al verificar estructura: ${sampleError.message}`,
              details: sampleError
            })
          }
        } else if (sampleData) {
          // Tabla existe y tiene datos
          addResult({
            test: 'Estructura de tabla',
            status: 'success',
            message: `Tabla existe con datos. Campos: ${Object.keys(sampleData).join(', ')}`,
            details: { 
              fields: Object.keys(sampleData),
              sampleRecord: sampleData
            }
          })
        } else {
          // Caso inesperado
          addResult({
            test: 'Estructura de tabla',
            status: 'warning',
            message: 'Respuesta inesperada al verificar tabla',
            details: { data: sampleData, error: sampleError }
          })
        }
      } catch (err: any) {
        addResult({
          test: 'Estructura de tabla',
          status: 'error',
          message: `Error inesperado: ${err.message}`,
          details: err
        })
      }

    } catch (err: any) {
      addResult({
        test: 'Cliente Supabase',
        status: 'error',
        message: `Error al crear cliente: ${err.message}`,
        details: err
      })
    }

    setLoading(false)
  }

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'info': return <AlertCircle className="h-5 w-5 text-blue-500" />
    }
  }

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800'
    }
    
    return (
      <Badge className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Diagnóstico de Supabase - Clientes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={runDiagnostics} disabled={loading}>
              {loading ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
            </Button>
            <Button 
              onClick={createSampleData} 
              disabled={fixingData}
              variant="outline"
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            >
              {fixingData ? 'Creando Datos...' : '🔧 Crear Datos de Ejemplo'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.test}</span>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      Ver detalles
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Ejecutando diagnósticos...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}