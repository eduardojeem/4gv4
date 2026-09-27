import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ReviewsHelpDialog } from './ReviewsHelpDialog'

describe('ReviewsHelpDialog', () => {
  it('explains the review workflow and each verification type with examples', async () => {
    const user = userEvent.setup()
    render(<ReviewsHelpDialog />)

    await user.click(screen.getByRole('button', { name: 'Cómo funciona' }))

    expect(screen.getByRole('dialog', { name: 'Cómo funciona la reputación del negocio' })).toBeInTheDocument()
    expect(screen.getByText('Solicitar')).toBeInTheDocument()
    expect(screen.getByText('Moderar')).toBeInTheDocument()
    expect(screen.getByText('Responder')).toBeInTheDocument()
    expect(screen.getByText('Opinión abierta')).toBeInTheDocument()
    expect(screen.getByText('Compra verificada')).toBeInTheDocument()
    expect(screen.getByText('Reparación verificada')).toBeInTheDocument()
    expect(screen.getByText(/Ejemplo: Laura compró una camiseta/i)).toBeInTheDocument()
  })

  it('gives fair moderation and professional response examples', async () => {
    const user = userEvent.setup()
    render(<ReviewsHelpDialog />)

    await user.click(screen.getByRole('button', { name: 'Cómo funciona' }))

    expect(screen.getByText(/Publicá aunque tenga pocas estrellas/i)).toBeInTheDocument()
    expect(screen.getByText(/Rechazá solamente contenido ofensivo/i)).toBeInTheDocument()
    expect(screen.getByText(/Sentimos que la entrega haya demorado/i)).toBeInTheDocument()
    expect(screen.getByText(/no cambia las estrellas ni el comentario/i)).toBeInTheDocument()
    expect(screen.getByText(/opinión honesta/i)).toBeInTheDocument()
  })
})
