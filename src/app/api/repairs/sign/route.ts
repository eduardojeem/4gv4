import { NextRequest, NextResponse } from 'next/server'
import { generateRepairHash } from '@/lib/repair-qr'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/repairs/sign
 * Generates a secure hash for a repair ticket to be used in QR codes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ticketNumber, customerName, date } = body

    if (!ticketNumber || !customerName || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Ensure date is treated correctly (assuming string comes in ISO format or similar)
    const dateObj = new Date(date)
    
    // Generate the hash using the server-side secret
    const hash = generateRepairHash(ticketNumber, customerName, dateObj)

    return NextResponse.json({
      success: true,
      hash
    })
  } catch (error) {
    console.error('Error signing repair ticket:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
