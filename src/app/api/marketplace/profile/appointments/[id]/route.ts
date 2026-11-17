import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { publicAppointmentPrice } from '@/lib/agenda/public-appointment-price'
import {
  appointmentReader,
  appointmentsResponse,
  appointmentsFailure,
  mapOwnedAppointments,
  type OwnedAppointmentRow,
} from '@/lib/agenda/owned-customer-appointments'
export const dynamic = 'force-dynamic'
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await appointmentReader()
  if (auth.response) return auth.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return appointmentsResponse({ error: 'El turno no es válido.' }, 400)
  try {
    const db = createAdminSupabase()
    const result = await db
      .from('appointments')
      .select(
        '*, customer:customers!inner(profile_id, organization_id), professional:agenda_professionals(name)',
      )
      .eq('id', id)
      .eq('customer.profile_id', auth.userId!)
      .maybeSingle()
    if (result.error) return appointmentsFailure(result.error)
    if (!result.data)
      return appointmentsResponse({ error: 'No encontramos ese turno en tu cuenta.' }, 404)
    const row = result.data as unknown as OwnedAppointmentRow
    const [item] = await mapOwnedAppointments(db, [row], auth.userId!)
    const price =
      row.price != null && Number.isFinite(Number(row.price))
        ? await publicAppointmentPrice(db, {
            id: row.id,
            organization_id: row.organization_id,
            service_product_id: row.service_product_id ?? null,
            price: Number(row.price),
          })
        : null
    const canManage =
      !row.sale_id &&
      ['pending', 'confirmed'].includes(row.status) &&
      Date.parse(row.starts_at) > Date.now() &&
      z.string().uuid().safeParse(row.public_token).success
    return appointmentsResponse({
      appointment: {
        ...item,
        price,
        managePath: canManage ? '/turno/' + row.public_token : null,
        attentionMode:
          row.attention_mode === 'home' ? 'home' : row.attention_mode === 'local' ? 'local' : null,
        address: row.attention_mode === 'home' ? (row.service_address ?? null) : null,
      },
    })
  } catch {
    return appointmentsFailure(null)
  }
}
