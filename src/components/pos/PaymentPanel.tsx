'use client'

import { useState } from 'react'
import { CreditCard, Smartphone, Wallet, Plus, Trash2 } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { PaymentSplit } from '@/hooks/usePOS'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'

interface PaymentPanelProps {
    total: number
    totalPaid: number
    change: number
    payments: PaymentSplit[]
    onAddPayment: (payment: Omit<PaymentSplit, 'id'>) => void
    onRemovePayment: (paymentId: string) => void
    onProcessSale: () => void
    processing?: boolean
}

const PAYMENT_METHODS = [
    { id: 'cash', label: 'Efectivo', icon: GSIcon, color: 'bg-green-500', requiresRef: false },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-500', requiresRef: true },
    { id: 'transfer', label: 'Transferencia', icon: Smartphone, color: 'bg-purple-500', requiresRef: true },
    { id: 'credit', label: 'Crédito', icon: Wallet, color: 'bg-orange-500', requiresRef: false }
] as const

export function PaymentPanel({
    total,
    totalPaid,
    change,
    payments,
    onAddPayment,
    onRemovePayment,
    onProcessSale,
    processing
}: PaymentPanelProps) {
    const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash')
    const [amount, setAmount] = useState('')
    const [reference, setReference] = useState('')

    const remaining = total - totalPaid
    const isFullyPaid = totalPaid >= total

    const handleAddPayment = () => {
        const paymentAmount = parseFloat(amount)

        if (!paymentAmount || paymentAmount <= 0) {
            toast.error('Ingrese un monto válido')
            return
        }

        const method = PAYMENT_METHODS.find(m => m.id === selectedMethod)

        if (method?.requiresRef && !reference.trim()) {
            toast.error('Ingrese el número de referencia')
            return
        }

        onAddPayment({
            method: selectedMethod,
            amount: paymentAmount,
            reference: reference.trim() || undefined
        })

        // Reset form
        setAmount('')
        setReference('')
        toast.success('Pago agregado')
    }

    const handleQuickAmount = (value: number) => {
        setAmount(value.toString())
    }

    const suggestedAmounts = [
        { label: 'Total', value: total },
        { label: 'Restante', value: remaining },
        { label: '10.000', value: 10000 },
        { label: '20.000', value: 20000 },
        { label: '50.000', value: 50000 },
        { label: '100.000', value: 100000 }
    ]

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Método de Pago</CardTitle>
            </CardHeader>

            <CardContent className="flex-1 space-y-6">
                {/* Payment Method Selection */}
                <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon
                        return (
                            <Button
                                key={method.id}
                                variant={selectedMethod === method.id ? 'default' : 'outline'}
                                className={`h-20 flex flex-col gap-2 ${selectedMethod === method.id ? method.color + ' text-white' : ''
                                    }`}
                                onClick={() => setSelectedMethod(method.id)}
                            >
                                <Icon className="h-6 w-6" />
                                <span className="text-sm">{method.label}</span>
                            </Button>
                        )
                    })}
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                    <Label htmlFor="amount">Monto a Pagar</Label>
                    <Input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="text-lg"
                        min={0}
                    />

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                        {suggestedAmounts.map((suggested) => (
                            <Button
                                key={suggested.label}
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickAmount(suggested.value)}
                                className="text-xs"
                            >
                                {suggested.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Reference Number (for card/transfer) */}
                {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.requiresRef && (
                    <div className="space-y-2">
                        <Label htmlFor="reference">
                            {selectedMethod === 'card' ? 'N° de Autorización' : 'N° de Referencia'}
                        </Label>
                        <Input
                            id="reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder={selectedMethod === 'card' ? 'Últimos 4 dígitos' : 'Número de referencia'}
                        />
                    </div>
                )}

                {/* Add Payment Button */}
                <Button
                    onClick={handleAddPayment}
                    className="w-full"
                    size="lg"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Pago
                </Button>

                <Separator />

                {/* Payment Summary */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-medium">Total a Pagar:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(total)}</span>
                    </div>

                    {payments.length > 0 && (
                        <>
                            <div className="space-y-2">
                                <span className="text-sm font-medium text-gray-600">Pagos Registrados:</span>
                                {payments.map((payment) => {
                                    const method = PAYMENT_METHODS.find(m => m.id === payment.method)
                                    const Icon = method?.icon || GSIcon

                                    return (
                                        <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-gray-600" />
                                                <span className="text-sm">{method?.label}</span>
                                                {payment.reference && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {payment.reference}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onRemovePayment(payment.id)}
                                                    className="h-6 w-6 p-0"
                                                >
                                                    <Trash2 className="h-3 w-3 text-red-600" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Pagado:</span>
                                <span className="font-bold text-green-600">{formatCurrency(totalPaid)}</span>
                            </div>
                        </>
                    )}

                    {remaining > 0 && totalPaid > 0 && (
                        <div className="flex justify-between items-center text-red-600">
                            <span className="font-medium">Falta:</span>
                            <span className="font-bold">{formatCurrency(remaining)}</span>
                        </div>
                    )}

                    {change > 0 && (
                        <div className="flex justify-between items-center text-lg border-t pt-3">
                            <span className="font-medium">Cambio:</span>
                            <span className="font-bold text-green-600">{formatCurrency(change)}</span>
                        </div>
                    )}
                </div>

                {/* Process Sale Button */}
                <Button
                    onClick={onProcessSale}
                    disabled={!isFullyPaid || processing}
                    className="w-full h-14 text-lg"
                    size="lg"
                >
                    {processing ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CreditCard className="h-5 w-5 mr-2" />
                            {isFullyPaid ? 'Completar Venta' : `Falta ${formatCurrency(remaining)}`}
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
