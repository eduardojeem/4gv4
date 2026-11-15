import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const newCustomerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  ruc: z.string().max(30).optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
})

/**
 * Búsqueda de clientes y obtención de su historial de turnos y preferencias.
 * Soporta consulta por customerId, por número de teléfono, por término de búsqueda (nombre/teléfono),
 * o para detección de homónimos / clientes parecidos.
 */
export const GET = withTenantAuth(
  { permission: 'pos.sales.read', module: 'services' },
  async (request, { organization }) => {
    const url = new URL(request.url)
    const customerId = url.searchParams.get('customerId')
    const rawPhone = url.searchParams.get('phone')
    const phone = rawPhone ? rawPhone.replace(/\D/g, '') : null
    const checkHomonyms = url.searchParams.get('checkHomonyms') === 'true'
    const homonymName = url.searchParams.get('name')?.trim()
    const supabase = await createClient()

    // 0. Si se solicita verificación de homónimos (evitar confusiones con "Juan, Juan...")
    if (checkHomonyms && homonymName && homonymName.length >= 2) {
      const cleanName = homonymName.slice(0, 40)
      const { data: matches } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, ruc, notes')
        .eq('organization_id', organization.id)
        .ilike('name', `%${cleanName}%`)
        .limit(6)

      return NextResponse.json({
        success: true,
        homonyms: matches ?? [],
      })
    }

    // 1. Si se consulta por un cliente específico (customerId)
    if (customerId) {
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, ruc, notes')
        .eq('id', customerId)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (custError || !customer) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
      }

      // Obtener los turnos anteriores del cliente en esta barbería
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, number, service_name, service_product_id, professional_id, price, starts_at, ends_at, status, notes, created_at')
        .eq('organization_id', organization.id)
        .or(`customer_id.eq.${customer.id}${customer.phone ? `,customer_phone.eq.${customer.phone}` : ''}`)
        .order('starts_at', { ascending: false })
        .limit(10)

      const pastAppointments = appts ?? []
      const completedList = pastAppointments.filter((a) => a.status === 'completed')
      const lastAppointment = pastAppointments[0] ?? null

      return NextResponse.json({
        success: true,
        customer,
        stats: {
          totalVisits: pastAppointments.length,
          completedVisits: completedList.length,
          lastAppointment: lastAppointment
            ? {
                id: lastAppointment.id,
                service_name: lastAppointment.service_name,
                service_product_id: lastAppointment.service_product_id,
                professional_id: lastAppointment.professional_id,
                price: Number(lastAppointment.price) || 0,
                notes: lastAppointment.notes,
                starts_at: lastAppointment.starts_at,
                status: lastAppointment.status,
              }
            : null,
          history: pastAppointments.map((a) => ({
            id: a.id,
            service_name: a.service_name,
            professional_id: a.professional_id,
            price: Number(a.price) || 0,
            starts_at: a.starts_at,
            status: a.status,
            notes: a.notes,
          })),
        },
      })
    }

    // 2. Si se consulta por número de teléfono
    if (phone && phone.length >= 6) {
      // a. Buscar en customers
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, ruc, notes')
        .eq('organization_id', organization.id)
        .or(`phone.ilike.%${phone}%,whatsapp.ilike.%${phone}%`)
        .limit(1)
        .maybeSingle()

      if (customer) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, number, service_name, service_product_id, professional_id, price, starts_at, ends_at, status, notes, created_at')
          .eq('organization_id', organization.id)
          .or(`customer_id.eq.${customer.id},customer_phone.ilike.%${phone}%`)
          .order('starts_at', { ascending: false })
          .limit(10)

        const pastAppointments = appts ?? []
        const completedList = pastAppointments.filter((a) => a.status === 'completed')
        const lastAppointment = pastAppointments[0] ?? null

        return NextResponse.json({
          success: true,
          found: true,
          matchType: 'customer',
          customer,
          stats: {
            totalVisits: pastAppointments.length,
            completedVisits: completedList.length,
            lastAppointment: lastAppointment
              ? {
                  id: lastAppointment.id,
                  service_name: lastAppointment.service_name,
                  service_product_id: lastAppointment.service_product_id,
                  professional_id: lastAppointment.professional_id,
                  price: Number(lastAppointment.price) || 0,
                  notes: lastAppointment.notes,
                  starts_at: lastAppointment.starts_at,
                  status: lastAppointment.status,
                }
              : null,
            history: pastAppointments.map((a) => ({
              id: a.id,
              service_name: a.service_name,
              professional_id: a.professional_id,
              price: Number(a.price) || 0,
              starts_at: a.starts_at,
              status: a.status,
              notes: a.notes,
            })),
          },
        })
      }

      // b. Si no está en customers, buscar en historial de turnos por teléfono
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, number, customer_name, customer_phone, service_name, service_product_id, professional_id, price, starts_at, ends_at, status, notes, created_at')
        .eq('organization_id', organization.id)
        .ilike('customer_phone', `%${phone}%`)
        .order('starts_at', { ascending: false })
        .limit(10)

      if (appts && appts.length > 0) {
        const lastAppointment = appts[0]
        const completedList = appts.filter((a) => a.status === 'completed')
        return NextResponse.json({
          success: true,
          found: true,
          matchType: 'history_only',
          suggestedCustomer: {
            name: lastAppointment.customer_name,
            phone: lastAppointment.customer_phone || rawPhone,
          },
          stats: {
            totalVisits: appts.length,
            completedVisits: completedList.length,
            lastAppointment: {
              id: lastAppointment.id,
              service_name: lastAppointment.service_name,
              service_product_id: lastAppointment.service_product_id,
              professional_id: lastAppointment.professional_id,
              price: Number(lastAppointment.price) || 0,
              notes: lastAppointment.notes,
              starts_at: lastAppointment.starts_at,
              status: lastAppointment.status,
            },
            history: appts.map((a) => ({
              id: a.id,
              service_name: a.service_name,
              professional_id: a.professional_id,
              price: Number(a.price) || 0,
              starts_at: a.starts_at,
              status: a.status,
              notes: a.notes,
            })),
          },
        })
      }

      return NextResponse.json({ success: true, found: false })
    }

    // 3. Búsqueda por término (autocomplete)
    const term = (url.searchParams.get('q') ?? '')
      .replace(/[,()%*\\:"']/g, ' ')
      .trim()
      .slice(0, 60)

    if (term.length < 2) return NextResponse.json({ results: [] })

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, whatsapp, ruc, notes')
      .eq('organization_id', organization.id)
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%,whatsapp.ilike.%${term}%,ruc.ilike.%${term}%,notes.ilike.%${term}%`)
      .order('name')
      .limit(8)

    const customerRows = (customers ?? []) as Array<{
      id: string
      name: string
      phone: string | null
      whatsapp: string | null
      ruc?: string | null
      notes?: string | null
      isFromHistory?: boolean
    }>

    // Si hay menos de 5 resultados, buscar también en turnos pasados
    if (customerRows.length < 5) {
      const { data: pastAppts } = await supabase
        .from('appointments')
        .select('customer_name, customer_phone')
        .eq('organization_id', organization.id)
        .or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`)
        .order('starts_at', { ascending: false })
        .limit(20)

      if (pastAppts) {
        const seenNames = new Set(customerRows.map((c) => c.name.toLowerCase()))
        for (const pa of pastAppts) {
          if (pa.customer_name && !seenNames.has(pa.customer_name.toLowerCase())) {
            seenNames.add(pa.customer_name.toLowerCase())
            customerRows.push({
              id: `history-${encodeURIComponent(pa.customer_name)}`,
              name: pa.customer_name,
              phone: pa.customer_phone,
              whatsapp: pa.customer_phone,
              isFromHistory: true,
            })
            if (customerRows.length >= 8) break
          }
        }
      }
    }

    return NextResponse.json({ results: customerRows })
  }
)

