import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

const deliveryLocationSchema = z.object({
  city: z.string().trim().min(1).max(180),
  address: z.string().trim().min(1).max(300),
  reference: z.string().trim().min(1).max(300),
  fullAddress: z.string().trim().min(1).max(700),
})

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const input = deliveryLocationSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json(
        { success: false, error: 'Datos de ubicacion invalidos', details: input.error.issues },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const currentPreferences = asRecord(profile?.preferences)
    const deliveryLocation = {
      city: input.data.city,
      address: input.data.address,
      reference: input.data.reference,
      full_address: input.data.fullAddress,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        location: input.data.fullAddress,
        preferences: {
          ...currentPreferences,
          delivery_location: deliveryLocation,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, data: { delivery_location: deliveryLocation } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la ubicacion'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
