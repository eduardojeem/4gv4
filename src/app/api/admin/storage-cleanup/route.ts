import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAuth, requireAdmin } from '@/lib/auth/require-auth'

export async function POST(request: Request) {
  try {
    // 1. Verificar autenticación y rol de admin
    const auth = await requireAdmin()
    if (!auth.authenticated) return (auth as any).response
    
    // Opcional: Verificar específicamente si es admin si requireAuth no lo hace internamente con rigor
    // (Asumimos que requireAuth maneja el estado de sesión básico)

    const { bucket, paths } = await request.json()

    if (!bucket || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'Missing bucket or paths array' },
        { status: 400 }
      )
    }

    // 2. Validar bucket autorizado para limpieza
    const AUTHORIZED_BUCKETS = ['product-images']
    if (!AUTHORIZED_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: 'This bucket is not authorized for bulk cleanup' },
        { status: 403 }
      )
    }

    // 3. Ejecutar eliminación usando el cliente ADMIN (omite RLS)
    const supabaseAdmin = createAdminSupabase()
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .remove(paths)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${paths.length} archivos eliminados correctamente`,
      deleted: data
    })

  } catch (error) {
    console.error('Error in storage cleanup API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
