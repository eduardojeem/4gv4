import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const clientSource = readFileSync(resolve(process.cwd(), 'src/components/public/PublicProfileClient.tsx'), 'utf8')
const routeSource = readFileSync(resolve(process.cwd(), 'src/app/(public)/perfil/[username]/page.tsx'), 'utf8')

describe('public profile consumer', () => {
  it('uses canonical profile columns and does not request private contact data', () => {
    expect(routeSource).toContain('full_name')
    expect(routeSource).toContain('job_title')
    expect(routeSource).toContain('social_links')
    expect(routeSource).not.toMatch(/select\([^)]*email/)
    expect(routeSource).not.toMatch(/select\([^)]*phone/)
  })

  it('does not invent verification or send a display name as an email address', () => {
    expect(clientSource).toContain('data.profile.verified')
    expect(clientSource).not.toContain('isVerified: true')
    expect(clientSource).not.toContain('recipientEmail')
    expect(clientSource).not.toContain('ContactForm')
  })

  it('connects the share action to the Web Share and clipboard APIs', () => {
    expect(clientSource).toContain('onClick={handleShare}')
    expect(clientSource).toContain('navigator.share')
    expect(clientSource).toContain('navigator.clipboard.writeText')
  })
})
