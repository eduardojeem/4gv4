import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sessionId } = body

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        // Get the current user
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Call the RPC function to close the session
        const { data, error } = await supabase.rpc('close_user_session', {
            p_session_id: sessionId,
            p_user_id: user.id
        })

        if (error) {
            console.error('Error closing session:', error)
            return NextResponse.json(
                { error: 'Failed to close session' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, closed: data })
    } catch (error) {
        console.error('Error in close-session API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
