
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import { RepairSearchForm } from './components'
import { ArrowRight, Wrench } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    recibido: { label: 'Recibido', variant: 'secondary' },
    diagnostico: { label: 'Diagnóstico', variant: 'secondary' },
    reparacion: { label: 'En reparación', variant: 'default' },
    pausado: { label: 'Pausado', variant: 'secondary' },
    listo: { label: 'Listo', variant: 'default' },
    entregado: { label: 'Entregado', variant: 'secondary' },
    cancelado: { label: 'Cancelado', variant: 'destructive' },
  }
  const cfg = map[status.toLowerCase()] ?? { label: status, variant: 'outline' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export default async function MisReparacionesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user

  let repairs: any[] = []
  let customer = null

  if (user) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    
    customer = customerData

    if (customer) {
      const { data: repairsData } = await supabase
        .from('repairs')
        .select('id, ticket_number, device_type, device_brand, device_model, problem_description, status, created_at, final_cost, estimated_cost, location')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
      
      repairs = repairsData || []
    }
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-foreground">Estado de Reparación</h1>
           <p className="text-muted-foreground mt-1 text-lg">
             Consulta el estado de tu equipo o revisa tu historial de reparaciones.
           </p>
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-1">
        {/* Public Search Section */}
        <section className="max-w-2xl mx-auto w-full">
           <Card className="border-2 border-primary/10 shadow-lg">
              <CardHeader className="bg-muted/30 pb-4">
                 <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <Wrench className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Consultar por Ticket</CardTitle>
                 </div>
                 <p className="text-sm text-muted-foreground pt-1">
                    Ingresa el número de ticket y el contacto asociado (email o teléfono) para ver el estado.
                 </p>
              </CardHeader>
              <CardContent className="pt-6">
                 <RepairSearchForm />
              </CardContent>
           </Card>
        </section>

        {/* User History Section (if logged in) */}
        {user && customer && (
           <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Mis Reparaciones Recientes</h2>
                <Badge variant="secondary">{repairs.length} equipos</Badge>
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[120px]">Ticket</TableHead>
                        <TableHead>Dispositivo</TableHead>
                        <TableHead className="hidden md:table-cell">Problema</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Costo</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Fecha</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairs.map((r) => {
                        const device = [r.device_brand, r.device_model].filter(Boolean).join(' ')
                        const created = r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : '-'
                        const cost = r.final_cost ? formatCurrency(r.final_cost) : (r.estimated_cost ? formatCurrency(r.estimated_cost) : '-')
                        
                        return (
                          <TableRow key={r.id} className="group">
                            <TableCell className="font-mono font-medium">{r.ticket_number || r.id.slice(0, 8)}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{device || 'Dispositivo'}</span>
                                    <span className="text-xs text-muted-foreground md:hidden">{r.problem_description}</span>
                                </div>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate hidden md:table-cell" title={r.problem_description || ''}>{r.problem_description || '-'}</TableCell>
                            <TableCell><StatusBadge status={String(r.status || '')} /></TableCell>
                            <TableCell className="text-right hidden sm:table-cell">{cost}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell text-muted-foreground">{created}</TableCell>
                            <TableCell>
                                <Link href={`/mis-reparaciones/${r.ticket_number || r.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {repairs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                            No tienes reparaciones registradas aún.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
           </section>
        )}

        {/* Not logged in CTA */}
        {!user && (
           <div className="text-center py-8 bg-muted/30 rounded-2xl border border-dashed">
              <p className="text-muted-foreground">
                 Tienes una cuenta con nosotros?{' '}
                 <Link href="/login?next=/mis-reparaciones" className="font-medium text-primary hover:underline underline-offset-4">
                    Inicia sesión
                 </Link>
                 {' '}para ver tu historial completo de reparaciones.
              </p>
           </div>
        )}
      </div>
    </div>
  )
}
