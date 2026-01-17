'use client'

import React, { useEffect } from 'react'
import { useCreditSystem } from '@/hooks/use-credit-system'
import { usePOSCustomer } from '../contexts/POSCustomerContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * Componente de debug para verificar la sincronización de crédito
 * Mostrar en POS para ver qué datos se están cargando
 */
export function CreditDebug() {
  const { activeCustomer } = usePOSCustomer()
  const { 
    loading, 
    error, 
    credits, 
    installments, 
    payments,
    getCreditSummary,
    loadCreditData 
  } = useCreditSystem()

  useEffect(() => {
    if (activeCustomer?.id) {
      console.log('🔍 CreditDebug: Loading data for customer', activeCustomer.id)
      loadCreditData(activeCustomer.id)
    }
  }, [activeCustomer?.id, loadCreditData])

  if (!activeCustomer) {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle className="text-sm">🐛 Credit Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay cliente seleccionado</p>
        </CardContent>
      </Card>
    )
  }

  const summary = getCreditSummary(activeCustomer)

  return (
    <Card className="border-blue-500">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          🐛 Credit Debug
          {loading && <Badge variant="secondary">Cargando...</Badge>}
          {error && <Badge variant="destructive">Error</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs space-y-1">
          <div className="font-semibold">Cliente: {activeCustomer.name}</div>
          <div>ID: {activeCustomer.id}</div>
          <div>Credit Limit: {activeCustomer.credit_limit || 0}</div>
          <div>Current Balance (campo): {activeCustomer.current_balance || 0}</div>
        </div>

        <div className="border-t pt-2 text-xs space-y-1">
          <div className="font-semibold">Datos de Supabase:</div>
          <div>Créditos: {credits.length}</div>
          <div>Cuotas: {installments.length}</div>
          <div>Pagos: {payments.length}</div>
        </div>

        {credits.length > 0 && (
          <div className="border-t pt-2 text-xs space-y-1">
            <div className="font-semibold">Créditos:</div>
            {credits.map(c => (
              <div key={c.id} className="pl-2">
                • {c.status}: ${c.principal.toLocaleString()}
              </div>
            ))}
          </div>
        )}

        {installments.length > 0 && (
          <div className="border-t pt-2 text-xs space-y-1">
            <div className="font-semibold">Cuotas:</div>
            {installments.slice(0, 3).map(i => (
              <div key={i.id} className="pl-2">
                • {i.status}: ${i.amount.toLocaleString()} - {i.due_date}
              </div>
            ))}
            {installments.length > 3 && (
              <div className="pl-2 text-muted-foreground">
                ... y {installments.length - 3} más
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-2 text-xs space-y-1">
          <div className="font-semibold">Resumen Calculado:</div>
          <div>Total Credit: ${summary.totalCredit.toLocaleString()}</div>
          <div>Used Credit: ${summary.usedCredit.toLocaleString()}</div>
          <div>Available: ${summary.availableCredit.toLocaleString()}</div>
          <div>Utilization: {summary.creditUtilization.toFixed(1)}%</div>
        </div>

        {error && (
          <div className="border-t pt-2 text-xs text-red-600">
            <div className="font-semibold">Error:</div>
            <div>{error}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
