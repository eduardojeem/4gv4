
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { customerIds } = await request.json()

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ credits: [], installments: [] })
    }

    const supabase = createAdminSupabase()

    // 1. Fetch credits
    const { data: credits, error: creditsError } = await supabase
      .from('customer_credits')
      .select('*')
      .in('customer_id', customerIds)

    if (creditsError) {
      console.error('Error fetching credits:', creditsError)
      throw creditsError
    }

    const creditIds = credits?.map(c => c.id) || []

    // 2. Fetch installments
    let installments: any[] = []
    let payments: any[] = []
    if (creditIds.length > 0) {
      const { data: installmentsData, error: installmentsError } = await supabase
        .from('credit_installments')
        .select('*')
        .in('credit_id', creditIds)
      
      if (installmentsError) {
        console.error('Error fetching installments:', installmentsError)
        throw installmentsError
      }
      installments = installmentsData || []

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('credit_payments')
        .select('*')
        .in('credit_id', creditIds)
      
      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError)
        throw paymentsError
      }
      payments = paymentsData || []
    }

    return NextResponse.json({ credits: credits || [], installments, payments })
  } catch (error: any) {
    console.error('Error in credits API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
