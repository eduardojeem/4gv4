import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyRepairHash } from '@/lib/repair-qr'

/**
 * API endpoint para verificar el hash de un QR de reparación
 * GET /api/repairs/verify-qr?ticket=R-2025-000001&hash=abc123
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ticketNumber = searchParams.get('ticket')
    const hash = searchParams.get('hash')

    if (!ticketNumber || !hash) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros: ticket y hash son requeridos' },
        { status: 400 }
      )
    }

    // Buscar la reparación en la base de datos
    const supabase = await createClient()
    const { data: repair, error } = await supabase
      .from('repairs')
      .select('id, ticket_number, customer_id, created_at, customers(name)')
      .eq('ticket_number', ticketNumber)
      .single()

    if (error || !repair) {
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado', verified: false },
        { status: 404 }
      )
    }

    // Verificar el hash:
    // 1) Formato nuevo con customer_id (estable)
    // 2) Compatibilidad con comprobantes antiguos usando customer name
    const customerId = repair.customer_id || ''
    const customerName = (repair.customers as any)?.name || ''
    const repairDate = new Date(repair.created_at)
    const isValid =
      (customerId ? verifyRepairHash(ticketNumber, customerId, repairDate, hash) : false) ||
      (customerName ? verifyRepairHash(ticketNumber, customerName, repairDate, hash) : false)

    if (!isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Hash de verificación inválido. Este QR puede ser falso.',
          verified: false 
        },
        { status: 403 }
      )
    }

    // Hash válido
    return NextResponse.json({
      success: true,
      verified: true,
      data: {
        ticketNumber: repair.ticket_number,
        repairId: repair.id,
        message: 'Comprobante verificado correctamente'
      }
    })

  } catch (error) {
    console.error('Error verifying repair QR:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', verified: false },
      { status: 500 }
    )
  }
}
