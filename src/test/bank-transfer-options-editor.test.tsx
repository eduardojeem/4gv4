import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BankTransferOptionsEditor } from '@/components/admin/website/BankTransferOptionsEditor'
import type { BankTransferOption } from '@/types/website-settings'

function TestEditor() {
  const [options, setOptions] = useState<BankTransferOption[]>([])
  return <BankTransferOptionsEditor options={options} onChange={setOptions} />
}

describe('BankTransferOptionsEditor', () => {
  it('adds and removes bank transfer options', async () => {
    const user = userEvent.setup()
    render(<TestEditor />)

    await user.click(screen.getByRole('button', { name: 'Agregar banco' }))
    await user.type(screen.getByLabelText('Banco'), 'Banco Familiar')
    await user.type(screen.getByLabelText('Alias'), 'tienda.familiar')

    expect(screen.getByDisplayValue('Banco Familiar')).toBeVisible()
    expect(screen.getByDisplayValue('tienda.familiar')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Eliminar opción bancaria 1' }))

    expect(screen.getByText('Todavía no agregaste una cuenta')).toBeVisible()
  })
})
