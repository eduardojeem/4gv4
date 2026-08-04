import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function fixPolicy() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: `
    DROP POLICY IF EXISTS repairs_branch_scope ON public.repairs;
    CREATE POLICY repairs_branch_scope
      ON public.repairs
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING (
        (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()))
        OR 
        public.user_has_branch_access(branch_id)
      )
      WITH CHECK (
        (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()))
        OR 
        public.user_has_branch_access(branch_id)
      );
  `})
  
  if (error) {
    console.error('Failed via execute_sql:', error.message)
    // We cannot use execute_sql. We must use another way if it fails.
  } else {
    console.log('Policy updated successfully')
  }
}
fixPolicy()
