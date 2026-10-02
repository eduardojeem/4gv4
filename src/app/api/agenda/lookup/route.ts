import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Clientes de la empresa, para cargar un turno. */
export const GET = withTenantAuth({ permission: 'pos.sales.read', module: 'services' }, async (request, { organization }) => {
  // Se interpola en un filtro `or` de PostgREST.
  const term = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()%*\\:"']/g, ' ').trim().slice(0, 60)
  if (term.length < 2) return NextResponse.json({ results: [] })
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, whatsapp')
    .eq('organization_id', organization.id)
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%,whatsapp.ilike.%${term}%`)
    .order('name')
    .limit(8)
  return NextResponse.json({ results: data ?? [] })
})
