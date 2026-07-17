import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRoles() {
  console.log('Querying profiles...')
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
  
  if (error) {
    console.error('Error fetching profiles:', error)
    return
  }

  console.log('Total profiles:', profiles?.length)
  console.dir(profiles, { depth: null })

  console.log('Querying organization_members...')
  const { data: members, error: mError } = await supabase
    .from('organization_members')
    .select('user_id, organization_id, role, status')
  
  if (mError) {
    console.error('Error fetching org members:', mError)
  } else {
    console.log('Organization members:', members)
  }

  console.log('Querying user_branch_assignments...')
  const { data: branches, error: bError } = await supabase
    .from('user_branch_assignments')
    .select('*')
  
  if (bError) {
    console.error('Error fetching branches:', bError)
  } else {
    console.log('Branch assignments:', branches)
  }
}

checkRoles()
