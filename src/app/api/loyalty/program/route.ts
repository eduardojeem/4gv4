import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'

export const GET = withTenantAuth(
  { permission: 'promotions.read', module: 'promotions' },
  async (request, { organization }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('q') ?? ''
    const offset = Number(url.searchParams.get('offset') ?? 0)
    if (search.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) {
      return NextResponse.json({ error: 'La búsqueda o la página no son válidas' }, { status: 400 })
    }
    const supabase = await createOrgScopedClient(organization.id)
    const { data, error } = await supabase.rpc('loyalty_program_customers', {
      p_organization_id: organization.id,
      p_search: search,
      p_offset: offset,
    })
    if (error) {
      const missing = ['PGRST202', '42883'].includes(error.code)
      return NextResponse.json(
        {
          error: missing
            ? 'El progreso por turnos estará disponible al habilitar la migración de fidelización.'
            : 'No se pudo cargar el progreso de los clientes. Intentá de nuevo.',
          code: missing ? 'SERVICE_VISITS_NOT_READY' : 'PROGRAM_LOAD_FAILED',
        },
        { status: missing ? 503 : 500 }
      )
    }
    return NextResponse.json(data)
  }
)
