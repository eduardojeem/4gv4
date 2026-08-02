import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { linkPublicCustomerAccount } from '@/lib/customers/link-public-customer-account'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const customerLinkSchema = z.object({
  organizationSlug: z.string().trim().min(1).max(64),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const validation = customerLinkSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', validation.data.organizationSlug)
      .maybeSingle()

    if (organizationError || !organization) {
      return NextResponse.json({ success: false, error: 'Empresa no encontrada.' }, { status: 404 })
    }

    const fullName = String(
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Cliente'
    )
    const linked = await linkPublicCustomerAccount(admin, {
      organizationId: organization.id,
      profileId: user.id,
      fullName,
      email: user.email,
      phone: String(user.user_metadata?.phone || user.phone || '').trim(),
    })

    return NextResponse.json({
      success: true,
      data: {
        organization,
        role: linked.membershipRole,
        customerId: linked.customerId,
        customerMode: true,
      },
    })
  } catch (error) {
    logger.error('Public customer link API error', { error })
    return NextResponse.json(
      {
        success: false,
        code: 'customer_link_failed',
        error: 'No se pudo vincular la cuenta como cliente de esta empresa.',
        detail: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
