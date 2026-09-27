import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { findCustomerDuplicates } from '@/lib/customers/duplicate-check'

/**
 * Avisa mientras se escribe si el telefono, el correo o el RUC ya estan cargados
 * en otro cliente de la misma empresa.
 *
 * Es solo para avisar antes: quien decide es el POST/PUT de clientes, que
 * rechaza el alta con 409. Sin ese respaldo esto seria una sugerencia que se
 * saltea desactivando JavaScript, y ademas hay una ventana entre el aviso y el
 * guardado en la que otra persona puede crear el mismo cliente.
 *
 * Los permisos son los de las dos secciones que dan de alta clientes:
 * reparaciones y la seccion de clientes.
 */
export const GET = withTenantAuth(
  { permission: ['crm.customers.read', 'crm.customers.manage', 'repairs.orders.read', 'repairs.orders.create'] },
  async (request, { organization }) => {
    try {
      const { searchParams } = new URL(request.url)
      const supabase = await createClient()

      const duplicates = await findCustomerDuplicates(supabase, organization.id, {
        phone: searchParams.get('phone'),
        email: searchParams.get('email'),
        ruc: searchParams.get('ruc'),
        excludeId: searchParams.get('excludeId'),
      })

      return NextResponse.json({ success: true, duplicates })
    } catch (error) {
      logger.error('Customer duplicate check error', { error })
      // Falla abierta a proposito: esto solo adelanta el aviso. Bloquear el
      // formulario porque la comprobacion no anduvo seria peor que dejar pasar,
      // porque el guardado igual lo va a rechazar con el motivo.
      return NextResponse.json({ success: false, duplicates: [] }, { status: 200 })
    }
  }
)
