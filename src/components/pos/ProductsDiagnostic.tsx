'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface DiagnosticResult {
  totalProducts: number
  activeProducts: number
  inactiveProducts: number
  withStock: number
  withoutStock: number
  rlsPolicies: number
  sampleProducts: any[]
  userAuthenticated: boolean
  userRole: string | null
  connectionStatus: 'success' | 'error' | 'loading'
  errorMessage?: string
}

export function ProductsDiagnostic() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)

  const supabase = createClient()

  const runDiagnostic = async () => {
    setLoading(true)
    try {
      const result: DiagnosticResult = {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        withStock: 0,
        withoutStock: 0,
        rlsPolicies: 0,
        sampleProducts: [],
        userAuthenticated: false,
        userRole: null,
        connectionStatus: 'loading'
      }

      // 1. Verificar usuario autenticado
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError) {
        result.connectionStatus = 'error'
        result.errorMessage = `Error de autenticación: ${userError.message}`
      } else {
        result.userAuthenticated = !!user?.user
        result.userRole = user?.user?.user_metadata?.user_role || 'user'
      }

      // 2. Contar productos totales
      const { count: totalCount, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        result.connectionStatus = 'error'
        result.errorMessage = `Error contando productos: ${countError.message}`
      } else {
        result.totalProducts = totalCount || 0
      }

      // 3. Cargar productos con detalles
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, is_active, stock_quantity, sale_price')
        .limit(100)

      if (productsError) {
        result.connectionStatus = 'error'
        result.errorMessage = `Error cargando productos: ${productsError.message}`
      } else if (products) {
        result.activeProducts = products.filter(p => p.is_active === true).length
        result.inactiveProducts = products.filter(p => p.is_active === false).length
        result.withStock = products.filter(p => p.stock_quantity > 0).length
        result.withoutStock = products.filter(p => p.stock_quantity === 0).length
        result.sampleProducts = products.slice(0, 5)
        result.connectionStatus = 'success'
      }

      // 4. Verificar políticas RLS (si es posible)
      try {
        const { data: policies } = await supabase
          .rpc('get_table_policies', { table_name: 'products' })
        result.rlsPolicies = policies?.length || 0
      } catch {
        // Ignorar si no se puede acceder a las políticas
      }

      setDiagnostic(result)
    } catch (error) {
      setDiagnostic({
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        withStock: 0,
        withoutStock: 0,
        rlsPolicies: 0,
        sampleProducts: [],
        userAuthenticated: false,
        userRole: null,
        connectionStatus: 'error',
        errorMessage: `Error general: ${error instanceof Error ? error.message : 'Desconocido'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const fixProducts = async () => {
    setFixing(true)
    try {
      // Activar todos los productos
      const { error } = await supabase
        .from('products')
        .update({ is_active: true })
        .neq('is_active', true)

      if (error) {
        throw error
      }

      // Ejecutar diagnóstico nuevamente
      await runDiagnostic()
    } catch (error) {
      console.error('Error activando productos:', error)
    } finally {
      setFixing(false)
    }
  }

  useEffect(() => {
    runDiagnostic()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'bg-green-100 text-green-800'
    if (value > 0) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon(diagnostic?.connectionStatus || 'loading')}
          Diagnóstico de Productos POS
        </CardTitle>
        <CardDescription>
          Verificación del estado de productos y conectividad con Supabase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostic} 
            disabled={loading}
            variant="outline"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Ejecutar Diagnóstico
          </Button>
          
          {diagnostic && diagnostic.activeProducts < diagnostic.totalProducts && (
            <Button 
              onClick={fixProducts} 
              disabled={fixing}
              variant="default"
            >
              {fixing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Activar Todos los Productos
            </Button>
          )}
        </div>

        {/* Resultados del diagnóstico */}
        {diagnostic && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Estado de conexión */}
            <div className="col-span-full">
              <h3 className="font-semibold mb-2">Estado de Conexión</h3>
              <div className="flex items-center gap-2">
                {getStatusIcon(diagnostic.connectionStatus)}
                <span>
                  {diagnostic.connectionStatus === 'success' ? 'Conectado a Supabase' : 
                   diagnostic.connectionStatus === 'error' ? 'Error de conexión' : 'Conectando...'}
                </span>
                {diagnostic.errorMessage && (
                  <Badge variant="destructive" className="ml-2">
                    {diagnostic.errorMessage}
                  </Badge>
                )}
              </div>
            </div>

            {/* Estadísticas de productos */}
            <div>
              <h4 className="font-medium mb-2">Productos Totales</h4>
              <Badge className={getStatusColor(diagnostic.totalProducts, 10)}>
                {diagnostic.totalProducts}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Productos Activos</h4>
              <Badge className={getStatusColor(diagnostic.activeProducts, 5)}>
                {diagnostic.activeProducts}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Productos Inactivos</h4>
              <Badge className={diagnostic.inactiveProducts > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                {diagnostic.inactiveProducts}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Con Stock</h4>
              <Badge className={getStatusColor(diagnostic.withStock, 3)}>
                {diagnostic.withStock}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Sin Stock</h4>
              <Badge variant="outline">
                {diagnostic.withoutStock}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Usuario</h4>
              <Badge variant={diagnostic.userAuthenticated ? 'default' : 'destructive'}>
                {diagnostic.userAuthenticated ? `${diagnostic.userRole}` : 'No autenticado'}
              </Badge>
            </div>
          </div>
        )}

        {/* Productos de ejemplo */}
        {diagnostic && diagnostic.sampleProducts.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Productos de Ejemplo</h3>
            <div className="space-y-2">
              {diagnostic.sampleProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({product.sku})</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge variant="outline">
                      Stock: {product.stock_quantity}
                    </Badge>
                    <Badge variant="outline">
                      ₲{product.sale_price?.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recomendaciones */}
        {diagnostic && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Recomendaciones</h3>
            <ul className="space-y-1 text-sm">
              {diagnostic.totalProducts === 0 && (
                <li className="text-red-600">• No hay productos en la base de datos. Ejecute las migraciones de seed.</li>
              )}
              {diagnostic.activeProducts === 0 && diagnostic.totalProducts > 0 && (
                <li className="text-red-600">• Todos los productos están inactivos. Use el botón "Activar Todos los Productos".</li>
              )}
              {diagnostic.activeProducts < 5 && diagnostic.activeProducts > 0 && (
                <li className="text-yellow-600">• Pocos productos activos ({diagnostic.activeProducts}). Considere activar más productos.</li>
              )}
              {!diagnostic.userAuthenticated && (
                <li className="text-red-600">• Usuario no autenticado. Inicie sesión para acceder a los productos.</li>
              )}
              {diagnostic.connectionStatus === 'error' && (
                <li className="text-red-600">• Error de conexión con Supabase. Verifique la configuración de red.</li>
              )}
              {diagnostic.activeProducts >= 5 && diagnostic.userAuthenticated && diagnostic.connectionStatus === 'success' && (
                <li className="text-green-600">• ✅ Todo parece estar funcionando correctamente.</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}