import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RepairFieldHelp } from './RepairFieldHelp'

describe('RepairFieldHelp', () => {
  it('exposes contextual help to keyboard users', async () => {
    const user = userEvent.setup()
    render(<RepairFieldHelp label="Ayuda sobre precio">El servidor validará el precio final.</RepairFieldHelp>)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Ayuda sobre precio' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('El servidor validará el precio final.')
  })
})
