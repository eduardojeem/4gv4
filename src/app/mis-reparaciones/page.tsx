import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'

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
  const cfg = map[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export default async function MisReparacionesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) redirect('/login?next=/mis-reparaciones')

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!customer) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No encontramos tu registro de cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Aún no tenemos un cliente asociado a tu cuenta. Puedes crear tu perfil al realizar una reparación o contactarnos.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: repairs } = await supabase
    .from('repairs')
    .select('id, ticket_number, device_type, device_brand, device_model, problem_description, status, created_at, final_cost, estimated_cost, location')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis reparaciones</h1>
        <p className="text-muted-foreground">Listado de tus equipos en reparación y su estado actual.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{Array.isArray(repairs) ? `${repairs.length} registro${repairs.length === 1 ? '' : 's'}` : '0 registros'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Ticket</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Costo Estimado</TableHead>
                <TableHead className="text-right">Costo Final</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(repairs || []).map((r: any) => {
                const device = [r.device_brand, r.device_model].filter(Boolean).join(' ')
                const created = r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : '-'
                const estimated = r.estimated_cost ? formatCurrency(r.estimated_cost) : '-'
                const final = r.final_cost ? formatCurrency(r.final_cost) : '-'
                
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-medium">{r.ticket_number || r.id.slice(0, 8)}</TableCell>
                    <TableCell>{device || 'Dispositivo'}</TableCell>
                    <TableCell className="max-w-[250px] truncate" title={r.problem_description || ''}>{r.problem_description || '-'}</TableCell>
                    <TableCell><StatusBadge status={String(r.status || '').toLowerCase()} /></TableCell>
                    <TableCell className="text-right text-muted-foreground">{estimated}</TableCell>
                    <TableCell className="text-right font-medium">{final}</TableCell>
                    <TableCell className="text-right">{created}</TableCell>
                  </TableRow>
                )
              })}
              {(!repairs || repairs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No tienes reparaciones registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

