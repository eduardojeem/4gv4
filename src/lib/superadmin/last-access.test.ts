import { describe, expect, it } from 'vitest'
import { describeLastAccess, summarizeTeamAccess } from './last-access'

const NOW = new Date('2026-09-16T12:00:00Z').getTime()
const hace = (dias: number) => new Date(NOW - dias * 24 * 60 * 60 * 1000).toISOString()

describe('último acceso', () => {
  it('lo dice en palabras', () => {
    expect(describeLastAccess(hace(0), NOW).label).toBe('Hoy')
    expect(describeLastAccess(hace(1), NOW).label).toBe('Ayer')
    expect(describeLastAccess(hace(12), NOW).label).toBe('Hace 12 días')
    expect(describeLastAccess(hace(65), NOW).label).toBe('Hace 2 meses')
    expect(describeLastAccess(hace(800), NOW).label).toBe('Hace 2 años')
  })

  /** Una empresa que dejó de entrar se veía igual que una que entró hoy. */
  it('marca a quien no entra hace más de un mes, o nunca entró', () => {
    expect(describeLastAccess(hace(20), NOW).stale).toBe(false)
    expect(describeLastAccess(hace(45), NOW).stale).toBe(true)
    expect(describeLastAccess(null, NOW)).toEqual({ label: 'Nunca entró', stale: true })
  })

  it('resume al equipo: el acceso más reciente, quiénes entraron esta semana y quiénes nunca', () => {
    expect(summarizeTeamAccess([hace(40), hace(2), null, hace(6)], NOW)).toEqual({
      lastAccessAt: hace(2),
      activeLastWeek: 2,
      neverSignedIn: 1,
    })
  })

  it('un equipo que nunca entró no tiene último acceso', () => {
    expect(summarizeTeamAccess([null, undefined], NOW)).toEqual({ lastAccessAt: null, activeLastWeek: 0, neverSignedIn: 2 })
  })
})
