import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadPlatformPolicies, type PlatformPolicyClient } from '@/lib/platform/policies'
export async function GET() {
  try {
    const policies = await loadPlatformPolicies(createAdminSupabase() as unknown as PlatformPolicyClient)
    return NextResponse.json({ companyRegistrationEnabled: policies.allowRegistration, companyPasswordMinLength: policies.passwordMinLength, expoGoCallbackSupported: process.env.NODE_ENV !== 'production' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'No pudimos cargar los requisitos de registro. Reintentá.' }, { status: 503 })
  }
}