
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CreditSummary } from './credit-summary'
import { CreditCard } from './credit-card'
import { PaymentHistory } from './payment-history'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, FileText, LayoutDashboard, History, CreditCard as CreditCardIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface CreditInstallment {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'pending' | 'paid' | 'late'
  amount_paid: number | null
}

export interface CreditItem {
  id: string
  principal: number
  term_months: number
  start_date: string
  created_at?: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled'
  installments: CreditInstallment[]
}

export interface CreditPayment {
  id: string
  credit_id?: string
  installment_id?: string | null
  amount: number
  payment_method: string
  created_at: string
  notes?: string
}

export function CreditsClient() {
  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState<CreditItem[]>([])
  const [payments, setPayments] = useState<CreditPayment[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 1. Obtener sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error('Session error:', sessionError)
          throw sessionError
        }
        
        if (!session?.user) {
          // Redirigir al login en lugar de lanzar error
          router.push('/login?redirect=/perfil/creditos')
          return
        }

        // 2. Buscar customer asoaciado a este perfil
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('profile_id', session.user.id)
          .single()

        if (customerError && customerError.code !== 'PGRST116') {
          console.error('Customer fetch error:', customerError)
          throw customerError
        }

        // Si no es un customer
        if (!customerData) {
          setCredits([])
          setPayments([])
          return
        }

        // 3. Buscar créditos y sus cuotas
        const { data: creditsData, error: creditsError } = await supabase
          .from('customer_credits')
          .select(`
            id,
            principal,
            term_months,
            start_date,
            created_at,
            status,
            credit_installments (
              id,
              installment_number,
              due_date,
              amount,
              status,
              amount_paid
            )
          `)
          .eq('customer_id', customerData.id)
          .in('status', ['active', 'defaulted', 'completed']) // Incluir completados para historial
          .order('created_at', { ascending: false })

        if (creditsError) {
          console.error('Credits fetch error:', creditsError)
          throw creditsError
        }

        // 4. Buscar historial de pagos a través de los créditos del cliente
        // Primero obtenemos los IDs de los créditos
        const creditIds = creditsData?.map(c => c.id) || []
        
        let paymentsData: any[] = []
        if (creditIds.length > 0) {
          const { data: paymentsRes, error: paymentsError } = await supabase
            .from('credit_payments')
            .select('id, credit_id, installment_id, amount, payment_method, created_at, notes')
            .in('credit_id', creditIds)
            .order('created_at', { ascending: false })
            
          if (paymentsError) {
            console.error('Payments fetch error:', paymentsError)
            throw paymentsError
          }
          paymentsData = paymentsRes || []
        }

        // Formatear créditos
        const formattedCredits: CreditItem[] = (creditsData || []).map(c => ({
          id: c.id,
          principal: c.principal,
          term_months: c.term_months,
          start_date: c.start_date,
          created_at: c.created_at,
          status: c.status as 'active' | 'completed' | 'defaulted' | 'cancelled',
          installments: c.credit_installments.map((i: any) => ({
             id: i.id,
             installment_number: i.installment_number,
             due_date: i.due_date,
             amount: i.amount,
             amount_paid: i.amount_paid,
             status: i.status
          }))
        }))

        setCredits(formattedCredits)
        setPayments(paymentsData as CreditPayment[])

      } catch (err: any) {
        console.error('Error fetching data details:', {
          error: err,
          type: typeof err,
          keys: typeof err === 'object' ? Object.keys(err) : [],
          stringified: JSON.stringify(err)
        })
        
        const fallback = 'Error al cargar los datos'
        const message =
          err?.message ||
          err?.error_description ||
          err?.details ||
          err?.hint ||
          (typeof err === 'string' ? err : '') ||
          fallback
        
        console.error('Error fetching data final message:', message)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64 mb-6" />
          {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" />
          <h3 className="text-lg font-bold text-foreground">Error al cargar datos</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-6">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

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
          <Link href="/">Explorar Productos</Link>
        </Button>
      </motion.div>
    )
  }

  // Cálculos para métricas globales (solo de créditos activos/en mora)
  const activeCredits = credits.filter(c => ['active', 'defaulted'].includes(c.status))
  
  let totalPrincipal = 0
  let totalPaid = 0
  let totalPending = 0
  let nextDateObj: Date | null = null
  let nextAmount: number | null = null
  let hasLateInstallments = false

  activeCredits.forEach(credit => {
    totalPrincipal += credit.principal
    credit.installments.forEach(inst => {
      if (inst.status === 'paid') {
        totalPaid += inst.amount
      } else {
        totalPending += inst.amount
        
        if (inst.status === 'late') {
          hasLateInstallments = true
        } else if (inst.status === 'pending') {
          const dueDate = new Date(inst.due_date)
          if (!nextDateObj || dueDate < nextDateObj) {
            nextDateObj = dueDate
            nextAmount = inst.amount
          }
        }
      }
    })
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <CreditSummary
        totalPrincipal={totalPrincipal}
        totalPaid={totalPaid}
        totalPending={totalPending}
        nextPaymentAmount={nextAmount}
        nextPaymentDate={nextDateObj ? nextDateObj.toISOString() : null}
        hasLateInstallments={hasLateInstallments}
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
          {credits.map((credit, idx) => (
            <CreditCard key={credit.id} credit={credit} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
