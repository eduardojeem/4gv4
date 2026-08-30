import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import type { OrganizationRole } from '@/lib/saas/permissions'

export type ActiveOrganizationPayload = {
  id: string
  name: string
  slug: string
  role: OrganizationRole
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const organization = await getCurrentOrganizationContext(user.id)
  if (!organization) {
    return NextResponse.json(
      { error: 'Organización activa no disponible' },
      { status: 403 },
    )
  }

  return NextResponse.json({
    activeOrganization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organization.role,
    } satisfies ActiveOrganizationPayload,
  })
}
