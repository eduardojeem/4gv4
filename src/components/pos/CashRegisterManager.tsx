'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, X, FileText } from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCashRegister } from '@/hooks/useCashRegister'
import { formatCurrency } from '@/lib/currency'

export function CashRegisterManager() {
    const {
        currentSession,
        isOpen,
        currentBalance,
        loading,
        openRegister,
        closeRegister,
        addCashIn,
        addCashOut,
        getSessionReport
    } = useCashRegister()

    const [showOpenDialog, setShowOpenDialog] = useState(false)
    const [showCloseDialog, setShowCloseDialog] = useState(false)
    const [showCashInDialog, setShowCashInDialog] = useState(false)
    const [showCashOutDialog, setShowCashOutDialog] = useState(false)
    const [showReportDialog, setShowReportDialog] = useState(false)

    const [openingAmount, setOpeningAmount] = useState('')
    const [closingAmount, setClosingAmount] = useState('')
    const [cashAmount, setCashAmount] = useState('')
    const [cashReason, setCashReason] = useState('')

    const handleOpenRegister = async () => {
        const amount = parseFloat(openingAmount)
        if (isNaN(amount) || amount < 0) return

        const success = await openRegister('principal', amount)
        if (success) {
            setShowOpenDialog(false)
            setOpeningAmount('')
        }
    }

    const handleCloseRegister = async () => {
        const amount = parseFloat(closingAmount)
        if (isNaN(amount) || amount < 0) return

        const success = await closeRegister(amount)
        if (success) {
            setShowCloseDialog(false)
            setClosingAmount('')
        }
    }

    const handleCashIn = async () => {
        const amount = parseFloat(cashAmount)
        if (isNaN(amount) || amount <= 0 || !cashReason.trim()) return

        const success = await addCashIn(amount, cashReason)
        if (success) {
            setShowCashInDialog(false)
            setCashAmount('')
            setCashReason('')
        }
    }

    const handleCashOut = async () => {
        const amount = parseFloat(cashAmount)
        if (isNaN(amount) || amount <= 0 || !cashReason.trim()) return

        const success = await addCashOut(amount, cashReason)
        if (success) {
            setShowCashOutDialog(false)
            setCashAmount('')
            setCashReason('')
        }
    }

    const report = getSessionReport()

    return (
        <>
            {/* Main Status Card */}
            <Card className="border-2 border-blue-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <GSIcon className="h-5 w-5" />
                            Caja Registradora
                        </CardTitle>
                        <Badge variant={isOpen ? 'default' : 'secondary'}>
                            {isOpen ? 'Abierta' : 'Cerrada'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    {isOpen && currentSession ? (
                        <>
                            {/* Current Balance */}
                            <div className="text-center py-4">
                                <div className="text-sm text-gray-600 mb-2">Saldo Actual</div>
                                <div className="text-4xl font-bold text-blue-600">
                                    {formatCurrency(currentBalance)}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    Apertura: {formatCurrency(currentSession.opening_balance)}
                                </div>
                            </div>

                            <Separator />

                            {/* Quick Stats */}
                            {report && (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">
                                            {report.salesCount}
                                        </div>
                                        <div className="text-xs text-gray-600">Ventas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {formatCurrency(report.totalSales)}
                                        </div>
                                        <div className="text-xs text-gray-600">Total Ventas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">
                                            {report.movements.length}
                                        </div>
                                        <div className="text-xs text-gray-600">Movimientos</div>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={() => setShowCashInDialog(true)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                                    Entrada
                                </Button>
                                <Button
                                    onClick={() => setShowCashOutDialog(true)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <TrendingDown className="h-4 w-4 mr-2 text-red-600" />
                                    Salida
                                </Button>
                                <Button
                                    onClick={() => setShowReportDialog(true)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Reporte
                                </Button>
                                <Button
                                    onClick={() => setShowCloseDialog(true)}
                                    variant="destructive"
                                    className="w-full"
                                    disabled={loading}
                                >
                                    Cerrar Caja
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600 mb-4">La caja está cerrada</p>
                            <Button
                                onClick={() => setShowOpenDialog(true)}
                                size="lg"
                                disabled={loading}
                            >
                                Abrir Caja
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Open Register Dialog */}
            <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Abrir Caja Registradora</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="opening-amount">Monto Inicial</Label>
                            <Input
                                id="opening-amount"
                                type="number"
                                value={openingAmount}
                                onChange={(e) => setOpeningAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleOpenRegister} className="flex-1" disabled={loading}>
                                Abrir Caja
                            </Button>
                            <Button onClick={() => setShowOpenDialog(false)} variant="outline">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Close Register Dialog */}
            <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cerrar Caja Registradora</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {report && (
                            <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Apertura:</span>
                                    <span className="font-bold">{formatCurrency(report.openingBalance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Ventas ({report.salesCount}):</span>
                                    <span className="font-bold text-green-600">+{formatCurrency(report.totalSales)}</span>
                                </div>
                                {report.totalCashIn > 0 && (
                                    <div className="flex justify-between">
                                        <span>Entradas:</span>
                                        <span className="font-bold text-green-600">+{formatCurrency(report.totalCashIn)}</span>
                                    </div>
                                )}
                                {report.totalCashOut > 0 && (
                                    <div className="flex justify-between">
                                        <span>Salidas:</span>
                                        <span className="font-bold text-red-600">-{formatCurrency(report.totalCashOut)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-lg">
                                    <span>Esperado:</span>
                                    <span className="font-bold">{formatCurrency(report.currentBalance)}</span>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="closing-amount">Monto Real en Caja</Label>
                            <Input
                                id="closing-amount"
                                type="number"
                                value={closingAmount}
                                onChange={(e) => setClosingAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCloseRegister} variant="destructive" className="flex-1" disabled={loading}>
                                Cerrar Caja
                            </Button>
                            <Button onClick={() => setShowCloseDialog(false)} variant="outline">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cash In Dialog */}
            <Dialog open={showCashInDialog} onOpenChange={setShowCashInDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Entrada de Efectivo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="cash-in-amount">Monto</Label>
                            <Input
                                id="cash-in-amount"
                                type="number"
                                value={cashAmount}
                                onChange={(e) => setCashAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cash-in-reason">Motivo</Label>
                            <Textarea
                                id="cash-in-reason"
                                value={cashReason}
                                onChange={(e) => setCashReason(e.target.value)}
                                placeholder="Describe el motivo de la entrada..."
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCashIn} className="flex-1">
                                Registrar Entrada
                            </Button>
                            <Button onClick={() => {
                                setShowCashInDialog(false)
                                setCashAmount('')
                                setCashReason('')
                            }} variant="outline">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cash Out Dialog */}
            <Dialog open={showCashOutDialog} onOpenChange={setShowCashOutDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Salida de Efectivo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="cash-out-amount">Monto</Label>
                            <Input
                                id="cash-out-amount"
                                type="number"
                                value={cashAmount}
                                onChange={(e) => setCashAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cash-out-reason">Motivo</Label>
                            <Textarea
                                id="cash-out-reason"
                                value={cashReason}
                                onChange={(e) => setCashReason(e.target.value)}
                                placeholder="Describe el motivo de la salida..."
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleCashOut} variant="destructive" className="flex-1">
                                Registrar Salida
                            </Button>
                            <Button onClick={() => {
                                setShowCashOutDialog(false)
                                setCashAmount('')
                                setCashReason('')
                            }} variant="outline">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Report Dialog */}
            <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Reporte de Sesión</DialogTitle>
                    </DialogHeader>
                    {report && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <Card>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between">
                                        <span>Apertura:</span>
                                        <span className="font-bold">{formatCurrency(report.openingBalance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Ventas Realizadas:</span>
                                        <span className="font-bold">{report.salesCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Total Ventas:</span>
                                        <span className="font-bold text-green-600">{formatCurrency(report.totalSales)}</span>
                                    </div>
                                    {report.totalCashIn > 0 && (
                                        <div className="flex justify-between">
                                            <span>Entradas Adicionales:</span>
                                            <span className="font-bold text-green-600">+{formatCurrency(report.totalCashIn)}</span>
                                        </div>
                                    )}
                                    {report.totalCashOut > 0 && (
                                        <div className="flex justify-between">
                                            <span>Salidas:</span>
                                            <span className="font-bold text-red-600">-{formatCurrency(report.totalCashOut)}</span>
                                        </div>
                                    )}
                                    <Separator />
                                    <div className="flex justify-between text-lg">
                                        <span className="font-bold">Saldo Actual:</span>
                                        <span className="font-bold text-blue-600">{formatCurrency(report.currentBalance)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Movements */}
                            <div>
                                <h4 className="font-semibold mb-2">Movimientos ({report.movements.length})</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {report.movements.map((movement) => (
                                        <Card key={movement.id} className="border-l-4 border-l-blue-500">
                                            <CardContent className="p-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-medium capitalize">{movement.type.replace('_', ' ')}</div>
                                                        {movement.reason && (
                                                            <div className="text-sm text-gray-600">{movement.reason}</div>
                                                        )}
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {new Date(movement.created_at).toLocaleString('es')}
                                                        </div>
                                                    </div>
                                                    <div className={`font-bold ${movement.type === 'sale' || movement.type === 'cash_in' || movement.type === 'opening'
                                                            ? 'text-green-600'
                                                            : movement.type === 'cash_out'
                                                                ? 'text-red-600'
                                                                : 'text-gray-600'
                                                        }`}>
                                                        {movement.type === 'cash_out' ? '-' : '+'}{formatCurrency(movement.amount)}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
