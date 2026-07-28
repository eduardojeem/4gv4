import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CommerceModeSelector } from '@/components/admin/website/CommerceModeSelector'
import type { PublicCommerceMode } from '@/types/website-settings'

function TestSelector() {
  const [mode, setMode] = useState<PublicCommerceMode>('cart')
  return <CommerceModeSelector value={mode} onChange={setMode} />
}

describe('CommerceModeSelector', () => {
  it('switches from cart to WhatsApp mode', async () => {
    const user = userEvent.setup()
    render(<TestSelector />)

    expect(screen.getByRole('radio', { name: /Carrito y pedidos/ })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: /Consultas por WhatsApp/ }))

    expect(screen.getByRole('radio', { name: /Consultas por WhatsApp/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Carrito y pedidos/ })).toHaveAttribute('aria-checked', 'false')
  })
})
