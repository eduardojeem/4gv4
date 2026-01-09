'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface CashCount {
  bills: Record<string, number>
  coins: Record<string, number>
  total: number
}

interface CashCountModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (count: CashCount, note?: string) => void
  systemBalance: number
  title?: string
}

const BILL_DENOMINATIONS = [
  { value: 100000, label: '100.000' },
  { value: 50000, label: '50.000' },
  { value: 20000, label: '20.000' },
  { value: 10000, label: '10.000' },
  { value: 5000, label: '5.000' },
  { value: 2000, label: '2.000' }
]

const COIN_DENOMINATIONS = [
  { value: 1000, label: '1.000' },
  { value: 500, label: '500' },
  { value: 100, label: '100' },
  { value: 50, label: '50' }
]

export function CashCountModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  systemBalance,
  title = "Arqueo de Caja"
}: CashCountModalProps) {
  const [billCounts, setBillCounts] = useState<Record<string, number>>({})
  const [coinCounts, setCoinCounts] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  const physicalTotal = useMemo(() => {
    const billTotal = BILL_DENOMINATIONS.reduce((sum, denom) => {
      return sum + (denom.value * (billCounts[denom.value] || 0))
    }, 0)
    
    const coinTotal = COIN_DENOMINATIONS.reduce((sum, denom) => {
      return sum + (denom.value * (coinCounts[denom.value] || 0))
    }, 0)
    
    return billTotal + coinTotal
  }, [billCounts, coinCounts])

  const discrepancy = physicalTotal - systemBalance

  const handleBillCountChange = (denomination: number, count: string) => {
    const numCount = parseInt(count) || 0
    setBillCounts(prev => ({ ...prev, [denomination]: numCount }))
  }

  const handleCoinCountChange = (denomination: number, count: string) => {
    const numCount = parseInt(count) || 0
    setCoinCounts(prev => ({ ...prev, [denomination]: numCount }))
  }

  const handleConfirm = () => {
    const cashCount: CashCount = {
      bills: billCounts,
      coins: coinCounts,
      total: physicalTotal
    }
    onConfirm(cashCount, note || undefined)
    onClose()
    // Reset form
    setBillCounts({})
    setCoinCounts({})
    setNote('')
  }

  const handleClose = () => {
    setBillCounts({})
    setCoinCounts({})
    setNote('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* System Balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Balance del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(systemBalance)}
              </div>
            </CardContent>
          </Card>

          {/* Bills Count */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Billetes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {BILL_DENOMINATIONS.map(denom => (
                  <div key={denom.value} className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {denom.label} Gs.
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={billCounts[denom.value] || ''}
                        onChange={(e) => handleBillCountChange(denom.value, e.target.value)}
                        className="w-20 h-8 text-center"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {formatCurrency((billCounts[denom.value] || 0) * denom.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coins Count */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monedas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {COIN_DENOMINATIONS.map(denom => (
                  <div key={denom.value} className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {denom.label} Gs.
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={coinCounts[denom.value] || ''}
                        onChange={(e) => handleCoinCountChange(denom.value, e.target.value)}
                        className="w-20 h-8 text-center"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {formatCurrency((coinCounts[denom.value] || 0) * denom.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen del Conteo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Total Físico:</span>
                <span className="font-bold text-lg">{formatCurrency(physicalTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Balance Sistema:</span>
                <span className="font-bold text-lg">{formatCurrency(systemBalance)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span>Diferencia:</span>
                <div className="flex items-center gap-2">
                  {Math.abs(discrepancy) < 1 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  <Badge variant={Math.abs(discrepancy) < 1 ? "default" : "destructive"}>
                    {discrepancy >= 0 ? '+' : ''}{formatCurrency(discrepancy)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="count-note">Observaciones (Opcional)</Label>
            <Input
              id="count-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Diferencia por cambio pendiente..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar Arqueo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}