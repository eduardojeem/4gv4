import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProcessSteps } from '@/components/public/inicio/ProcessSteps'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { createProcessStepsFromTemplate } from '@/lib/website/process-steps'

describe('public process flows', () => {
  it('lets the customer switch between configured processes', async () => {
    const user = userEvent.setup()

    render(
      <ProcessSteps
        brand={getBrandTheme('blue')}
        flows={[
          {
            id: 'repairs',
            title: 'Reparaciones',
            description: 'Servicio técnico',
            active: true,
            steps: createProcessStepsFromTemplate('repairs'),
          },
          {
            id: 'purchase',
            title: 'Compra y entrega',
            description: 'Pedidos de productos',
            active: true,
            steps: createProcessStepsFromTemplate('purchase'),
          },
        ]}
      />
    )

    expect(screen.getByText('Diagnóstico')).toBeVisible()
    expect(screen.queryByText('Elegí tus productos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Compra y entrega' }))

    expect(screen.getByText('Elegí tus productos')).toBeVisible()
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument()
  })
})
