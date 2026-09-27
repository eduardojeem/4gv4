import { describe, expect, it } from 'vitest'
import { toPublicProfile } from './public-profile'

describe('public profile mapper', () => {
  it('maps the canonical dashboard columns into the public contract', () => {
    const result = toPublicProfile({
      id: 'user-1',
      username: 'ana',
      full_name: 'Ana Pérez',
      job_title: 'Técnica',
      bio: 'Reparaciones móviles',
      location: 'Asunción',
      avatar_url: 'https://cdn.example.com/ana.png',
      website: 'https://ana.example.com',
      social_links: { linkedin: 'ana-perez', github: '@ana', instagram: 'https://instagram.com/ana' },
      updated_at: '2026-09-27T12:00:00.000Z',
    })

    expect(result.profile).toEqual({
      username: 'ana',
      display_name: 'Ana Pérez',
      title: 'Técnica',
      bio: 'Reparaciones móviles',
      location: 'Asunción',
      avatar_url: 'https://cdn.example.com/ana.png',
      updated_at: '2026-09-27T12:00:00.000Z',
      verified: false,
    })
    expect(result.socialLinks.map(({ platform, url }) => ({ platform, url }))).toEqual([
      { platform: 'linkedin', url: 'https://linkedin.com/in/ana-perez' },
      { platform: 'github', url: 'https://github.com/ana' },
      { platform: 'instagram', url: 'https://instagram.com/ana' },
      { platform: 'website', url: 'https://ana.example.com/' },
    ])
  })

  it('drops unsafe links and never exposes private profile columns', () => {
    const result = toPublicProfile({
      id: 'user-2', username: 'bob', full_name: 'Bob', email: 'private@example.com',
      phone: '+595', role: 'admin', permissions: ['*'], social_links: { twitter: 'javascript:alert(1)' },
    })

    expect(result.socialLinks).toEqual([])
    expect(JSON.stringify(result)).not.toContain('private@example.com')
    expect(JSON.stringify(result)).not.toContain('+595')
    expect(result.profile.verified).toBe(false)
  })
})
