import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'

async function handler(request: Request, context: { user: { id: string; email?: string; role: string } }) {
    try {
        logger.info('Starting user sync', { syncedBy: context.user.id })

        // Crear cliente de administración con Service Role
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. Obtener todos los usuarios de auth.users
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

        if (usersError) {
            throw usersError
        }

        const results = {
            total: users.length,
            updated: 0,
            errors: [] as string[]
        }

        // 2. Sincronizar cada usuario con profiles y user_roles
        for (const user of users) {
            try {
                const metadata = user.user_metadata || {}
                const role = metadata.role || 'cliente'
                const fullName = metadata.full_name || user.email?.split('@')[0] || 'Usuario'

                // Upsert profile
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        email: user.email,
                        full_name: fullName,
                        role: role,
                        status: 'active', // Asumimos activo si está en auth
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' })

                if (profileError) throw profileError

                // Upsert user_role
                const { error: roleError } = await supabaseAdmin
                    .from('user_roles')
                    .upsert({
                        user_id: user.id,
                        role: role,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })

                if (roleError) throw roleError

                results.updated++
            } catch (err: any) {
                console.error(`Error syncing user ${user.id}:`, err)
                results.errors.push(`User ${user.email}: ${err.message}`)
            }
        }

        // Registrar sincronización en audit_log
        await supabaseAdmin.from('audit_log').insert({
            user_id: context.user.id,
            action: 'user_sync',
            resource: 'users',
            resource_id: 'bulk',
            new_values: {
                total: results.total,
                updated: results.updated,
                errors: results.errors.length
            }
        }).catch(err => {
            logger.error('Failed to log user sync', { error: err })
        })

        logger.info('User sync completed', {
            syncedBy: context.user.id,
            total: results.total,
            updated: results.updated,
            errors: results.errors.length
        })

        return NextResponse.json({
            success: true,
            message: `Sincronización completada. ${results.updated}/${results.total} usuarios procesados.`,
            details: results
        })

    } catch (error: any) {
        logger.error('Sync error', { error: error.message })
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

export const POST = withAdminAuth(handler)
