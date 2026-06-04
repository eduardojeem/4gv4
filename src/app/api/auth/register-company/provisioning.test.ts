import { afterEach, describe, expect, it } from 'vitest'
import {
  buildCompanyRegistrationRedirectUrl,
  getProvisioningFailures,
  isExistingConfirmedAuthUser,
} from './provisioning'

const originalEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
  VERCEL_URL: process.env.VERCEL_URL,
}

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
  process.env.APP_URL = originalEnv.APP_URL
  process.env.VERCEL_URL = originalEnv.VERCEL_URL
})

describe('buildCompanyRegistrationRedirectUrl', () => {
  it('uses configured app origin instead of the untrusted Origin header', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com/base-path'
    process.env.APP_URL = ''
    process.env.VERCEL_URL = ''

    const request = new Request('https://tenant.example.com/api/auth/register-company', {
      headers: { origin: 'https://evil.example.com' },
    })

    expect(buildCompanyRegistrationRedirectUrl(request)).toBe(
      'https://app.example.com/auth/callback?next=/dashboard/onboarding'
    )
  })

  it('falls back to request URL origin when no app origin is configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    process.env.APP_URL = ''
    process.env.VERCEL_URL = ''

    const request = new Request('https://public.example.com/api/auth/register-company')

    expect(buildCompanyRegistrationRedirectUrl(request)).toBe(
      'https://public.example.com/auth/callback?next=/dashboard/onboarding'
    )
  })
})

describe('getProvisioningFailures', () => {
  it('reports rejected promises and fulfilled Supabase errors', () => {
    const failures = getProvisioningFailures([
      {
        name: 'organization_members',
        result: { status: 'fulfilled', value: { error: { message: 'duplicate member' } } },
      },
      {
        name: 'branches',
        result: { status: 'rejected', reason: new Error('branch insert failed') },
      },
      {
        name: 'subscriptions',
        result: { status: 'fulfilled', value: { error: null } },
      },
    ])

    expect(failures).toEqual([
      { name: 'organization_members', message: 'duplicate member' },
      { name: 'branches', message: 'branch insert failed' },
    ])
  })
})

describe('isExistingConfirmedAuthUser', () => {
  it('detects Supabase obfuscated users returned for existing confirmed emails', () => {
    expect(isExistingConfirmedAuthUser({ identities: [] })).toBe(true)
  })

  it('does not flag newly created users with identities', () => {
    expect(isExistingConfirmedAuthUser({ identities: [{ id: 'identity-id' }] })).toBe(false)
  })

  it('does not flag users when identities are omitted', () => {
    expect(isExistingConfirmedAuthUser({})).toBe(false)
  })
})
