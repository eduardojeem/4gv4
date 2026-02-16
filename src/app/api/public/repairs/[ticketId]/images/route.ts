import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPublicToken } from '@/lib/public-session'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/repairs/[ticketId]/images
 * Get repair images (lazy loaded)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await props.params
    
    // Verify authentication
    const token = request.cookies.get('repair_token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    const session = await verifyPublicToken(token)
    if (!session || session.ticketNumber !== ticketId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }
    
    const supabase = await createClient()
    
    // Get repair ID from ticket number
    const { data: repair } = await supabase
      .from('repairs')
      .select('id')
      .eq('ticket_number', ticketId)
      .single()
    
    if (!repair) {
      return NextResponse.json(
        { success: false, error: 'Reparación no encontrada' },
        { status: 404 }
      )
    }
    
    // Fetch images
    const { data: images, error } = await supabase
      .from('repair_images')
      .select('id, image_url, description, created_at')
      .eq('repair_id', repair.id)
      .order('created_at', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch repair images', { error: error.message, ticketId })
      return NextResponse.json(
        { success: false, error: 'Error al cargar imágenes' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: images || []
    })
  } catch (error) {
    logger.error('Public repair images API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error al obtener imágenes' },
      { status: 500 }
    )
  }
}
