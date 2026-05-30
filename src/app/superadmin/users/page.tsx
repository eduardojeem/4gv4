import Link from 'next/link'
import { Download, RefreshCw, Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type MemberRow = {
  id: string
  user_id: string
  role: string
  status: string | null
  created_at: string | null
  organizations:
    | { name: string; slug: string }
    | Array<{ name: string; slug: string }>
    | null
}

export default async function SuperAdminUsersPage() {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('organization_members')
    .select('id, user_id, role, status, created_at, organizations(name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  const members = (data ?? []) as MemberRow[]
  const activeMembers = members.filter((member) => member.status === 'active').length
  const roles = new Set(members.map((member) => member.role)).size

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Superadmin</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Usuarios SaaS</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Miembros por empresa, rol tenant, estado de acceso y fecha de alta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button asChild className="gap-2">
            <Link href="/superadmin/users/super-admins">
              <ShieldCheck className="h-4 w-4" />
              Super admins
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <Users className="h-5 w-5 text-blue-600" />
            <div className="mt-3 text-3xl font-semibold">{members.length}</div>
            <div className="mt-1 text-sm text-slate-500">Miembros listados</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <div className="mt-3 text-3xl font-semibold">{activeMembers}</div>
            <div className="mt-1 text-sm text-slate-500">Activos</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <ShieldCheck className="h-5 w-5 text-violet-600" />
            <div className="mt-3 text-3xl font-semibold">{roles}</div>
            <div className="mt-1 text-sm text-slate-500">Roles detectados</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Invitaciones</div>
            <div className="mt-3 text-3xl font-semibold">Listo</div>
            <div className="mt-1 text-sm text-slate-500">Flujo SaaS preparado</div>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden rounded-3xl border-slate-200/80 dark:border-slate-800">
        <CardHeader className="space-y-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
          <CardTitle>Miembros recientes</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Primeros 100 memberships activos o historicos.</p>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar usuario o empresa" className="h-11 rounded-xl pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const organization = Array.isArray(member.organizations)
                    ? member.organizations[0]
                    : member.organizations

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="text-muted-foreground">{member.user_id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{organization?.name ?? 'Sin empresa'}</div>
                        {organization?.slug && <div className="text-xs text-muted-foreground">{organization.slug}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'active' ? 'outline' : 'secondary'}>
                          {member.status ?? 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.created_at
                          ? new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(member.created_at))
                          : 'Sin fecha'}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay miembros registrados.
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
