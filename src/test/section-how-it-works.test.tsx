import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SectionHowItWorks } from '@/components/admin/website/SectionHowItWorks'

describe('SectionHowItWorks', () => {
  it('reveals the contextual steps when the user requests help', async () => {
    const user = userEvent.setup()

    render(
      <SectionHowItWorks
        sectionName="los pagos"
        steps={[
          {
            title: 'Habilitá un método',
            description: 'El cliente verá solamente las opciones activas.',
          },
        ]}
      />
    )

    expect(screen.queryByText('Habilitá un método')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '¿Cómo funciona?' }))

    expect(screen.getByText('Habilitá un método')).toBeVisible()
    expect(screen.getByText('El cliente verá solamente las opciones activas.')).toBeVisible()
  })
})
