import Link from 'next/link'
import { CalendarClock, CreditCard, FileText, RefreshCw, Search } from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type SubscriptionRow = {
  id: string
  organization_id: string
  plan: string | null
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  organizations:
    | { name: string; slug: string }
    | Array<{ name: string; slug: string }>
    | null
}

export default async function SuperAdminBillingPage() {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('subscriptions')
    .select('id, organization_id, plan, status, trial_ends_at, current_period_end, organizations(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  const subscriptions = error ? [] : (data ?? []) as SubscriptionRow[]
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active').length

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Superadmin</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Facturacion</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Centro financiero preparado para Stripe, Pagopar y Bancard con suscripciones, facturas y renovaciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button asChild className="gap-2">
            <Link href="/superadmin/invoices">
              <FileText className="h-4 w-4" />
              Ver facturas
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <div className="mt-3 text-3xl font-semibold">{subscriptions.length}</div>
            <div className="mt-1 text-sm text-slate-500">Suscripciones listadas</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Activas</div>
            <div className="mt-3 text-3xl font-semibold">{activeSubscriptions}</div>
            <div className="mt-1 text-sm text-slate-500">Con cobro vigente</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <CalendarClock className="h-5 w-5 text-violet-600" />
            <div className="mt-3 text-3xl font-semibold">Trials</div>
            <div className="mt-1 text-sm text-slate-500">Seguimiento de prueba</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pasarelas</div>
            <div className="mt-3 text-3xl font-semibold">3</div>
            <div className="mt-1 text-sm text-slate-500">Stripe, Pagopar, Bancard</div>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden rounded-3xl border-slate-200/80 dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
          <CardTitle>Suscripciones</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {error ? 'La tabla subscriptions aun no esta disponible o no coincide con el esquema esperado.' : 'Suscripciones recientes por tenant.'}
              </p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar empresa o plan" className="h-11 rounded-xl pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Periodo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => {
                  const organization = Array.isArray(subscription.organizations)
                    ? subscription.organizations[0]
                    : subscription.organizations

                  return (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="font-medium">{organization?.name ?? subscription.organization_id}</div>
                        {organization?.slug && <div className="text-xs text-muted-foreground">{organization.slug}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{subscription.plan ?? 'FREE'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.status ?? 'unknown'}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(subscription.trial_ends_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(subscription.current_period_end)}</TableCell>
                    </TableRow>
                  )
                })}
                {subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay suscripciones para mostrar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}
