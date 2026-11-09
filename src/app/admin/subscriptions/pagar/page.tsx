import { ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { BancardIframe } from '@/components/admin/subscriptions/BancardIframe'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import {
  getBancardCheckoutScriptUrl,
  isValidBancardProcessId,
  isValidBancardShopProcessId,
} from '@/lib/payments/bancard'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ process_id?: string | string[]; ref?: string | string[] }> }

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

/**
 * Pago del plan con tarjeta: muestra el iframe de Bancard para el process_id
 * que creó el servidor. Solo se muestra si el pago pendiente es de la
 * organización del usuario.
 */
export default async function SubscriptionBancardCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams
  const processId = Array.isArray(params.process_id) ? params.process_id[0] : params.process_id
  const shopProcessId = Array.isArray(params.ref) ? params.ref[0] : params.ref

  if (!isValidBancardProcessId(processId) || !isValidBancardShopProcessId(shopProcessId)) {
    redirect('/admin/subscriptions#pay')
  }

  const auth = await resolveRequestAuthUser()
  if (!auth.authenticated) return redirect('/login')

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization || !['owner', 'admin'].includes(organization.role)) redirect('/forbidden')

  const { data: payment } = await createAdminSupabase()
    .from('subscription_payments')
    .select('id, amount, currency, status, plan_id')
    .eq('organization_id', organization.id)
    .eq('provider', 'bancard')
    .eq('external_reference', shopProcessId)
    .eq('provider_payment_id', processId)
    .maybeSingle()

  if (!payment) redirect('/admin/subscriptions#pay')
  if (payment.status !== 'pending') {
    redirect(`/admin/subscriptions/payments?ref=${encodeURIComponent(shopProcessId)}`)
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-5 py-4 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/subscriptions#pay"><ArrowLeft className="mr-2 h-4 w-4" />Volver a suscripciones</Link>
      </Button>

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">Pagar con tarjeta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan {payment.plan_id || 'seleccionado'} · <strong className="text-foreground">{money(Number(payment.amount), payment.currency || 'PYG')}</strong>
          </p>
        </div>
        <BancardIframe kind="checkout" processId={processId} scriptUrl={getBancardCheckoutScriptUrl()} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Los datos de tu tarjeta se cargan en el formulario seguro de Bancard y no pasan por nuestros servidores.
        </p>
      </section>
    </main>
  )
}
