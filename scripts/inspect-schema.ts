
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inspectSchema() {
    console.log('Inspecting cash_movements schema...')

    // Get Columns
    const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'cash_movements')
        .eq('table_schema', 'public')

    if (colError) {
        // Direct query to info schema might fail due to permissions with simple client
        // forcing RPC or assuming service role acts as admin
        console.error('Error fetching columns:', colError)
    } else {
        console.table(columns)
    }

    // To check foreign keys, we need a more complex query or just try to insert and see the error?
    // Let's just try to insert a dummy record with a fake session_id and see the specific error message? 
    // No, that's what the app is doing.
    // Let's try to SELECT * FROM cash_movements LIMIT 1 and print it to see structure.

    const { data: rows, error: rowError } = await supabase
        .from('cash_movements')
        .select('*')
        .limit(1)

    if (rowError) {
        console.error('Error fetching rows:', rowError)
    } else if (rows && rows.length > 0) {
        console.log('Sample row:', rows[0])
    } else {
        console.log('No rows found in cash_movements.')
    }

    // Also check cash_closures to make sure it exists
    const { data: closures, error: clError } = await supabase
        .from('cash_closures')
        .select('*')
        .limit(1)

    if (clError) console.error('Error fetching closures:', clError)
    else console.log('Cash Closures exist. Sample:', closures?.[0])

}

inspectSchema()
