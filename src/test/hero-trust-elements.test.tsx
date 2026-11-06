import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { HeroEditor } from '@/components/admin/website/HeroEditor'
import { validateSetting } from '@/lib/validation/website-settings'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import type { CompanyInfo, HeroStats, HeroContent } from '@/types/website-settings'

const hookState = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  settings: null as Record<string, unknown> | null,
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    settings: hookState.settings,
    isLoading: false,
    error: null,
    isSaving: false,
    updateSettings: hookState.updateSettings,
  }),
}))

const baseCompanyInfo: CompanyInfo = {
  name: 'Mi Tienda Test',
  phone: '0981123456',
  email: 'contacto@mitienda.com',
  address: 'Asunción, Paraguay',
  hours: { weekdays: '08:00 - 18:00', saturday: '', sunday: '' },
  brandColor: 'blue',
  instagram: 'mitiendapy',
  facebook: 'mitiendapy.fb',
  tiktok: 'mitiendapy.tk',
}

const baseHeroContent: HeroContent = {
  enabled: true,
  badge: 'Servicio Garantizado',
  title: 'Todo para tu Hogar y Negocio',
  subtitle: 'Calidad superior en productos y atención.',
  ctaPrimaryText: 'Ver catálogo',
  ctaSecondaryText: 'Contactar',
}

