import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock3, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { isValidPagoparOrderHash, type PagoparOrderDisplayStatus } from '@/lib/payments/pagopar'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { verifySubscriptionPagoparPayment } from '@/lib/saas/pagopar-subscription-status'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ hash?: string | string[] }> }

const STATUS_CONTENT: Record<PagoparOrderDisplayStatus, {
  title: string
  description: string
  badge: string
  icon: typeof CheckCircle2
  tone: string
}> = {
  approved: {
    title: 'Pago aprobado',
    description: 'Pagopar confirmó el cobro. La suscripción se activa únicamente cuando el webhook seguro procesa la notificación.',
    badge: 'Aprobado',
    icon: CheckCircle2,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
  },
  pending: {
    title: 'Pago pendiente',
    description: 'El pedido existe, pero Pagopar todavía espera que se complete el pago.',
    badge: 'Pendiente',
    icon: Clock3,
    tone: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
  },
  rejected: {
    title: 'Pago rechazado',
    description: 'Pagopar informó que el pago no pudo completarse. Podés volver y generar un nuevo intento.',
    badge: 'Rechazado',
    icon: XCircle,
    tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100',
  },
  cancelled: {
    title: 'Pago cancelado',
    description: 'El pedido fue cancelado y no produjo cambios en tu suscripción.',
    badge: 'Cancelado',
    icon: Ban,
    tone: 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  },
  processing: {
    title: 'Pago en proceso',
    description: 'Pagopar reconoce el pedido y continúa procesándolo. Revisá nuevamente en unos instantes.',
    badge: 'Procesando',
    icon: LoaderCircle,
    tone: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100',
  },
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function VerificationError({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm opacity-80">{description}</p>
        </div>
      </div>
    </section>
  )
}

export default async function SubscriptionPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const hash = Array.isArray(params.hash) ? params.hash[0] : params.hash

  if (!hash) redirect('/admin/subscriptions#payment-history')

  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) redirect('/login')

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization || !['owner', 'admin'].includes(organization.role)) redirect('/forbidden')

  const verification = isValidPagoparOrderHash(hash)
    ? await verifySubscriptionPagoparPayment(organization.id, hash)
    : null

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 py-4 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/subscriptions#payment-history"><ArrowLeft className="mr-2 h-4 w-4" />Volver a suscripciones</Link>
        </Button>
        <Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Verificación segura</Badge>
      </div>

      {!verification && <VerificationError title="Enlace de pago inválido" description="El identificador recibido no tiene el formato esperado. Volvé al historial y verificá el estado desde allí." />}
      {verification?.kind === 'not_found' && <VerificationError title="Pago no encontrado" description="No encontramos un pago Pagopar de esta organización asociado con el identificador recibido." />}
      {verification?.kind === 'mismatch' && <VerificationError title="No se pudo validar el pago" description="La información devuelta por Pagopar no coincide con el pago registrado. No se realizó ningún cambio en la suscripción." />}
      {verification?.kind === 'unavailable' && <VerificationError title="No se pudo verificar el pago" description="Pagopar no respondió correctamente o la consulta tardó demasiado. Tu pago no fue modificado; intentá nuevamente en unos instantes." />}

      {verification?.kind === 'verified' && (() => {
        const { localPayment, providerOrder } = verification
        const content = STATUS_CONTENT[providerOrder.status]
        const StatusIcon = content.icon
        const subscriptionApplied = localPayment.status === 'paid'

        return (
          <section className={`rounded-xl border p-5 sm:p-6 ${content.tone}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/80">
                <StatusIcon className={`h-6 w-6 ${providerOrder.status === 'processing' ? 'animate-spin' : ''}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">{content.title}</h1>
                  <Badge variant="secondary">{content.badge}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 opacity-80">{content.description}</p>

                <dl className="mt-5 grid gap-3 border-t border-current/15 pt-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs opacity-65">Monto verificado</dt><dd className="mt-0.5 font-semibold">{money(providerOrder.amount, localPayment.currency)}</dd></div>
                  <div><dt className="text-xs opacity-65">Plan solicitado</dt><dd className="mt-0.5 font-semibold">{localPayment.plan_id || 'Suscripción'}</dd></div>
                  <div><dt className="text-xs opacity-65">Método</dt><dd className="mt-0.5 font-semibold">{providerOrder.paymentMethod || 'Pagopar'}</dd></div>
                  <div><dt className="text-xs opacity-65">Referencia</dt><dd className="mt-0.5 font-mono font-semibold">…{hash.slice(-10)}</dd></div>
                </dl>

                {providerOrder.status === 'approved' && (
                  <p className="mt-4 rounded-lg border border-current/15 bg-background/55 px-3 py-2 text-xs font-medium">
                    {subscriptionApplied ? 'El webhook ya confirmó y aplicó este pago.' : 'Pagopar aprobó el pago. La activación aparecerá cuando llegue la notificación segura del webhook.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        )
      })()}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline"><Link href="/admin/subscriptions#payment-history">Ver historial de pagos</Link></Button>
        <Button asChild><Link href={`/admin/subscriptions/payments?hash=${encodeURIComponent(hash)}`}>Verificar nuevamente</Link></Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Esta pantalla solamente consulta y muestra el estado. No activa planes desde el navegador.</p>
    </main>
  )
}
