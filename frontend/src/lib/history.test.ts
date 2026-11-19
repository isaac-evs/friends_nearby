import { describe, expect, it } from 'vitest'
import type { PlanHistoryItem } from '@/api/schemas'
import { attendeesLabel, byRecent } from './history'

const item = (id: string, at: string): PlanHistoryItem => ({ id, kind: 'plan', title: id, categoryLabel: 'Café', placeName: 'X', at, attendeeIds: [] })

describe('historial de planes', () => {
  it('ordena del más reciente al más antiguo sin mutar', () => {
    const h = [item('a', '2026-11-01T10:00:00Z'), item('b', '2026-11-10T10:00:00Z'), item('c', '2026-11-05T10:00:00Z')]
    expect(byRecent(h).map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(h.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('dice quiénes fueron', () => {
    expect(attendeesLabel([])).toBe('Fuiste tú solo')
    expect(attendeesLabel(['Sofi'])).toBe('Con Sofi')
    expect(attendeesLabel(['Sofi', 'Mau'])).toBe('Con Sofi y Mau')
    expect(attendeesLabel(['Sofi', 'Mau', 'Dani'])).toBe('Con Sofi, Mau y Dani')
    // Con más de 5 personas se dicen todos los nombres (los íconos son los que se limitan).
    expect(attendeesLabel(['Sofi', 'Mau', 'Dani', 'Leo', 'Pau', 'Regina', 'Nico'])).toBe('Con Sofi, Mau, Dani, Leo, Pau, Regina y Nico')
  })
})