/**
 * Crea o registra rápidamente un cliente habitual desde el formulario de agendamiento.
 * Valida teléfono, cédula de identidad / RUC, notas distintivas y evita duplicados innecesarios.
 */
export const POST = withTenantAuth(
  { permission: 'pos.sales.read', module: 'services' },
  async (request, { organization }) => {
    const json = await request.json().catch(() => null)
    const parsed = newCustomerSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { name, phone, whatsapp, ruc, notes } = parsed.data
    const supabase = await createClient()

    // 1. Comprobar si ya existe por Cédula / RUC (identificador único por excelencia)
    if (ruc?.trim()) {
      const cleanRuc = ruc.trim()
      const { data: existingRuc } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, ruc, notes')
        .eq('organization_id', organization.id)
        .eq('ruc', cleanRuc)
        .maybeSingle()

      if (existingRuc) {
        return NextResponse.json({ success: true, customer: existingRuc, created: false, matchedBy: 'ruc' })
      }
    }

    // 2. Comprobar si ya existe por número de teléfono
    if (phone?.trim()) {
      const cleanDigits = phone.replace(/\D/g, '')
      const { data: existingPhone } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, ruc, notes')
        .eq('organization_id', organization.id)
        .or(`phone.ilike.%${cleanDigits}%,whatsapp.ilike.%${cleanDigits}%`)
        .limit(1)
        .maybeSingle()

      if (existingPhone) {
        return NextResponse.json({ success: true, customer: existingPhone, created: false, matchedBy: 'phone' })
      }
    }

    // 3. Crear el cliente habitual
    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        organization_id: organization.id,
        name: name.trim(),
        phone: phone?.trim() || null,
        whatsapp: (whatsapp?.trim() || phone?.trim()) || null,
        ruc: ruc?.trim() || null,
        notes: notes?.trim() || null,
        customer_type: 'regular',
        segment: 'habitual',
        tags: ['habitual', 'agenda'],
      })
      .select('id, name, phone, whatsapp, ruc, notes')
      .single()

    if (error || !created) {
      return NextResponse.json({ error: 'No se pudo guardar el cliente' }, { status: 500 })
    }

    return NextResponse.json({ success: true, customer: created, created: true }, { status: 201 })
  }
)
