'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { 
  CreditCard, 
  Calculator, 
  Package, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Settings, 
  Plus,
  Activity,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Users
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { usePaymentSystem } from '@/lib/integrations/payment-processors'
import { useAccountingSystem } from '@/lib/integrations/accounting-systems'
import { useSupplierSystem } from '@/lib/integrations/inventory-suppliers'

interface IntegrationStatus {
  id: string
  name: string
  type: 'payment' | 'accounting' | 'supplier'
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  lastSync?: Date
  nextSync?: Date
  health: number
  transactions?: number
  errors?: string[]
}

interface IntegrationMetrics {
  totalIntegrations: number
  activeIntegrations: number
  syncErrors: number
  lastSyncTime: Date
  totalTransactions: number
  totalValue: number
}

export default function IntegrationsDashboard() {
  const [selectedTab, setSelectedTab] = React.useState('overview')
  const [showConfigDialog, setShowConfigDialog] = React.useState(false)
  const [configType, setConfigType] = React.useState<'payment' | 'accounting' | 'supplier'>('payment')
  
  const paymentSystem = usePaymentSystem()
  const accountingSystem = useAccountingSystem()
  const supplierSystem = useSupplierSystem()

  // Mock data para demostración
  const [integrations, setIntegrations] = React.useState<IntegrationStatus[]>([
    {
      id: 'stripe',
      name: 'Stripe',
      type: 'payment',
      status: 'connected',
      lastSync: new Date(Date.now() - 30 * 60 * 1000),
      nextSync: new Date(Date.now() + 30 * 60 * 1000),
      health: 98,
      transactions: 1250,
      errors: []
    },
    {
      id: 'paypal',
      name: 'PayPal',
      type: 'payment',
      status: 'connected',
      lastSync: new Date(Date.now() - 45 * 60 * 1000),
      nextSync: new Date(Date.now() + 15 * 60 * 1000),
      health: 95,
      transactions: 890,
      errors: []
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      status: 'connected',
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
      nextSync: new Date(Date.now() + 4 * 60 * 60 * 1000),
      health: 92,
      transactions: 450,
      errors: []
    },
    {
      id: 'supplier1',
      name: 'Proveedor Principal',
      type: 'supplier',
      status: 'syncing',
      lastSync: new Date(Date.now() - 10 * 60 * 1000),
      health: 88,
      transactions: 125,
      errors: []
    },
    {
      id: 'supplier2',
      name: 'Distribuidor ABC',
      type: 'supplier',
      status: 'error',
      lastSync: new Date(Date.now() - 6 * 60 * 60 * 1000),
      health: 45,
      transactions: 0,
      errors: ['Connection timeout', 'Invalid API key']
    }
  ])

  const metrics: IntegrationMetrics = React.useMemo(() => {
    return {
      totalIntegrations: integrations.length,
      activeIntegrations: integrations.filter(i => i.status === 'connected').length,
      syncErrors: integrations.filter(i => i.status === 'error').length,
      lastSyncTime: new Date(Math.max(...integrations.map(i => i.lastSync?.getTime() || 0))),
      totalTransactions: integrations.reduce((sum, i) => sum + (i.transactions || 0), 0),
      totalValue: 125000 // Mock value
    }
  }, [integrations])

  const handleSync = async (integrationId: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === integrationId 
        ? { ...integration, status: 'syncing' as const }
        : integration
    ))

    // Simular sincronización
    setTimeout(() => {
      setIntegrations(prev => prev.map(integration => 
        integration.id === integrationId 
          ? { 
              ...integration, 
              status: 'connected' as const,
              lastSync: new Date(),
              nextSync: new Date(Date.now() + 60 * 60 * 1000),
              health: Math.min(100, integration.health + 5)
            }
          : integration
      ))
    }, 3000)
  }

  const handleSyncAll = async () => {
    const connectedIntegrations = integrations.filter(i => i.status === 'connected' || i.status === 'error')
    
    for (const integration of connectedIntegrations) {
      await handleSync(integration.id)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Delay entre sincronizaciones
    }
  }

  const getStatusIcon = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-gray-400" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'syncing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusColor = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800'
      case 'disconnected':
        return 'bg-gray-100 text-gray-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'syncing':
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getTypeIcon = (type: IntegrationStatus['type']) => {
    switch (type) {
      case 'payment':
        return <CreditCard className="h-4 w-4" />
      case 'accounting':
        return <Calculator className="h-4 w-4" />
      case 'supplier':
        return <Package className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Integraciones</h1>
          <p className="text-muted-foreground">
            Gestiona las conexiones con sistemas externos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncAll} disabled={integrations.some(i => i.status === 'syncing')}>
          <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar Todo
          </Button>
          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Integración
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar Nueva Integración</DialogTitle>
                <DialogDescription>
                  Selecciona el tipo de integración que deseas configurar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="integration-type">Tipo de Integración</Label>
                  <Select value={configType} onValueChange={(value: any) => setConfigType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Procesador de Pagos</SelectItem>
                      <SelectItem value="accounting">Sistema Contable</SelectItem>
                      <SelectItem value="supplier">Proveedor de Inventario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="integration-name">Nombre</Label>
                  <Input id="integration-name" placeholder="Nombre de la integración" />
                </div>
                <div>
                  <Label htmlFor="api-key">API Key</Label>
                  <Input id="api-key" type="password" placeholder="Clave de API" />
                </div>
                <div>
                  <Label htmlFor="endpoint">Endpoint</Label>
                  <Input id="endpoint" placeholder="https://api.ejemplo.com" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="auto-sync" />
                  <Label htmlFor="auto-sync">Sincronización automática</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setShowConfigDialog(false)}>
                    Configurar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Métricas generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integraciones</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalIntegrations}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeIntegrations} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Último mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <GSIcon className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Procesado este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.syncErrors}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {metrics.syncErrors > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hay {metrics.syncErrors} integración(es) con errores que requieren atención.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs de contenido */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="accounting">Contabilidad</TabsTrigger>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(integration.type)}
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription>
                          {integration.type === 'payment' && 'Procesador de pagos'}
                          {integration.type === 'accounting' && 'Sistema contable'}
                          {integration.type === 'supplier' && 'Proveedor de inventario'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(integration.status)}>
                        {getStatusIcon(integration.status)}
                        <span className="ml-1 capitalize">{integration.status}</span>
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(integration.id)}
              disabled={integration.status === 'syncing'}
            >
              <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium">Estado de Salud</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={integration.health} className="flex-1" />
                        <span className="text-sm text-muted-foreground">{integration.health}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Última Sincronización</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {integration.lastSync ? integration.lastSync.toLocaleString() : 'Nunca'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Transacciones</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {integration.transactions?.toLocaleString() || 0} este mes
                      </div>
                    </div>
                  </div>
                  
                  {integration.errors && integration.errors.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-red-600 mb-2">Errores:</div>
                      <ul className="text-sm text-red-600 space-y-1">
                        {integration.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Procesadores de Pago</CardTitle>
              <CardDescription>
                Gestiona las integraciones con procesadores de pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.filter(i => i.type === 'payment').map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-8 w-8" />
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.transactions} transacciones procesadas
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Configurar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistemas Contables</CardTitle>
              <CardDescription>
                Gestiona las integraciones con sistemas de contabilidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.filter(i => i.type === 'accounting').map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-8 w-8" />
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Última sincronización: {integration.lastSync?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Sincronizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proveedores de Inventario</CardTitle>
              <CardDescription>
                Gestiona las integraciones con proveedores de inventario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.filter(i => i.type === 'supplier').map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="h-8 w-8" />
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.transactions} productos sincronizados
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Gestionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
