import { createElement, type ImgHTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaaSPlansSection } from './saas-plans-section'
import type { SubscriptionPlan } from './saas-plan-presentation'

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement('img', props),
}))

const plans: SubscriptionPlan[] = [
  {
    id: 'free', tier: 'free', name: 'FREE', price: 0, is_active: true,
    limits: { users: '1', products: '50', repairs: '20/mes' },
    features: [{ label: 'Inventario', value: true }],
  },
  {
    id: 'pro', tier: 'pro', name: 'PRO', price: 150_000, is_active: true,
    limits: { users: '10', products: '5 000', repairs: 'Ilimitadas' },
    features: [{ label: 'Inventario', value: true }],
  },
  {
    id: 'enterprise', tier: 'enterprise', name: 'ENTERPRISE', price: 300_000, is_active: false,
    limits: { users: 'Ilimitados' },
    features: [{ label: 'Soporte prioritario', value: true }],
  },
]

describe('SaaSPlansSection', () => {
  it('shows contextual mascot guidance and compares active plans only', () => {
    render(<SaaSPlansSection initialPlans={plans} />)

    expect(screen.getByText('Te ayudo a comparar')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FREE' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PRO' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ENTERPRISE' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ver todas las características/i }))

    expect(screen.getByText('20/mes')).toBeInTheDocument()
    expect(screen.getByText('Ilimitadas')).toBeInTheDocument()
    expect(screen.queryByText('Soporte prioritario')).not.toBeInTheDocument()
  })

  it('shows an honest empty state when the database has no active plans', () => {
    render(<SaaSPlansSection initialPlans={[]} />)

    expect(screen.getByRole('status')).toHaveTextContent('No hay planes disponibles')
    expect(screen.queryByRole('heading', { name: 'FREE' })).not.toBeInTheDocument()
  })
})
