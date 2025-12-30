'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Package, 
  Building2, 
  Users, 
  Settings, 
  BarChart3, 
  Download, 
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CatalogManager } from '@/components/dashboard/catalog-manager'
import { IntegratedCatalogSelector } from '@/components/dashboard/integrated-catalog-selector'
import { useCatalogSync } from '@/hooks/use-catalog-sync'
import { toast } from 'sonner'

export default function CatalogPage() {
  const {
    categories,
    brands,
    suppliers,
    getStats,
    exportData,
    resetData,
    isLoading,
    error
  } = useCatalogSync()

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')

  const stats = getStats()

  const handleExport = () => {
    try {
      exportData()
      toast.success('Datos exportados exitosamente')
    } catch (error) {
      toast.error('Error al exportar los datos')
    }
  }

  const handleReset = () => {
    if (confirm('¿Estás seguro de que quieres resetear todos los datos? Esta acción no se puede deshacer.')) {
      resetData()
      toast.success('Datos reseteados exitosamente')
    }
  }

  const handleCategoryChange = (categoryId: string, subcategory?: string) => {
    setSelectedCategory(categoryId)
    setSelectedSubcategory(subcategory || '')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando catálogo...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Catálogo</h1>
          <p className="text-muted-foreground">
            Sistema integrado para gestionar categorías, marcas y proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Resetear
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categories.total}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{stats.categories.active} activas</span>
              <span>•</span>
              <span>{stats.categories.withProducts} con productos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marcas</CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.brands.total}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{stats.brands.active} activas</span>
              <span>•</span>
              <span>{stats.brands.withProducts} con productos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suppliers.total}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{stats.suppliers.active} activos</span>
              <span>•</span>
              <span>{stats.suppliers.withOrders} con órdenes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido principal */}
      <Tabs defaultValue="manager" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manager" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Gestión Completa
          </TabsTrigger>
          <TabsTrigger value="selector" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Selector Integrado
          </TabsTrigger>
          <TabsTrigger value="demo" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Demostración
          </TabsTrigger>
        </TabsList>

        {/* Gestión completa */}
        <TabsContent value="manager" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Aquí puedes gestionar todas las categorías, marcas y proveedores de tu sistema. 
              Los cambios se sincronizan automáticamente con el resto de la aplicación.
            </AlertDescription>
          </Alert>
          
          <CatalogManager />
        </TabsContent>

        {/* Selector integrado */}
        <TabsContent value="selector" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este es el selector integrado que se puede usar en formularios de productos. 
              Permite seleccionar y crear nuevos elementos sobre la marcha.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selector normal */}
            <Card>
              <CardHeader>
                <CardTitle>Selector Completo</CardTitle>
                <CardDescription>
                  Versión completa con búsqueda avanzada y botones de agregar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegratedCatalogSelector
                  selectedCategory={selectedCategory}
                  selectedSubcategory={selectedSubcategory}
                  selectedBrand={selectedBrand}
                  selectedSupplier={selectedSupplier}
                  onCategoryChange={handleCategoryChange}
                  onBrandChange={setSelectedBrand}
                  onSupplierChange={setSelectedSupplier}
                  showQuickAdd={true}
                />
              </CardContent>
            </Card>

            {/* Selector compacto */}
            <Card>
              <CardHeader>
                <CardTitle>Selector Compacto</CardTitle>
                <CardDescription>
                  Versión compacta para espacios reducidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegratedCatalogSelector
                  selectedCategory={selectedCategory}
                  selectedBrand={selectedBrand}
                  selectedSupplier={selectedSupplier}
                  onCategoryChange={(categoryId) => setSelectedCategory(categoryId)}
                  onBrandChange={setSelectedBrand}
                  onSupplierChange={setSelectedSupplier}
                  showQuickAdd={false}
                  compact={true}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Demostración */}
        <TabsContent value="demo" className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Esta demostración muestra cómo el sistema integra todos los componentes 
              para crear una experiencia fluida de gestión de catálogo.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulario de producto simulado */}
            <Card>
              <CardHeader>
                <CardTitle>Formulario de Producto (Simulado)</CardTitle>
                <CardDescription>
                  Ejemplo de cómo se integraría en un formulario real
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Producto</label>
                  <input 
                    className="w-full p-2 border rounded-md" 
                    placeholder="iPhone 15 Pro Max"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea 
                    className="w-full p-2 border rounded-md" 
                    rows={3}
                    placeholder="Smartphone premium con..."
                    disabled
                  />
                </div>

                <Separator />

                <IntegratedCatalogSelector
                  selectedCategory={selectedCategory}
                  selectedSubcategory={selectedSubcategory}
                  selectedBrand={selectedBrand}
                  selectedSupplier={selectedSupplier}
                  onCategoryChange={handleCategoryChange}
                  onBrandChange={setSelectedBrand}
                  onSupplierChange={setSelectedSupplier}
                  showQuickAdd={true}
                />

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Precio</label>
                    <input 
                      className="w-full p-2 border rounded-md" 
                      placeholder="$999.99"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stock</label>
                    <input 
                      className="w-full p-2 border rounded-md" 
                      placeholder="50"
                      disabled
                    />
                  </div>
                </div>

                <Button className="w-full" disabled>
                  Guardar Producto
                </Button>
              </CardContent>
            </Card>

            {/* Información de selección */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Selección</CardTitle>
                <CardDescription>
                  Datos actuales seleccionados en el formulario
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Categoría:</label>
                    <div className="mt-1">
                      {selectedCategory ? (
                        <Badge variant="secondary">
                          {categories.find(c => c.id === selectedCategory)?.name}
                          {selectedSubcategory && ` > ${selectedSubcategory}`}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No seleccionada</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Marca:</label>
                    <div className="mt-1">
                      {selectedBrand ? (
                        <Badge variant="secondary">
                          {brands.find(b => b.id === selectedBrand)?.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No seleccionada</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Proveedor:</label>
                    <div className="mt-1">
                      {selectedSupplier ? (
                        <Badge variant="secondary">
                          {suppliers.find(s => s.id === selectedSupplier)?.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No seleccionado</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">JSON de Selección:</label>
                  <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
{JSON.stringify({
  category: selectedCategory,
  subcategory: selectedSubcategory,
  brand: selectedBrand,
  supplier: selectedSupplier
}, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}