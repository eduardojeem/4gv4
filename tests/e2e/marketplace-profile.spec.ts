import { expect, test } from 'playwright/test'

const authenticatedState = process.env.MARKETPLACE_PROFILE_STORAGE_STATE

test.describe('perfil del marketplace', () => {
  test.skip(!authenticatedState, 'Requiere MARKETPLACE_PROFILE_STORAGE_STATE con una sesión de cliente de prueba')
  test.use({ storageState: authenticatedState })

  for (const width of [320, 768, 1024, 1440]) {
    test(`mantiene visibles las acciones principales a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/marketplace/perfil')
      await expect(page.getByRole('heading', { name: 'Mi actividad' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Historial de pedidos' })).toBeVisible()
      await expect(page.getByText('Configuración de mi cuenta')).toBeVisible()
      await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
    })
  }

  test('permite filtrar pedidos y anuncia el resultado', async ({ page }) => {
    await page.goto('/marketplace/perfil')
    await page.getByLabel('Filtrar por estado').selectOption('DELIVERED')
    await expect(page.getByText(/Actualizando pedidos|No encontramos|Pedidos realizados/)).toBeVisible()
  })

  test('los controles personales son accesibles por teclado', async ({ page }) => {
    await page.goto('/marketplace/perfil')
    const ordersSwitch = page.getByRole('switch', { name: 'Pedidos' })
    await ordersSwitch.focus()
    await expect(ordersSwitch).toBeFocused()
  })
})
