import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPublicToken } from '@/lib/public-session'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/repairs/[ticketId]/notes
 * Get repair notes (lazy loaded, filtered for public view)
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
    
    // Fetch notes (filter out internal notes if needed)
    const { data: notes, error } = await supabase
      .from('repair_notes')
      .select('id, note_text, author_name, created_at, is_internal')
      .eq('repair_id', repair.id)
      .eq('is_internal', false) // Only show public notes
      .order('created_at', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch repair notes', { error: error.message, ticketId })
      return NextResponse.json(
        { success: false, error: 'Error al cargar notas' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: (notes || []).map(note => ({
        id: note.id,
        text: note.note_text,
        author: note.author_name,
        timestamp: note.created_at
      }))
    })
  } catch (error) {
    logger.error('Public repair notes API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error al obtener notas' },
      { status: 500 }
    )
  }
}
