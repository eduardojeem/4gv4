import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { validateNewProfessional } from '@/components/dashboard/agenda/AddProfessionalDialog'
import { InviteBarberDialog } from '@/components/dashboard/agenda/InviteBarberDialog'

describe('invitaciones de barberos al sistema', () => {
  it('valida el correo cuando se activa enviar invitación', () => {
    const draft = {
      name: 'Carlos',
      specialty: 'Barbero',
      color: '#6366f1',
      allServices: true,
      serviceIds: [],
      onlineVisible: true,
      remunerationType: 'commission' as const,
      commissionRateServices: 50,
      commissionRateProducts: 10,
      commissionFixedDeduction: 0,
      sendInvite: true,
      inviteEmail: '',
    }

    const invalid = validateNewProfessional(draft, [])
    expect(invalid.email).toBe('Ingresá un correo electrónico válido para la invitación.')

    const valid = validateNewProfessional({ ...draft, inviteEmail: 'carlos@barber.com' }, [])
    expect(valid.email).toBeNull()
  })

  it('permite generar la invitación y muestra el botón de WhatsApp', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        userId: 'u-123',
        email: 'carlos@barber.com',
        inviteLink: 'https://mitienda.com/invitacion?token=xyz',
        whatsappUrl: 'https://wa.me/595981123456?text=hola',
        message: 'Invitación generada para carlos@barber.com',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    render(
      <InviteBarberDialog
        open={true}
        onOpenChange={onOpenChange}
        professional={{ id: 'prof-456', name: 'Carlos Gómez', phone: '+595 981 123456' }}
        onSuccess={onSuccess}
      />
    )

    const input = screen.getByLabelText(/Correo electrónico del barbero/i)
    fireEvent.change(input, { target: { value: 'carlos@barber.com' } })

    const sendBtn = screen.getByRole('button', { name: /Generar invitación/i })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/agenda/professionals/invite',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            professionalId: 'prof-456',
            email: 'carlos@barber.com',
            sendEmailInvite: true,
          }),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText(/¡Invitación lista para Carlos Gómez!/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Enviar enlace por WhatsApp/i })).toHaveAttribute(
        'href',
        'https://wa.me/595981123456?text=hola'
      )
    })

    expect(onSuccess).toHaveBeenCalledWith('u-123')
  })
})
