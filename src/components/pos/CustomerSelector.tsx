'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Phone, Plus, Search, Star, Wrench, Tag, Shield, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCustomerRepairs, type CustomerRepair } from '@/hooks/useCustomerRepairs'
import { useCustomerState, type Customer as DbCustomer } from '@/hooks/use-customer-state'

type Customer = DbCustomer

interface CustomerSelectorProps {
    selectedCustomer: Customer | null
    onSelectCustomer: (customer: Customer | null) => void
    customers?: Customer[]
    onAddRepairToCart?: (repair: CustomerRepair) => void
}

const MOCK_CUSTOMERS: Customer[] = []

export function CustomerSelector({
    selectedCustomer,
    onSelectCustomer,
    customers: customersProp,
    onAddRepairToCart
}: CustomerSelectorProps) {
    const { filteredCustomers, loading: loadingCustomers } = useCustomerState()
    const customers = customersProp ?? filteredCustomers
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        email: '',
        phone: ''
    })

    // Filter customers by search term
    const searchFilteredCustomers = useMemo(() => {
        if (!search.trim()) return customers

        const searchLower = search.toLowerCase()
        return customers.filter(c =>
            c.name.toLowerCase().includes(searchLower) ||
            c.email?.toLowerCase().includes(searchLower) ||
            c.phone?.toLowerCase().includes(searchLower)
        )
    }, [customers, search])

    const handleSelectCustomer = (customer: Customer) => {
        onSelectCustomer(customer)
        setIsOpen(false)
        setSearch('')
    }

    const handleClearCustomer = () => {
        onSelectCustomer(null)
    }

    const handleAddCustomer = () => {
        if (!newCustomer.name.trim()) return

        const id = Date.now().toString()
        const now = new Date().toISOString()
        const customer: Customer = {
            id,
            customerCode: `CLI-${id.slice(0, 6)}`,
            name: newCustomer.name,
            email: newCustomer.email || '',
            phone: newCustomer.phone || '',
            ruc: '',
            customer_type: 'regular',
            status: 'active',
            total_purchases: 0,
            total_repairs: 0,
            registration_date: now,
            last_visit: now,
            last_activity: now,
            address: '',
            city: '',
            credit_score: 0,
            segment: 'regular',
            satisfaction_score: 0,
            lifetime_value: 0,
            avg_order_value: 0,
            purchase_frequency: 'low',
            preferred_contact: 'email',
            birthday: '',
            loyalty_points: 0,
            credit_limit: 0,
            current_balance: 0,
            pending_amount: 0,
            notes: '',
            tags: [],
            referral_source: '',
            discount_percentage: 0,
            payment_terms: 'Contado',
            assigned_salesperson: 'Sin asignar',
            last_purchase_amount: 0,
            total_spent_this_year: 0
        }

        onSelectCustomer(customer)
        setNewCustomer({ name: '', email: '', phone: '' })
        setShowAddForm(false)
        setIsOpen(false)
    }

    const { fetchPendingRepairs, repairs: pendingRepairs, loading: loadingRepairs } = useCustomerRepairs()
    const [showRepairsDialog, setShowRepairsDialog] = useState(false)

    // Check for repairs when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            fetchPendingRepairs(selectedCustomer.id)
        }
    }, [selectedCustomer, fetchPendingRepairs])

    const handleAddRepairToCart = (repair: CustomerRepair) => {
        // This would need to be passed down or handled via a context/callback
        // For now, we'll emit a custom event or use a callback prop if available
        // But since we don't have a direct prop for this in the interface yet, 
        // we might need to update the props.
        // Let's assume we pass a callback or use a custom event for now, 
        // or better, update the component props.

        // Actually, let's update the props to include onAddRepairToCart
        if (onAddRepairToCart) {
            onAddRepairToCart(repair)
            setShowRepairsDialog(false)
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedCustomer ? (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-medium">{selectedCustomer.name}</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                                            <Shield className="h-3 w-3" />{selectedCustomer.customer_type}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs inline-flex items-center gap-1">
                                            <Tag className="h-3 w-3" />{selectedCustomer.segment}
                                        </Badge>
                                        <Badge
                                            variant={selectedCustomer.status === 'active' ? 'default' : selectedCustomer.status === 'inactive' ? 'secondary' : 'destructive'}
                                            className="text-xs inline-flex items-center gap-1"
                                        >
                                            <CheckCircle className="h-3 w-3" />{selectedCustomer.status}
                                        </Badge>
                                    </div>
                                    {selectedCustomer.email && (
                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                            <Mail className="h-3 w-3" />
                                            {selectedCustomer.email}
                                        </p>
                                    )}
                                    {selectedCustomer.phone && (
                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {selectedCustomer.phone}
                                        </p>
                                    )}
                                </div>
                                {selectedCustomer.loyalty_points !== undefined && (
                                    <Badge variant="secondary" className="flex gap-1">
                                        <Star className="h-3 w-3 fill-current" />
                                        {selectedCustomer.loyalty_points}
                                    </Badge>
                                )}
                            </div>

                            {/* Pending Repairs Alert */}
                            {pendingRepairs.length > 0 && (
                                <div
                                    className="bg-yellow-50 border border-yellow-200 rounded-md p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
                                    onClick={() => setShowRepairsDialog(true)}
                                >
                                    <div className="flex items-center gap-2 text-yellow-800 font-medium text-sm">
                                        <Wrench className="h-4 w-4" />
                                        <span>{pendingRepairs.length} Reparación(es) Pendiente(s)</span>
                                    </div>
                                    <p className="text-xs text-yellow-600 mt-1">
                                        Click para ver y cobrar
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setIsOpen(true)}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                >
                                    Cambiar
                                </Button>
                                <Button
                                    onClick={handleClearCustomer}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                >
                                    Quitar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            onClick={() => setIsOpen(true)}
                            variant="outline"
                            className="w-full"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Seleccionar Cliente
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Customer Selection Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Seleccionar Cliente</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre, email o teléfono..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Quick Add Form */}
                        {showAddForm ? (
                            <Card className="border-blue-200 bg-blue-50">
                                <CardContent className="pt-4 space-y-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nombre *</Label>
                                        <Input
                                            id="name"
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Nombre del cliente"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={newCustomer.email}
                                                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder="email@ejemplo.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Teléfono</Label>
                                            <Input
                                                id="phone"
                                                value={newCustomer.phone}
                                                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="0981-123456"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={handleAddCustomer} className="flex-1">
                                            Agregar
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setShowAddForm(false)
                                                setNewCustomer({ name: '', email: '', phone: '' })
                                            }}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Button
                                onClick={() => setShowAddForm(true)}
                                variant="outline"
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Crear Nuevo Cliente
                            </Button>
                        )}

                        {/* Customer List */}
                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {loadingCustomers ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                                    <p>Cargando clientes…</p>
                                </div>
                            ) : searchFilteredCustomers.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <User className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                    <p>No se encontraron clientes</p>
                                </div>
                            ) : (
                                searchFilteredCustomers.map((customer) => (
                                    <Card
                                        key={customer.id}
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => handleSelectCustomer(customer)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-medium">{customer.name}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                                                            <Shield className="h-3 w-3" />{customer.customer_type}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-xs inline-flex items-center gap-1">
                                                            <Tag className="h-3 w-3" />{customer.segment}
                                                        </Badge>
                                                        <Badge
                                                            variant={customer.status === 'active' ? 'default' : customer.status === 'inactive' ? 'secondary' : 'destructive'}
                                                            className="text-xs inline-flex items-center gap-1"
                                                        >
                                                            <CheckCircle className="h-3 w-3" />{customer.status}
                                                        </Badge>
                                                    </div>
                                                    {customer.email && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {customer.email}
                                                        </p>
                                                    )}
                                                    {customer.phone && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                                            <Phone className="h-3 w-3" />
                                                            {customer.phone}
                                                        </p>
                                                    )}
                                                </div>
                                                {customer.loyalty_points !== undefined && customer.loyalty_points > 0 && (
                                                    <Badge variant="secondary" className="flex gap-1">
                                                        <Star className="h-3 w-3 fill-current" />
                                                        {customer.loyalty_points}
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Repairs Dialog */}
            <Dialog open={showRepairsDialog} onOpenChange={setShowRepairsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reparaciones Pendientes de Pago</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {loadingRepairs ? (
                            <div className="text-center py-6 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-3"></div>
                                <p>Cargando reparaciones…</p>
                            </div>
                        ) : pendingRepairs.length === 0 ? (
                            <div className="text-center py-6 text-gray-500">
                                <Wrench className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                <p>No hay reparaciones pendientes</p>
                            </div>
                        ) : (
                            pendingRepairs.map(repair => (
                                <Card key={repair.id} className="border-l-4 border-l-yellow-500">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium">{repair.device_brand} {repair.device_model}</h4>
                                                <p className="text-sm text-gray-600">{repair.problem_description}</p>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {new Date(repair.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">
                                                    {formatCurrency(Math.round(repair.final_cost || repair.estimated_cost))}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => handleAddRepairToCart(repair)}
                                                >
                                                    Cobrar
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
