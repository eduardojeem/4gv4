import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DeliveryZoneOptionsEditor } from '@/components/admin/website/DeliveryZoneOptionsEditor'
import type { DeliveryZoneOption } from '@/types/website-settings'

function TestEditor() {
  const [zones, setZones] = useState<DeliveryZoneOption[]>([])
  return <DeliveryZoneOptionsEditor zones={zones} onChange={setZones} />
}

describe('DeliveryZoneOptionsEditor', () => {
  it('adds a paid zone, marks it as free and removes it', async () => {
    const user = userEvent.setup()
    render(<TestEditor />)

    await user.click(screen.getByRole('button', { name: 'Agregar zona' }))
    await user.type(screen.getByLabelText('Zona o barrio'), 'Encarnación')

    const costInput = screen.getByLabelText('Costo (Gs.)')
    expect(costInput).toHaveValue(5000)

    await user.click(screen.getByRole('switch', { name: 'Delivery gratis para Encarnación' }))

    expect(costInput).toHaveValue(0)
    expect(costInput).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Eliminar zona 1' }))

    expect(screen.getByText('Todavía no agregaste zonas')).toBeVisible()
  })
})
