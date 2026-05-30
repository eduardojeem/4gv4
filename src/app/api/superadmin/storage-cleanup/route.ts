import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withSuperAdminAuth } from '@/lib/api/withAdminAuth'

async function handler(request: NextRequest) {
  try {
    const { bucket, paths } = await request.json()

    if (!bucket || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'Missing bucket or paths array' },
        { status: 400 }
      )
    }

    const authorizedBuckets = ['product-images']
    if (!authorizedBuckets.includes(bucket)) {
      return NextResponse.json(
        { error: 'This bucket is not authorized for bulk cleanup' },
        { status: 403 }
      )
    }

    const supabaseAdmin = createAdminSupabase()
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove(paths)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${paths.length} archivos eliminados correctamente`,
      deleted: data,
    })
  } catch (error) {
    console.error('Error in superadmin storage cleanup API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withSuperAdminAuth(handler)
