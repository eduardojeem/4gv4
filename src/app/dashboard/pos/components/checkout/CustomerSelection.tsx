/**
 * Componente para selección y gestión de clientes
 * Extraído del CheckoutModal para mejor modularización
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Star, 
  Mail, 
  Phone, 
  MapPin, 
  AlertCircle
} from 'lucide-react'
import { CustomerProvider } from '@/contexts/CustomerContext'
import { CustomerSyncSection } from '../CustomerSyncSection'
import { CustomerRefreshButton } from '../CustomerRefreshButton'
import { usePOSCustomer } from '../../contexts/POSCustomerContext'

interface CreditSummary {
  totalCredit: number
  availableCredit: number
  usedCredit: number
  overdueAmount: number
  pendingSales: number
  creditUtilization: number
}

interface CustomerSelectionProps {
  // Crédito
  creditSummary?: CreditSummary
  showCreditHistory: boolean
  setShowCreditHistory: (show: boolean) => void
  
  formatCurrency: (amount: number) => string
  // Reparaciones del cliente
  customerRepairs?: any[]
  selectedRepairIds?: string[]
  supabaseStatusToLabel?: Record<string, string>
  paymentStatus?: 'idle' | 'processing' | 'success' | 'failed'
}

export function CustomerSelection({
  creditSummary,
  showCreditHistory,
  setShowCreditHistory,
  formatCurrency,
  customerRepairs = [],
  selectedRepairIds = [],
  supabaseStatusToLabel = {},
  paymentStatus = 'idle'
}: CustomerSelectionProps) {
  
  const {
    selectedCustomer,
    setSelectedCustomer,
    activeCustomer,
    customerSearch,
    setCustomerSearch,
    customerTypeFilter,
    setCustomerTypeFilter,
    customerTypes,
    showFrequentOnly,
    setShowFrequentOnly,
    filteredCustomers,
    setCustomers,
    setCustomersSourceSupabase,
    customersSourceSupabase,
    lastCustomerRefreshCount,
    setLastCustomerRefreshCount,
    newCustomerOpen,
    setNewCustomerOpen,
    newFirstName,
    setNewFirstName,
    newLastName,
    setNewLastName,
    newPhone,
    setNewPhone,
    newEmail,
    setNewEmail,
    newType,
    setNewType,
    newCustomerSaving,
    createNewCustomer
  } = usePOSCustomer()

  return (
    <CustomerProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Detalles del Cliente</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewCustomerOpen(true)}
          >
            Nuevo cliente
          </Button>
        </div>

        {/* Sincronización */}
        <CustomerSyncSection
          onSync={(rows, fromSupabase) => { 
            setCustomers(rows)
            setCustomersSourceSupabase(fromSupabase)
          }}
          onCount={(n) => setLastCustomerRefreshCount(n)}
        />

        {/* Filtros de búsqueda */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar cliente por nombre, teléfono o email"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />
          <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {customerTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showFrequentOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFrequentOnly(!showFrequentOnly)}
          >
            {showFrequentOnly ? 'Frecuentes ✓' : 'Frecuentes'}
          </Button>
          <CustomerRefreshButton
            onUpdated={(rows) => setCustomers(rows)}
            setCustomersSourceSupabase={setCustomersSourceSupabase}
            setLastCustomerRefreshCount={setLastCustomerRefreshCount}
            lastCustomerRefreshCount={lastCustomerRefreshCount}
            setCustomers={setCustomers}
          />
        </div>

        {/* Información de origen */}
        <div className="text-xs text-muted-foreground">
          Origen: {customersSourceSupabase ? 'Supabase' : 'Demo'} · Clientes: {filteredCustomers.length}
        </div>

        {/* Selector de cliente */}
        <Select 
          value={selectedCustomer || '__none__'} 
          onValueChange={(v) => setSelectedCustomer(v === '__none__' ? '' : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin cliente</SelectItem>
            {filteredCustomers.map(customer => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.name} 
                {customer.phone ? ` - ${customer.phone}` : ''} 
                {customer.email ? ` - ${customer.email}` : ''} 
                {customer.type ? ` · ${customer.type}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Información del cliente seleccionado */}
        {activeCustomer ? (
          <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="h-24 w-24" />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    {activeCustomer.name}
                    {activeCustomer.type === 'vip' && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900">
                        <Star className="h-3 w-3 mr-1 fill-yellow-600 text-yellow-600" /> VIP
                      </Badge>
                    )}
                    {activeCustomer.type === 'wholesale' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900">
                        Mayorista
                      </Badge>
                    )}
                  </h4>
                  <div className="text-sm text-muted-foreground mt-2 space-y-1.5">
                    {activeCustomer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{activeCustomer.email}</span>
                      </div>
                    )}
                    {activeCustomer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{activeCustomer.phone}</span>
                      </div>
                    )}
                    {(activeCustomer.address || activeCustomer.city) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{[activeCustomer.address, activeCustomer.city].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  {activeCustomer.loyalty_points !== undefined && activeCustomer.loyalty_points > 0 && (
                    <div className="flex flex-col items-end bg-primary/5 p-2 rounded-lg mb-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Puntos</span>
                      <span className="font-bold text-xl text-primary">{activeCustomer.loyalty_points}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-0.5">Compras</span>
                  <span className="font-medium text-sm">{activeCustomer.total_purchases || 0}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-0.5">Reparaciones</span>
                  <span className="font-medium text-sm">{activeCustomer.total_repairs || 0}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-0.5">Saldo</span>
                  <span className={`font-medium text-sm ${(activeCustomer.current_balance || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {formatCurrency(activeCustomer.current_balance || 0)}
                  </span>
                </div>
              </div>

              {/* Resumen de reparaciones del cliente */}
              <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reparaciones del cliente</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Total: {customerRepairs.length}</Badge>
                    <Badge variant="outline" className="text-[10px]">Activas: {customerRepairs.filter(r => r.status !== 'entregado').length}</Badge>
                    <Badge variant="outline" className="text-[10px]">Seleccionadas: {selectedRepairIds.length}</Badge>
                  </div>
                </div>

                {/* Indicador de entrega tras venta */}
                {paymentStatus === 'success' && selectedRepairIds.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-800 dark:bg-green-900/20">
                    <span className="text-xs font-medium">Entregadas {selectedRepairIds.length} reparaciones vinculadas</span>
                  </div>
                )}

                {/* Lista compacta de reparaciones seleccionadas */}
                {selectedRepairIds.length > 0 && (
                  <div className="space-y-1">
                    {customerRepairs.filter(r => selectedRepairIds.includes(r.id)).map((repair) => (
                      <div key={repair.id} className="flex items-center justify-between text-xs border rounded p-2 bg-background">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {supabaseStatusToLabel[repair.status] || repair.status}
                          </Badge>
                          <span className="font-medium">
                            {repair.device_brand || 'Equipo'} {repair.device_model || ''}
                          </span>
                        </div>
                        <div className={`text-[10px] ${repair.status === 'entregado' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {repair.status === 'entregado' ? 'Entregado' : 'Pendiente'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Información de crédito */}
              {creditSummary && creditSummary.totalCredit > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Crédito</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCreditHistory(true)}
                      className="h-6 px-2 text-xs"
                    >
                      Ver Historial
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Disponible</span>
                      <div className="font-bold text-green-600">
                        {formatCurrency(creditSummary.availableCredit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Límite</span>
                      <div className="font-medium text-sm">
                        {formatCurrency(creditSummary.totalCredit)}
                      </div>
                    </div>
                  </div>
                  {creditSummary.overdueAmount > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      Vencido: {formatCurrency(creditSummary.overdueAmount)}
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
                <span>ID: <span className="font-mono opacity-70">{activeCustomer.id?.slice(0, 8)}...</span></span>
                {activeCustomer.last_visit && (
                  <span>Última visita: {new Date(activeCustomer.last_visit).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Puede confirmar la venta sin seleccionar cliente.
          </div>
        )}

        {/* Modal de nuevo cliente */}
        <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
          <DialogContent className="max-w-md w-[92vw] sm:w-auto">
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Nombre"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                />
                <Input
                  placeholder="Apellido"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                />
              </div>
              <Input
                placeholder="Teléfono"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <Input
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="wholesale">Mayorista</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={createNewCustomer}
                disabled={newCustomerSaving}
              >
                {newCustomerSaving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerProvider>
  )
}
