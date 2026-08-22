import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CatalogSearchDialogFooter } from './CatalogSearchDialogFooter'

describe('CatalogSearchDialogFooter', () => {
  it('keeps an explicit close action available after using shortcuts', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CatalogSearchDialogFooter onClose={onClose} />)

    const close = screen.getByRole('button', { name: 'Cerrar buscador' })
    expect(close).toBeVisible()
    await user.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
