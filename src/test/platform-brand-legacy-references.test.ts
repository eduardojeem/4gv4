import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const LEGACY_BRAND = new RegExp(['servix', '360'].join('[\\s-]*'), 'i')

const VISIBLE_BRAND_FILES = [
  'README.md',
  'SETUP.md',
  'src/app/api/superadmin/emails/test/route.ts',
  'src/app/api/communications/campaigns/[id]/send/route.ts',
  'src/components/superadmin/PlatformBrandingForm.tsx',
  'supabase/email-templates/README.md',
  'supabase/email-templates/confirm-signup.html',
  'supabase/email-templates/email-change.html',
  'supabase/email-templates/invite.html',
  'supabase/email-templates/magic-link.html',
  'supabase/email-templates/recovery.html',
]

describe('identidad pública de la plataforma', () => {
  it.each(VISIBLE_BRAND_FILES)('%s no conserva la marca anterior', (relativePath) => {
    const content = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    expect(content).not.toMatch(LEGACY_BRAND)
  })
})
