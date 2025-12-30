/**
 * Componente para mostrar el historial de créditos y reparaciones del cliente
 * Integrado con el sistema POS
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CreditCard,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  Receipt,
  Search,
  Filter
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'

interface CustomerCreditHistoryProps {
  customer: Customer
  onClose?: () => void
  compact?: boolean
}

export function CustomerCreditHistory({ customer, onClose, compact = false }: CustomerCreditHistoryProps) {
  const {
    getCreditSummary,
    getCustomerTransactions,
    getCustomerSales,
    getOverdueSales,
    recordPayment,
    formatCreditStatus,
    getCreditStatusColor,
    calculateDaysOverdue
  } = useCreditSystem()

  const [activeTab, setActiveTab] = useState('summary')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Datos del cliente
  const creditSummary = getCreditSummary(customer)
  const transactions = getCustomerTransactions(customer.id)
  const creditSales = getCustomerSales(customer.id)
  const overdueSales = getOverdueSales(customer.id)

  // Filtrar transacciones
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = searchTerm === '' || 
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || transaction.type === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [transactions, searchTerm, statusFilter])

  // Filtrar ventas
  const filteredSales = useMemo(() => {
    return creditSales.filter(sale => {
      const matchesSearch = searchTerm === '' ||
        sale.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        sale.saleId.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [creditSales, searchTerm, statusFilter])

  // Manejar pago
  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }

    if (amount > creditSummary.usedCredit) {
      toast.error('El monto no puede ser mayor al saldo pendiente')
      return
    }

    const success = await recordPayment(customer.id, amount, paymentMethod, paymentReference)
    if (success) {
      setShowPaymentModal(false)
      setPaymentAmount('')
      setPaymentReference('')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale': return <ShoppingBag className="h-4 w-4" />
      case 'payment': return <DollarSign className="h-4 w-4" />
      case 'adjustment': return <TrendingUp className="h-4 w-4" />
      default: return <Receipt className="h-4 w-4" />
    }
  }

  const getTransactionColor = (type: string, amount: number) => {
    if (type === 'payment') return 'text-green-600'
    if (amount > 0) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Header con resumen de crédito */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/20">
        <CardHeader className={compact ? "p-4" : "p-6"}>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Resumen de Crédito - {customer.name}
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? "p-4 pt-0" : "p-6 pt-0"}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(creditSummary.totalCredit)}
              </div>
              <div className="text-sm text-gray-600">Límite Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(creditSummary.availableCredit)}
              </div>
              <div className="text-sm text-gray-600">Disponible</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(creditSummary.usedCredit)}
              </div>
              <div className="text-sm text-gray-600">Usado</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${creditSummary.overdueAmount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {formatCurrency(creditSummary.overdueAmount)}
              </div>
              <div className="text-sm text-gray-600">Vencido</div>
            </div>
          </div>

          {/* Barra de utilización */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Utilización de Crédito</span>
              <span>{creditSummary.creditUtilization.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  creditSummary.creditUtilization > 80 ? 'bg-red-500' :
                  creditSummary.creditUtilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(creditSummary.creditUtilization, 100)}%` }}
              />
            </div>
          </div>

          {/* Alertas */}
          {overdueSales.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">
                  {overdueSales.length} venta{overdueSales.length > 1 ? 's' : ''} vencida{overdueSales.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Botón de pago */}
          {creditSummary.usedCredit > 0 && (
            <div className="mt-4">
              <Button 
                onClick={() => setShowPaymentModal(true)}
                className="w-full"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs de historial */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="sales">Ventas a Crédito</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Ventas vencidas */}
          {overdueSales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Ventas Vencidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overdueSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <div className="font-medium">{sale.items.map(i => i.name).join(', ')}</div>
                        <div className="text-sm text-gray-600">
                          Vencido hace {calculateDaysOverdue(sale.dueDate)} días
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">
                          {formatCurrency(sale.remainingAmount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Vence: {formatDate(sale.dueDate)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Últimas transacciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Últimas Transacciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.slice(0, 5).map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-gray-600">{formatDate(transaction.date)}</div>
                      </div>
                    </div>
                    <div className={`font-bold ${getTransactionColor(transaction.type, transaction.amount)}`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar transacciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="sale">Ventas</SelectItem>
                    <SelectItem value="payment">Pagos</SelectItem>
                    <SelectItem value="adjustment">Ajustes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de transacciones */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Transacciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map(transaction => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(transaction.type)}
                          <span className="capitalize">{transaction.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        {transaction.reference && (
                          <span className="font-mono text-sm">{transaction.reference}</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${getTransactionColor(transaction.type, transaction.amount)}`}>
                        {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          {/* Tabla de ventas a crédito */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas a Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Artículos</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell>{formatDate(sale.createdAt)}</TableCell>
                      <TableCell>
                        <div>
                          {sale.items.map(item => item.name).join(', ')}
                          {sale.repairIds && sale.repairIds.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Wrench className="h-3 w-3" />
                              {sale.repairIds.length} reparación{sale.repairIds.length > 1 ? 'es' : ''}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(sale.amount)}
                      </TableCell>
                      <TableCell className="font-bold text-orange-600">
                        {formatCurrency(sale.remainingAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(sale.dueDate)}
                          {new Date(sale.dueDate) < new Date() && sale.status !== 'paid' && (
                            <div className="text-xs text-red-600">
                              Vencido hace {calculateDaysOverdue(sale.dueDate)} días
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCreditStatusColor(sale.status)}>
                          {formatCreditStatus(sale.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de pago */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Monto a Pagar</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <div className="text-sm text-gray-600 mt-1">
                Saldo pendiente: {formatCurrency(creditSummary.usedCredit)}
              </div>
            </div>
            <div>
              <Label htmlFor="method">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(paymentMethod === 'transfer' || paymentMethod === 'check') && (
              <div>
                <Label htmlFor="reference">Referencia</Label>
                <Input
                  id="reference"
                  placeholder="Número de referencia"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePayment}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}