import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepairHelpCenter } from './RepairHelpCenter'

describe('RepairHelpCenter', () => {
  it('finds video tutorials through search and selects them', () => {
    render(
      <RepairHelpCenter
        open
        onOpenChange={vi.fn()}
        audience="admin"
      />,
    )

    const search = screen.getByRole('searchbox', { name: /qué querés hacer/i })
    fireEvent.change(search, { target: { value: 'ticket térmico' } })
    expect(screen.getByText(/1\. Recepción rápida, cobro de seña en caja/i)).toBeVisible()

    fireEvent.click(screen.getByText(/1\. Recepción rápida, cobro de seña en caja/i))
    // Changes to videos tab
    expect(screen.getByText('Capacitación en Video para el Taller')).toBeVisible()
  })

  it('navigates to video tutorials tab and shows video creation guide', () => {
    render(
      <RepairHelpCenter
        open
        onOpenChange={vi.fn()}
        audience="technician"
      />,
    )

    const videosTab = screen.getByRole('tab', { name: /Videos/i })
    fireEvent.click(videosTab)

    expect(screen.getByText('Capacitación en Video para el Taller')).toBeVisible()
    expect(screen.getByText(/Banco de trabajo: diagnóstico, descuento de repuestos/i)).toBeVisible()

    // Toggle guide for how to create videos
    const howToCreateBtn = screen.getByRole('button', { name: /¿Cómo crear tus videos\?/i })
    fireEvent.click(howToCreateBtn)

    expect(screen.getByText(/¿Se pueden crear videos para el taller\? ¡Sí, y es muy simple!/i)).toBeVisible()
    expect(screen.getByText(/Elige una herramienta de grabación ligera y gratuita/i)).toBeVisible()
  })

  it('offers a useful empty search state', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="operator" />,
    )
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'consulta inexistente' } })
    expect(screen.getByText(/no encontramos una guía/i)).toBeVisible()
  })

  it('links the downloadable manual generated for the current guide', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="admin" />,
    )

    expect(screen.getByRole('link', { name: /descargar manual pdf/i })).toHaveAttribute(
      'href',
      '/guides/guia-reparaciones-v1.pdf',
    )
  })

  it('permite ver los estados del taller con ejemplos y navegar el modal de nueva reparación', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="admin" />,
    )

    // Pestaña inicial: Estados y ciclo de vida
    expect(screen.getByText(/Ciclo de Vida de una Reparación \(6 Estados\)/i)).toBeVisible()
    expect(screen.getByText('Pendiente de Revisión')).toBeVisible()
    expect(screen.getByText('Listo para Retirar')).toBeVisible()
    expect(screen.getByText(/Samsung Galaxy A54 ingresado/i)).toBeVisible()

    // Cambiar a la pestaña de Nueva Orden
    const newModalTab = screen.getByRole('tab', { name: /Nueva Orden/i })
    fireEvent.click(newModalTab)

    expect(screen.getByText(/Cómo Registrar una Nueva Reparación \(8 Pasos\)/i)).toBeVisible()
    expect(screen.getByText('Cliente y Canal de Notificación')).toBeVisible()

    // Avanzar de paso
    const nextStepBtn = screen.getByRole('button', { name: /Siguiente paso/i })
    fireEvent.click(nextStepBtn)
    expect(screen.getByText('Dispositivo y Trazabilidad')).toBeVisible()

    // Cambiar a la pestaña de Módulos / Funcionalidades
    const featuresTab = screen.getByRole('tab', { name: /Módulos/i })
    fireEvent.click(featuresTab)

    expect(screen.getByText('Herramientas y Funcionalidades del Panel')).toBeVisible()
    expect(screen.getByText('Gestión de Repuestos y Costos del Taller')).toBeVisible()
    expect(screen.getByText('Cobros Rápidos, Señas y Vinculación con Caja')).toBeVisible()
    expect(screen.getByText('Notificaciones Instantáneas por WhatsApp')).toBeVisible()
  })

  it('permite buscar términos del modal de nueva reparación como "patrón" o "seña"', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="admin" />,
    )

    const search = screen.getByRole('searchbox', { name: /qué querés hacer/i })
    fireEvent.change(search, { target: { value: 'patrón' } })

    expect(screen.getByText('Seguridad y Desbloqueo')).toBeVisible()
  })
})
