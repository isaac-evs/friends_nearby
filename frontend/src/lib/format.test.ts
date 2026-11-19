import { describe, expect, it } from 'vitest'
import { formatApproxDistance, formatNearby, formatPlanTime, staleLabel, timeLabel } from './format'
import { roundToCell, CELL_GRID_DEG } from './geo'

describe('formatApproxDistance', () => {
  it('siempre es aproximada', () => {
    expect(formatApproxDistance(812)).toBe('~800 m')
    expect(formatApproxDistance(1020)).toBe('~1 km')
    expect(formatApproxDistance(1480)).toBe('~1.5 km')
    expect(formatApproxDistance(3100)).toBe('~3 km')
  })
})

describe('formatPlanTime', () => {
  const now = Date.UTC(2026, 10, 17, 18, 0, 0)
  it('quedan N min', () => {
    expect(formatPlanTime({ expiresAt: new Date(now + 40 * 60_000).toISOString() }, now)).toBe('quedan 40 min')
  })
  it('en 1 h si aún no empieza', () => {
    const startsAt = new Date(now + 60 * 60_000).toISOString()
    expect(formatPlanTime({ startsAt, expiresAt: new Date(now + 3 * 3_600_000).toISOString() }, now)).toBe('en 1 h')
  })
})

describe('timeLabel', () => {
  it('formato 7:00 am', () => {
    expect(timeLabel(new Date(2026, 10, 21, 7, 0).toISOString())).toBe('7:00 am')
    expect(timeLabel(new Date(2026, 10, 21, 17, 0).toISOString())).toBe('5:00 pm')
  })
})

describe('roundToCell', () => {
  it('redondea a la cuadrícula de zona', () => {
    const r = roundToCell({ lat: 20.67513, lng: -103.36487 })
    expect(Math.abs(r.lat / CELL_GRID_DEG - Math.round(r.lat / CELL_GRID_DEG))).toBeLessThan(1e-6)
    expect(r).toEqual({ lat: 20.676, lng: -103.364 })
  })
})

describe('formatNearby y staleLabel', () => {
  it('rangos de cercanía de una persona', () => {
    expect([100, 300, 700, 1500, 4000, 8000].map(formatNearby)).toEqual(['a menos de 250 m', 'a menos de 500 m', 'a menos de 1 km', 'a menos de 3 km', 'a menos de 5 km', 'a unos 8 km'])
  })
  it('solo dice "actualizado" si pasaron más de 5 min', () => {
    const now = Date.now()
    expect(staleLabel(new Date(now - 3 * 60_000).toISOString(), now)).toBe('')
    expect(staleLabel(new Date(now - 12 * 60_000).toISOString(), now)).toBe('actualizado hace 12 min')
  })
})
