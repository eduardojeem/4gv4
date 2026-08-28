import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

import { MonitoringDashboard, type MonitoringData } from './MonitoringDashboard'

const baseData: MonitoringData = {
  services: [
    { id: 'app', name: 'Next.js App', kind: 'runtime', status: 'ok', latency: null, detail: 'ok' },
  ],
  overallLatency: 42,
  activity24h: { newOrgs: 0, logins: 0, errors: 0, suspicious: 0 },
  subscriptions: { active: 1, trialing: 0, pastDue: 0 },
  recentEvents: [],
  topActions: [],
  fetchedAt: '2026-08-28T12:00:00.000Z',
}

describe('MonitoringDashboard auto-refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * El reloj de la cabecera (`now`) se actualiza cada segundo con su propio
   * useEffect, y eso re-renderiza todo el dashboard. `handleRefresh` no estaba
   * memoizado, asi que cada uno de esos renders le daba una identidad nueva, y
   * el useEffect de useAutoRefresh -que la tiene en su lista de dependencias-
   * volvia a armar el setInterval de 15s desde cero. El timer nunca llegaba a
   * cumplir los 15s: se reiniciaba cada segundo antes de poder disparar.
   */
  it('actually calls router.refresh after 15s, surviving the header clock ticking every second', () => {
    const { container } = render(<MonitoringDashboard data={baseData} />)

    const buttons = Array.from(container.querySelectorAll('button'))
    const toggle = buttons.find((b) => b.textContent?.includes('Auto-refresh'))
    act(() => {
      toggle?.click()
    })

    // Cada avance se hace en su propio act(): asi React re-renderiza entre
    // uno y otro, igual que en un navegador real, donde cada tick del
    // setInterval del reloj es su propia macrotarea. Avanzarlos todos dentro
    // de un unico act() los deja agrupados en un solo flush, y el bug -que
    // depende de que haya 15 renders distintos, uno por segundo- no se
    // reproduce.
    for (let i = 0; i < 15; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(refreshMock).toHaveBeenCalled()
  })
})

describe('MonitoringDashboard overall status', () => {
  // "Eventos Criticos / Alertas" ya se pinta en rojo cuando hay errores o
  // actividad sospechosa en 24h, pero la insignia general y el animo del
  // robot solo miraban la conectividad de las 4 tablas: se podia tener
  // actividad sospechosa activa con todo en verde.
  it('flags the badge and the robot when there is suspicious activity, even with every table healthy', () => {
    render(
      <MonitoringDashboard
        data={{
          ...baseData,
          activity24h: { newOrgs: 0, logins: 0, errors: 0, suspicious: 3 },
        }}
      />
    )

    expect(document.body.textContent).toContain('Atención Requerida')
    expect(document.body.textContent).not.toContain('Sistemas Operativos')
  })

  it('stays healthy with no service issues and no activity alerts', () => {
    render(<MonitoringDashboard data={baseData} />)

    expect(document.body.textContent).toContain('Sistemas Operativos')
  })
})
