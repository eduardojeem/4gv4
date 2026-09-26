
'use client'

import { CreditSummary } from './credit-summary'
import { CreditCard } from './credit-card'
import { PaymentHistory } from './payment-history'
import { FileText, LayoutDashboard, History, CreditCard as CreditCardIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { calculateCustomerCreditOverview, type CustomerCreditInstallment, type CustomerCreditItem } from '@/lib/credits/customer-portal'

export type CreditInstallment = CustomerCreditInstallment
export type CreditItem = CustomerCreditItem

export interface CreditPayment {
  id: string
  credit_id?: string
  installment_id?: string | null
  amount: number
  payment_method: string
  created_at: string
  notes?: string
}

export function CreditsClient({ credits, payments, productsHref }: { credits: CreditItem[]; payments: CreditPayment[]; productsHref: string }) {

  if (credits.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20 px-4 bg-muted/30 rounded-3xl border border-dashed border-border"
      >
        <div className="mx-auto w-16 h-16 bg-card rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-border">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Sin créditos activos</h3>
        <p className="text-muted-foreground max-w-xs mx-auto mb-6">
          No tienes créditos registrados en tu cuenta actualmente.
        </p>
        <Button asChild variant="default" className="shadow-sm">
          <Link href={productsHref}>Explorar productos</Link>
        </Button>
      </motion.div>
    )
  }

  // Cálculos para métricas globales (solo de créditos activos/en mora)
  const overview = calculateCustomerCreditOverview(credits)
  const activeCredits = overview.activeCredits

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <CreditSummary
        totalPrincipal={overview.totalFinanced}
        totalPaid={overview.totalPaid}
        totalPending={overview.totalPending}
        overdueAmount={overview.overdueAmount}
        nextPaymentAmount={overview.nextPaymentAmount}
        nextPaymentDate={overview.nextPaymentDate ? overview.nextPaymentDate.toISOString() : null}
        hasLateInstallments={overview.hasLateInstallments}
      />

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="active" className="flex gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Créditos Activos
          </TabsTrigger>
          <TabsTrigger value="history" className="flex gap-2">
            <History className="h-4 w-4" />
            Historial de Pagos
          </TabsTrigger>
          <TabsTrigger value="all" className="flex gap-2">
            <CreditCardIcon className="h-4 w-4" />
            Todos los Créditos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {activeCredits.length > 0 ? (
            activeCredits.map((credit, idx) => (
              <motion.div
                key={credit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <CreditCard credit={credit} />
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
              No tienes créditos activos en este momento.
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <PaymentHistory payments={payments} />
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          {credits.map((credit) => (
            <CreditCard key={credit.id} credit={credit} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
