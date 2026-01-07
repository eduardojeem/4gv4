'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Database, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Settings,
  User,
  Zap
} from 'lucide-react'
import { usePOSProducts } from '@/hooks/usePOSProducts'

interface DebugInfo {
  timestamp: string
  supabaseConnection: boolean
  userAuth: {
    authenticated: boolean
    email?: string
    role?: string
    jwt?: any
  }
  databaseQuery: {
    totalCount: number | null
    loadedCount: number
    queryTime: number
    error?: string
  }
  hookState: {
    productsLength: number
    loading: boolean
    error: string | null
    searchTerm: string
    selectedCategory: string
  }
  sampleProducts: any[]
  rlsTest: {
    canRead: boolean
    canWrite: boolean
    error?: string
  }
}

interface POSDebugPanelProps {
  className?: string
}

export function POSDebugPanel({ className }: POSDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  const supabase = createClient()
  
  // Usar el hook real del POS para comparar
  const posHook = usePOSProducts()

  const collectDebugInfo = useCallback(async (): Promise<DebugInfo> => {
    const startTime = Date.now()
    
    const info: DebugInfo = {
      timestamp: new Date().toISOString(),
      supabaseConnection: false,
      userAuth: {
        authenticated: false
      },
      databaseQuery: {
        totalCount: null,
        loadedCount: 0,
        queryTime: 0
      },
      hookState: {
        productsLength: posHook.products.length,
        loading: posHook.loading,
        error: posHook.error,
        searchTerm: '', // No tenemos acceso directo a estos estados internos
        selectedCategory: ''
      },
      sampleProducts: [],
      rlsTest: {
        canRead: false,
        canWrite: false
      }
    }

    try {
      // 1. Test de conexión Supabase
      const { data: connectionTest } = await supabase.from('products').select('id').limit(1)
      info.supabaseConnection = !!connectionTest

      // 2. Info de usuario
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (!userError && user?.user) {
        info.userAuth = {
          authenticated: true,
          email: user.user.email,
          role: user.user.user_metadata?.user_role || 'user',
          jwt: user.user.user_metadata
        }
      }

      // 3. Test de base de datos
      const queryStart = Date.now()
      
      // Contar total
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        info.databaseQuery.error = countError.message
      } else {
        info.databaseQuery.totalCount = count
      }

      // Cargar productos (misma query que usePOSProducts)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
        .order('name')
        .limit(5000)

      info.databaseQuery.queryTime = Date.now() - queryStart

      if (productsError) {
        info.databaseQuery.error = productsError.message
      } else if (products) {
        info.databaseQuery.loadedCount = products.length
        info.sampleProducts = products.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          is_active: p.is_active,
          stock_quantity: p.stock_quantity,
          sale_price: p.sale_price
        }))
      }

      // 4. Test de RLS
      try {
        // Test lectura
        const { data: readTest } = await supabase
          .from('products')
          .select('id')
          .limit(1)
        info.rlsTest.canRead = !!readTest

        // Test escritura (intentar actualizar un producto inexistente)
        const { error: writeError } = await supabase
          .from('products')
          .update({ name: 'test' })
          .eq('id', '00000000-0000-0000-0000-000000000000')
        
        // Si no hay error de permisos, puede escribir
        info.rlsTest.canWrite = !writeError || !writeError.message.includes('permission')
      } catch (rlsError) {
        info.rlsTest.error = rlsError instanceof Error ? rlsError.message : 'Error desconocido'
      }

    } catch (error) {
      console.error('Error collecting debug info:', error)
    }

    return info
  }, [posHook, supabase])

  const refreshDebugInfo = useCallback(async () => {
    const info = await collectDebugInfo()
    setDebugInfo(info)
  }, [collectDebugInfo])

  const toggleAutoRefresh = useCallback(() => {
    if (autoRefresh) {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
      setAutoRefresh(false)
    } else {
      const interval = setInterval(refreshDebugInfo, 2000) // Cada 2 segundos
      setRefreshInterval(interval)
      setAutoRefresh(true)
    }
  }, [autoRefresh, refreshInterval, refreshDebugInfo])

  const fixProducts = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: true })
        .neq('is_active', true)

      if (error) {
        console.error('Error activating products:', error)
      } else {
        console.log('Products activated successfully')
        await refreshDebugInfo()
      }
    } catch (error) {
      console.error('Error in fixProducts:', error)
    }
  }, [supabase, refreshDebugInfo])

  useEffect(() => {
    if (isOpen && !debugInfo) {
      refreshDebugInfo()
    }
  }, [isOpen, debugInfo, refreshDebugInfo])

  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [refreshInterval])

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => (
    <Badge variant={condition ? 'default' : 'destructive'}>
      {condition ? trueText : falseText}
    </Badge>
  )

  const getCountBadge = (count: number, threshold: number = 1) => (
    <Badge variant={count >= threshold ? 'default' : 'destructive'}>
      {count}
    </Badge>
  )

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-white shadow-lg border-2 border-orange-200 hover:border-orange-300"
          >
            <Bug className="h-4 w-4 mr-2" />
            Debug POS
            {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Card className="w-96 mt-2 shadow-xl border-2 border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Debug Panel
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshDebugInfo}
                    className="h-6 px-2"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={autoRefresh ? 'default' : 'outline'}
                    onClick={toggleAutoRefresh}
                    className="h-6 px-2"
                  >
                    {autoRefresh ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3 text-xs">
              {debugInfo ? (
                <>
                  {/* Timestamp */}
                  <div className="text-xs text-gray-500">
                    Última actualización: {new Date(debugInfo.timestamp).toLocaleTimeString()}
                  </div>

                  {/* Conexión Supabase */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Database className="h-3 w-3 mr-1" />
                      Supabase
                    </span>
                    {getStatusBadge(debugInfo.supabaseConnection, 'Conectado', 'Desconectado')}
                  </div>

                  {/* Usuario */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      Usuario
                    </span>
                    {getStatusBadge(debugInfo.userAuth.authenticated, 
                      `${debugInfo.userAuth.role}`, 
                      'No auth')}
                  </div>

                  {/* Query de base de datos */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Total en DB</span>
                      {debugInfo.databaseQuery.totalCount !== null ? 
                        getCountBadge(debugInfo.databaseQuery.totalCount, 5) :
                        <Badge variant="secondary">Error</Badge>
                      }
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Cargados</span>
                      {getCountBadge(debugInfo.databaseQuery.loadedCount, 5)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tiempo query</span>
                      <Badge variant="outline">{debugInfo.databaseQuery.queryTime}ms</Badge>
                    </div>
                  </div>

                  {/* Estado del hook */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Hook productos</span>
                      {getCountBadge(debugInfo.hookState.productsLength, 5)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Loading</span>
                      {getStatusBadge(!debugInfo.hookState.loading, 'No', 'Sí')}
                    </div>
                    {debugInfo.hookState.error && (
                      <div className="text-red-600 text-xs">
                        Error: {debugInfo.hookState.error}
                      </div>
                    )}
                  </div>

                  {/* RLS Test */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span>RLS Lectura</span>
                      {getStatusBadge(debugInfo.rlsTest.canRead, 'OK', 'Error')}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>RLS Escritura</span>
                      {getStatusBadge(debugInfo.rlsTest.canWrite, 'OK', 'Error')}
                    </div>
                  </div>

                  {/* Productos de ejemplo */}
                  {debugInfo.sampleProducts.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium">Productos ejemplo:</div>
                      {debugInfo.sampleProducts.map((product, index) => (
                        <div key={product.id} className="text-xs bg-gray-50 p-1 rounded">
                          <div className="font-medium">{product.name}</div>
                          <div className="flex gap-2 text-xs text-gray-600">
                            <span>SKU: {product.sku}</span>
                            <Badge variant={product.is_active ? 'default' : 'secondary'} className="h-4 text-xs">
                              {product.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                            <span>Stock: {product.stock_quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Errores */}
                  {debugInfo.databaseQuery.error && (
                    <div className="bg-red-50 p-2 rounded text-red-700 text-xs">
                      <strong>Error DB:</strong> {debugInfo.databaseQuery.error}
                    </div>
                  )}

                  {/* Botón de corrección rápida */}
                  {debugInfo.databaseQuery.totalCount !== null && 
                   debugInfo.databaseQuery.loadedCount < debugInfo.databaseQuery.totalCount && (
                    <Button
                      size="sm"
                      onClick={fixProducts}
                      className="w-full h-7 text-xs"
                      variant="default"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Activar Productos
                    </Button>
                  )}

                  {/* Comparación Hook vs DB */}
                  {debugInfo.hookState.productsLength !== debugInfo.databaseQuery.loadedCount && (
                    <div className="bg-yellow-50 p-2 rounded text-yellow-700 text-xs">
                      <strong>⚠️ Discrepancia:</strong> Hook tiene {debugInfo.hookState.productsLength} productos, 
                      DB cargó {debugInfo.databaseQuery.loadedCount}
                    </div>
                  )}

                </>
              ) : (
                <div className="text-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Cargando información de debug...
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}