import { expect, test } from 'playwright/test'

const authenticatedState = process.env.DASHBOARD_PROFILE_STORAGE_STATE
const baseUrl = process.env.DASHBOARD_PROFILE_BASE_URL ?? 'http://localhost:3000'

const profile = {
  id: 'e2e-user',
  fullName: 'Perfil E2E',
  email: 'profile-e2e@example.com',
  emailVerified: true,
  avatarUrl: '',
  phone: '',
  department: 'QA',
  jobTitle: 'Tester',
  location: 'Asunción',
  bio: 'Fixture controlada por Playwright',
  website: '',
  timezone: 'America/Asuncion',
  role: 'employee',
  socialLinks: { linkedin: '', twitter: '', github: '', instagram: '' },
  preferences: {
    notifications: true,
    compactMode: false,
    language: 'es',
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
    autoSave: false,
    darkModeSchedule: false,
  },
}

test.describe('dashboard profile hardening', () => {
  test.skip(!authenticatedState, 'Requiere DASHBOARD_PROFILE_STORAGE_STATE con una sesión de prueba')
  test.use({ storageState: authenticatedState })

  for (const width of [375, 1280]) {
    test(`carga, guarda y recarga datos autoritativos a ${width}px`, async ({ page }) => {
      let authoritative = structuredClone(profile)
      await page.route('**/api/dashboard/profile', async (route) => {
        if (route.request().method() === 'PATCH') {
          const patch = route.request().postDataJSON()
          authoritative = { ...authoritative, ...patch }
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: authoritative }) })
      })

      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${baseUrl}/dashboard/profile`)
      await expect(page.getByLabel(/Nombre completo/)).toHaveValue('Perfil E2E')
      await page.getByLabel(/Nombre completo/).fill(`Perfil E2E ${width}`)
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
      await page.reload()
      await expect(page.getByLabel(/Nombre completo/)).toHaveValue(`Perfil E2E ${width}`)
      await expect(page.getByText('Próximamente').first()).toBeVisible()
    })
  }

  test('retiene el estado pendiente cuando PATCH falla', async ({ page }) => {
    await page.route('**/api/dashboard/profile', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced failure' }) })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile }) })
    })

    await page.goto(`${baseUrl}/dashboard/profile`)
    await page.getByLabel(/Nombre completo/).fill('Cambio no guardado')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cambios sin guardar').first()).toBeVisible()
  })
})

test.describe('public profile rendering', () => {
  const username = process.env.PUBLIC_PROFILE_USERNAME
  test.skip(!username, 'Requiere PUBLIC_PROFILE_USERNAME publicado con datos canónicos')

  test('renderiza el perfil publicado sin datos privados ni verificación inventada', async ({ page }) => {
    await page.goto(`${baseUrl}/perfil/${username}`)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByText('Verificado')).toHaveCount(0)
    await expect(page.getByText(/@/).first()).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/profile-e2e@example\.com|\+595/)
  })
})
