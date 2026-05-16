import { notFound } from 'next/navigation'
import SupabaseVerificationPage from '@/components/admin/system/supabase-verification-page'

export default function AdminVerifyPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <SupabaseVerificationPage />
}
