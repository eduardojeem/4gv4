import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Dashboard Profile Enhanced Design and Functionality', () => {
  const pageSource = read('src/app/dashboard/profile/page.tsx')
  const formSource = read('src/components/profile/dashboard-profile-form.tsx')
  const prefsSource = read('src/components/profile/dashboard-preferences-form.tsx')

  it('page.tsx provides profile completion meter, organization context and floating quick save', () => {
    expect(pageSource).toContain('profileCompletion')
    expect(pageSource).toContain('useOptionalActiveOrganization')
    expect(pageSource).toContain('handleDiscardChanges')
    expect(pageSource).toContain('fixed bottom-')
  })

  it('page.tsx enables copying user ID, quick shortcuts, and independent sidebar scroll', () => {
    expect(pageSource).toContain('copyUserId')
    expect(pageSource).toContain('ID de usuario copiado')
    expect(pageSource).toContain('lg:overflow-y-auto')
    expect(pageSource).toContain('lg:max-h-')
  })

  it('dashboard-profile-form.tsx has improved visual hierarchy, phone hints, and bio counter', () => {
    expect(formSource).toContain('profile.bio')
    expect(formSource).toContain('caracteres')
    expect(formSource).toContain('WhatsApp')
  })

  it('dashboard-preferences-form.tsx features theme preview, accent color swatches, and auto-detect timezone', () => {
    expect(prefsSource).toContain('Detectar automáticamente')
    expect(prefsSource).toContain('Color de énfasis')
  })
})
