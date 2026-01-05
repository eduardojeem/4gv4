import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setupStorageBuckets } from '../../../../../scripts/setup-storage-buckets'

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario sea super admin
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar rol de super admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
    }

    // Configurar buckets de storage
    await setupStorageBuckets()

    return NextResponse.json({ 
      success: true, 
      message: 'Storage configurado correctamente' 
    })

  } catch (error) {
    console.error('Error configurando storage:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}