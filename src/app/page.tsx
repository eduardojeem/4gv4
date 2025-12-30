import { redirect } from 'next/navigation'

export default async function Home() {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Demo mode - redirect directly to dashboard
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    redirect('/dashboard')
  }

  // Normal mode with Supabase
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