describe('Números de confianza y Redes sociales en HeroSection', () => {
  it('modo por defecto (sin displayMode): muestra solo estadísticas con etiquetas estándar si no hay labels', () => {
    const stats: HeroStats = {
      enabled: true,
      repairs: '5.000+',
      satisfaction: '99%',
      avgTime: '24h',
    }

    render(
      <HeroSection
        companyInfo={baseCompanyInfo}
        heroStats={stats}
        heroContent={baseHeroContent}
        brand={getBrandTheme('blue')}
        phoneClean="595981123456"
        contactHref="/inicio#contacto"
      />
    )

    expect(screen.getByText('5.000+')).toBeInTheDocument()
    expect(screen.getByText('99%')).toBeInTheDocument()
    expect(screen.getByText('24h')).toBeInTheDocument()
    expect(screen.getByText('Garantía')).toBeInTheDocument()
    expect(screen.getByText('Valoración')).toBeInTheDocument()
    expect(screen.getByText('Despacho')).toBeInTheDocument()

    // No debe mostrar canales oficiales
    expect(screen.queryByText('Canales oficiales de confianza')).not.toBeInTheDocument()
  })

  it('modo stats con etiquetas propias: muestra las etiquetas personalizadas', () => {
    const stats: HeroStats = {
      enabled: true,
      displayMode: 'stats',
      repairs: '10.000+',
      satisfaction: '100%',
      avgTime: '12h',
      labels: {
        repairs: 'Envíos realizados',
        satisfaction: 'Clientes felices',
        avgTime: 'Entrega express',
      },
    }

    render(
      <HeroSection
        companyInfo={baseCompanyInfo}
        heroStats={stats}
        heroContent={baseHeroContent}
        brand={getBrandTheme('blue')}
        phoneClean="595981123456"
        contactHref="/inicio#contacto"
      />
    )

    expect(screen.getByText('10.000+')).toBeInTheDocument()
    expect(screen.getByText('Envíos realizados')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Clientes felices')).toBeInTheDocument()
    expect(screen.getByText('12h')).toBeInTheDocument()
    expect(screen.getByText('Entrega express')).toBeInTheDocument()

    expect(screen.queryByText('Canales oficiales de confianza')).not.toBeInTheDocument()
  })

  it('modo social: muestra canales oficiales y oculta estadísticas', () => {
    const stats: HeroStats = {
      enabled: true,
      displayMode: 'social',
      repairs: '',
      satisfaction: '',
      avgTime: '',
    }

    render(
      <HeroSection
        companyInfo={baseCompanyInfo}
        heroStats={stats}
        heroContent={baseHeroContent}
        brand={getBrandTheme('blue')}
        phoneClean="595981123456"
        contactHref="/inicio#contacto"
      />
    )

    // Debe mostrar la tarjeta de canales oficiales
    expect(screen.getByText('Canales oficiales de confianza')).toBeInTheDocument()
    expect(screen.getByText('Verificados')).toBeInTheDocument()
    expect(screen.getByText('@mitiendapy')).toBeInTheDocument()
    expect(screen.getByText('mitiendapy.fb')).toBeInTheDocument()
    expect(screen.getByText('@mitiendapy.tk')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()

    // No debe mostrar números
    expect(screen.queryByText('Garantía')).not.toBeInTheDocument()
    expect(screen.queryByText('Valoración')).not.toBeInTheDocument()
  })

  it('modo both: muestra tanto estadísticas con etiquetas como canales oficiales', () => {
    const stats: HeroStats = {
      enabled: true,
      displayMode: 'both',
      repairs: '2.500+',
      satisfaction: '4.9★',
      avgTime: '48h',
      labels: {
        repairs: 'Proyectos',
        satisfaction: 'Calificación',
        avgTime: 'Respuesta',
      },
    }

    render(
      <HeroSection
        companyInfo={baseCompanyInfo}
        heroStats={stats}
        heroContent={baseHeroContent}
        brand={getBrandTheme('blue')}
        phoneClean="595981123456"
        contactHref="/inicio#contacto"
      />
    )

    // Estadísticas presentes
    expect(screen.getByText('2.500+')).toBeInTheDocument()
    expect(screen.getByText('Proyectos')).toBeInTheDocument()
    expect(screen.getByText('4.9★')).toBeInTheDocument()
    expect(screen.getByText('Calificación')).toBeInTheDocument()

    // Canales oficiales presentes
    expect(screen.getByText('Canales oficiales de confianza')).toBeInTheDocument()
    expect(screen.getByText('@mitiendapy')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('modo social o both sin redes ni teléfono: no muestra la tarjeta de canales', () => {
    const emptyCompany: CompanyInfo = {
      name: 'Sin Redes',
      phone: '',
      email: '',
      brandColor: 'blue',
    }

    const stats: HeroStats = {
      enabled: true,
      displayMode: 'social',
      repairs: '',
      satisfaction: '',
      avgTime: '',
    }

    render(
      <HeroSection
        companyInfo={emptyCompany}
        heroStats={stats}
        heroContent={baseHeroContent}
        brand={getBrandTheme('blue')}
        phoneClean=""
        contactHref="/inicio#contacto"
      />
    )

    expect(screen.queryByText('Canales oficiales de confianza')).not.toBeInTheDocument()
  })
})

describe('Validación de HeroStatsSchema (validateSetting)', () => {
  it('valida displayMode: stats requiriendo las 3 métricas', () => {
    const valid = validateSetting('hero_stats', {
      enabled: true,
      displayMode: 'stats',
      repairs: '100+',
      satisfaction: '99%',
      avgTime: '24h',
    })
    expect(valid.success).toBe(true)

    const invalid = validateSetting('hero_stats', {
      enabled: true,
      displayMode: 'stats',
      repairs: '',
      satisfaction: '99%',
      avgTime: '24h',
    })
    expect(invalid.success).toBe(false)
  })

  it('valida displayMode: social permitiendo métricas vacías', () => {
    const valid = validateSetting('hero_stats', {
      enabled: true,
      displayMode: 'social',
      repairs: '',
      satisfaction: '',
      avgTime: '',
    })
    expect(valid.success).toBe(true)
  })

  it('valida labels opcionales con longitud máxima', () => {
    const valid = validateSetting('hero_stats', {
      enabled: true,
      displayMode: 'stats',
      repairs: '100+',
      satisfaction: '99%',
      avgTime: '24h',
      labels: {
        repairs: 'Reparaciones listas',
        satisfaction: 'Satisfacción garantizada',
        avgTime: 'Tiempo estimado',
      },
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect((valid.data as HeroStats).labels?.repairs).toBe('Reparaciones listas')
    }

    const tooLong = validateSetting('hero_stats', {
      enabled: true,
      displayMode: 'stats',
      repairs: '100+',
      satisfaction: '99%',
      avgTime: '24h',
      labels: {
        repairs: 'Esta etiqueta supera ampliamente el limite permitido de treinta caracteres',
      },
    })
    expect(tooLong.success).toBe(false)
  })
})

describe('HeroEditor con modos de confianza y edición de etiquetas', () => {
  beforeEach(() => {
    hookState.updateSettings.mockReset()
    hookState.updateSettings.mockResolvedValue({ success: true })
    hookState.settings = {
      company_info: baseCompanyInfo,
      hero_content: baseHeroContent,
      hero_stats: {
        enabled: true,
        displayMode: 'stats',
        repairs: '500+',
        satisfaction: '98%',
        avgTime: '24h',
      },
    }
  })

  it('permite cambiar a modo redes sociales oficiales y guardar', async () => {
    render(<HeroEditor />)

    // Clic en el botón de redes sociales oficiales
    const socialModeBtn = screen.getByRole('button', { name: /Redes sociales oficiales/i })
    fireEvent.click(socialModeBtn)

    // Clic en guardar portada
    const saveBtn = screen.getByRole('button', { name: 'Guardar portada' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(hookState.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          hero_stats: expect.objectContaining({
            displayMode: 'social',
          }),
        })
      )
    })
  })

  it('permite editar las etiquetas personalizadas de las métricas', async () => {
    render(<HeroEditor />)

    // Buscar el input de la etiqueta de la primera métrica
    const labelInput = screen.getByLabelText('Texto de la métrica (opcional)', { selector: '#repairs-label' })
    fireEvent.change(labelInput, { target: { value: 'Equipos reparados' } })

    const saveBtn = screen.getByRole('button', { name: 'Guardar portada' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(hookState.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          hero_stats: expect.objectContaining({
            labels: expect.objectContaining({
              repairs: 'Equipos reparados',
            }),
          }),
        })
      )
    })
  })
})
