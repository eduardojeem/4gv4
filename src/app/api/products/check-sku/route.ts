import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sku = searchParams.get('sku')

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar si el SKU ya existe
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .maybeSingle()

    if (error) {
      console.error('Error checking SKU:', error)
      return NextResponse.json(
        { error: 'Error checking SKU' },
        { status: 500 }
      )
    }

    // Si data es null, el SKU es único
    return NextResponse.json({
      isUnique: data === null,
      exists: data !== null
    })
  } catch (error) {
    console.error('Error in check-sku endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
