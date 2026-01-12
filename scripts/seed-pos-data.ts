
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedData() {
    console.log('--- Starting Seed ---')

    const userId = '00000000-0000-0000-0000-000000000000' // Dummy ID or fetch a real one if needed, relying on service role to bypass auth checks.
    // Actually, better to fetch a real user if possible to avoid FK errors if user_id is foreign key.
    // Let's try to get the first user from auth.users (requires service role)

    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    const realUserId = users && users.length > 0 ? users[0].id : userId
    console.log(`Using User ID: ${realUserId}`)

    // 1. Create a CLOSED session (Yesterday)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const openYesterday = new Date(yesterday)
    openYesterday.setHours(8, 0, 0)
    const closeYesterday = new Date(yesterday)
    closeYesterday.setHours(20, 0, 0)

    console.log('Creating Closed Session (Yesterday)...')
    const { data: closedSession, error: closedError } = await supabase
        .from('cash_closures')
        .insert({
            register_id: 'Principal',
            opening_balance: 500000,
            closing_balance: 1550000, // +1.050.000 sales
            expected_balance: 1550000,
            discrepancy: 0,
            type: 'z',
            date: closeYesterday.toISOString(), // Closed
            opened_by: 'system', // or realUserId if column matches
            created_at: openYesterday.toISOString() // Opened at
        })
        .select()
        .single()

    if (closedError) {
        console.error('Error creating closed session:', closedError)
    } else {
        // Add movements for closed session
        await supabase.from('cash_movements').insert([
            { session_id: closedSession.id, type: 'opening', amount: 500000, reason: 'Apertura', created_at: openYesterday.toISOString() },
            { session_id: closedSession.id, type: 'sale', amount: 100000, reason: 'Venta #1', payment_method: 'cash', created_at: new Date(openYesterday.getTime() + 3600000).toISOString() },
            { session_id: closedSession.id, type: 'sale', amount: 500000, reason: 'Venta #2', payment_method: 'card', created_at: new Date(openYesterday.getTime() + 7200000).toISOString() },
            { session_id: closedSession.id, type: 'sale', amount: 450000, reason: 'Venta #3', payment_method: 'mixed', created_at: new Date(openYesterday.getTime() + 10000000).toISOString() },
            { session_id: closedSession.id, type: 'closing', amount: 1550000, reason: 'Cierre', created_at: closeYesterday.toISOString() }
        ])
        console.log('Closed Session Created.')
    }

    // 2. Create an OPEN session (Today)
    console.log('Creating Open Session (Today)...')
    const todayOpen = new Date()
    todayOpen.setHours(9, 0, 0)

    const { data: openSession, error: openError } = await supabase
        .from('cash_closures')
        .insert({
            register_id: 'Principal',
            opening_balance: 300000,
            type: 'z',
            date: null, // OPEN
            created_at: todayOpen.toISOString()
        })
        .select()
        .single()

    if (openError) {
        console.error('Error creating open session:', openError)
    } else {
        await supabase.from('cash_movements').insert([
            { session_id: openSession.id, type: 'opening', amount: 300000, reason: 'Apertura', created_at: todayOpen.toISOString() },
            { session_id: openSession.id, type: 'sale', amount: 150000, reason: 'Venta matutina', payment_method: 'cash', created_at: new Date(todayOpen.getTime() + 1800000).toISOString() },
        ])
        console.log('Open Session Created.')
    }
}

seedData()
