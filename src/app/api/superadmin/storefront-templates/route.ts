import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { loadPlanTemplateCatalog } from '@/lib/website/template-plan-access.server'
import { sanitizeTemplateList } from '@/lib/website/template-plan-access'

/** GET — Planes con sus plantillas de tienda. */
export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ plans: await loadPlanTemplateCatalog() })
  } catch (error) {
    console.error('[superadmin/storefront-templates] GET', error)
    return NextResponse.json({ error: 'No se pudieron leer los planes.' }, { status: 500 })
  }
}

const bodySchema = z.object({
  planCode: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
  templates: z.array(z.string().max(40)).max(40),
}).strict()

/** PUT — Guarda las plantillas de un plan. */
export async function PUT(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })

  const templates = sanitizeTemplateList(parsed.data.templates)
  if (templates.length === 0) {
    return NextResponse.json({ error: 'El plan necesita al menos una plantilla.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: previous } = await admin
    .from('storefront_template_plan_access')
    .select('templates')
    .eq('plan_code', parsed.data.planCode)
    .maybeSingle()

  const { error } = await admin.from('storefront_template_plan_access').upsert({
    plan_code: parsed.data.planCode,
    templates,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  })
  if (error) {
    console.error('[superadmin/storefront-templates] PUT', error)
    return NextResponse.json({ error: 'No se pudo guardar. ¿Se aplicó la migración de plantillas por plan?' }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'update',
    resource: 'storefront_template_plan_access',
    resourceId: parsed.data.planCode,
    oldValues: previous ? { templates: previous.templates } : null,
    newValues: { templates },
    request,
    severity: 'medium',
  })

  return NextResponse.json({ plans: await loadPlanTemplateCatalog() })
}
