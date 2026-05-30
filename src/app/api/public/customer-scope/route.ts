import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get('slug')?.trim()

  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (organizationError || !organization) {
    return NextResponse.json({ success: false, error: 'Empresa no encontrada.' }, { status: 404 })
  }

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    return NextResponse.json(
      { success: false, error: 'No se pudo validar la cuenta de cliente.' },
      { status: 500 }
    )
  }

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .select('id')
    .eq('organization_id', organization.id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (customerError) {
    return NextResponse.json(
      { success: false, error: 'No se pudo validar el perfil de cliente.' },
      { status: 500 }
    )
  }

  if (membership && membership.role !== 'customer') {
    if (membership.status === 'active' && customer) {
      return NextResponse.json({
        success: true,
        data: {
          organization,
          role: membership.role,
          customerMode: true,
        },
      })
    }

    return NextResponse.json(
      {
        success: false,
        code: 'staff_member',
        canLink: true,
        error: 'Esta cuenta pertenece al equipo de esta empresa. Tambien puede continuar como cliente sin perder su rol interno.',
      }
    )
  }

  if (!membership || membership.status !== 'active' || !customer) {
    return NextResponse.json(
      {
        success: false,
        code: !customer && membership?.role === 'customer' ? 'customer_profile_missing' : 'not_customer',
        canLink: true,
        error: !customer && membership?.role === 'customer'
          ? 'Tu acceso de cliente existe, pero falta vincular el perfil de cliente de esta empresa.'
          : 'Esta cuenta no esta registrada como cliente de esta empresa.',
      }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      organization,
      role: membership.role,
    },
  })
}
