
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function debugData() {
    console.log('--- Fetching Cash Closures (Latest 5) ---')
    const { data: closures, error: closuresError } = await supabase
        .from('cash_closures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    if (closuresError) {
        console.error('Error fetching closures:', closuresError)
    } else {
        console.table(closures)
    }

    console.log('\n--- Fetching Cash Movements (Latest 10) ---')
    const { data: movements, error: movementsError } = await supabase
        .from('cash_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

    if (movementsError) {
        console.error('Error fetching movements:', movementsError)
    } else {
        console.table(movements)
    }
}

debugData()
