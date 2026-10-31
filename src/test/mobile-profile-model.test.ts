import { describe, expect, it } from 'vitest'
import { avatarUploadPath, profilePatch } from '../../mobile/src/lib/profile-model'
import { dashboardProfilePatchSchema } from '../lib/profile/dashboard-profile-contract'

describe('mobile profile contract', () => {
  it('stores uploads inside the authenticated user folder', () => {
    expect(avatarUploadPath('user-a', 'image/png', 123)).toBe('user-a/avatar-123.png')
    expect(avatarUploadPath('user-b', 'image/webp', 124)).toBe('user-b/avatar-124.webp')
  })
  it('rejects a missing user and unsupported image MIME types', () => {
    expect(() => avatarUploadPath('', 'image/png', 1)).toThrow()
    expect(() => avatarUploadPath('a', 'text/html', 1)).toThrow()
  })
  it('cannot write a path outside the user folder', () => {
    expect(() => avatarUploadPath('../other', 'image/jpeg', 1)).toThrow()
  })
  it('sends only editable personal fields accepted by the server', () => {
    const patch = profilePatch({ name: '  Ana Test  ', phone: '  ', jobTitle: ' Técnica ' })
    expect(patch).toEqual({ fullName: 'Ana Test', phone: '', jobTitle: 'Técnica' })
    expect(dashboardProfilePatchSchema.safeParse(patch).success).toBe(true)
    expect(patch).not.toHaveProperty('email')
    expect(patch).not.toHaveProperty('avatarUrl')
    expect(patch).not.toHaveProperty('role')
  })
})
