'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomerErrorBoundary } from '@/components/dashboard/customers/CustomerErrorBoundary'
import { mapRawToCustomer, type Customer } from '@/hooks/use-customer-state'
import { toast } from 'sonner'

const CustomerDetail = dynamic(
  () => import('@/components/dashboard/customers/CustomerDetail').then((module) => module.CustomerDetail),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-2xl bg-muted/40" /> }
)
const CustomerHistory = dynamic(() => import('@/components/dashboard/customers/CustomerHistory').then((module) => module.CustomerHistory), { ssr: false })
const CustomerEditFormV2 = dynamic(() => import('@/components/dashboard/customers/CustomerEditFormV2').then((module) => module.CustomerEditFormV2), { ssr: false })

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'detail' | 'history' | 'edit'>(() => {
    const tab = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('tab')
    return tab === 'history' ? 'history' : 'detail'
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`/api/customers?id=${encodeURIComponent(params.id)}&limit=1`)
        const result = await response.json()
        if (!response.ok || !result.success || !result.data?.[0]) throw new Error(result.error || 'No se encontró el cliente.')
        if (!cancelled) setCustomer(mapRawToCustomer(result.data[0]))
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el cliente.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [params.id])

  const goBack = useCallback(() => {
    const from = new URLSearchParams(window.location.search).get('from') || ''
    router.push(`/dashboard/customers${from.startsWith('?') ? from : ''}`)
  }, [router])

  if (error) return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center"><p className="text-sm text-muted-foreground">{error}</p><Button onClick={goBack} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Volver a clientes</Button></div>
  if (!customer) return <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cargando ficha del cliente…</div>

  return <CustomerErrorBoundary>
    {view === 'detail' && <CustomerDetail customer={customer} onBack={goBack} onEdit={() => setView('edit')} onViewHistory={() => setView('history')} />}
    {view === 'history' && <CustomerHistory customer={customer} onBack={() => setView('detail')} onViewDetail={() => setView('detail')} />}
    {view === 'edit' && <CustomerEditFormV2
      customer={customer}
      onCancel={() => setView('detail')}
      onSave={async (values) => {
        const response = await fetch('/api/customers', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, id: customer.id }),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.success) {
          toast.error(result?.error || 'No se pudo actualizar el cliente.')
          return
        }
        setCustomer(mapRawToCustomer(result.data))
        setView('detail')
        toast.success('Cliente actualizado')
      }}
    />}
  </CustomerErrorBoundary>
}
