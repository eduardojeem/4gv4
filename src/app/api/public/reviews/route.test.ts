import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/public/reviews/route.ts'), 'utf8')

describe('public reviews route contract', () => {
  it('publishes verification and response fields without exposing internal source identifiers', () => {
    expect(route).toContain('verification_type')
    expect(route).toContain('business_response')
    expect(route).toContain('responded_at')
    expect(route).not.toMatch(/select\([^)]*reviewer_email/)
    expect(route).not.toMatch(/select\([^)]*sale_id/)
    expect(route).not.toMatch(/select\([^)]*repair_id/)
  })

  it('scopes abuse protection to the resolved organization and IP', () => {
    expect(route).toContain('resolvePublicOrganization')
    expect(route).toContain('`${organization.id}:${clientIp}`')
  })

  it('returns a truthful moderation message', () => {
    expect(route).toContain('pendiente de revisión')
    expect(route).not.toContain('Ya está publicada')
  })

  it('supports public verification filters and a one-use invite token', () => {
    expect(route).toContain("searchParams.get('verification')")
    expect(route).toContain('invite_token')
    expect(route).toContain('submit_verified_organization_review')
  })
})
