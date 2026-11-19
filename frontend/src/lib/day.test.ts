import { describe, expect, it } from 'vitest'
import { dateOfOffset, dayLabel, dayPhrase, dayRange, inDay, offsetOfDate } from './day'

const now = new Date(2026, 10, 18, 18, 0).getTime() // miércoles 18 nov, 18:00
const at = (d: number, h: number, m = 0) => new Date(2026, 10, 18 + d, h, m).toISOString()

describe('día que se mira', () => {
  it('rango de hoy y de mañana', () => {
    const [a, b] = dayRange(0, now)
    expect(new Date(a).getHours()).toBe(0)
    expect(b - a).toBe(86_400_000)
    expect(dayRange(1, now)[0]).toBe(b)
  })
  it('un plan de hoy cuenta hoy; uno de mañana no', () => {
    expect(inDay({ startsAt: at(0, 20), durationMin: 60 }, 0, now)).toBe(true)
    expect(inDay({ startsAt: at(1, 9), durationMin: 60 }, 0, now)).toBe(false)
    expect(inDay({ startsAt: at(1, 9), durationMin: 60 }, 1, now)).toBe(true)
  })
  it('lo en curso cuenta hoy; lo que ya terminó no', () => {
    expect(inDay({ startsAt: at(0, 17), durationMin: 120 }, 0, now)).toBe(true)
    expect(inDay({ startsAt: at(0, 9), durationMin: 60 }, 0, now)).toBe(false)
  })
  it('un evento que cruza la medianoche cuenta en los dos días', () => {
    const ev = { startsAt: at(0, 22), endsAt: at(1, 2) }
    expect(inDay(ev, 0, now)).toBe(true)
    expect(inDay(ev, 1, now)).toBe(true)
    expect(inDay(ev, 2, now)).toBe(false)
  })
  it('etiquetas', () => {
    expect(dayLabel(0, now)).toBe('Hoy')
    expect(dayLabel(1, now)).toBe('Mañana')
    expect(dayLabel(3, now)).toMatch(/^Sáb 21$/)
    expect(dayPhrase(0, now)).toBe('hoy')
    expect(dayPhrase(3, now)).toBe('el sáb 21')
  })
})

describe('otra fecha', () => {
  const now = new Date(2026, 10, 19, 15, 0).getTime()
  it('convierte fecha ↔ desplazamiento', () => {
    expect(offsetOfDate('2026-11-19', now)).toBe(0)
    expect(offsetOfDate('2026-12-25', now)).toBe(36)
    expect(dateOfOffset(36, now)).toBe('2026-12-25')
  })
  it('rechaza fechas pasadas, inválidas o a más de un año', () => {
    expect(offsetOfDate('2026-11-18', now)).toBeNull()
    expect(offsetOfDate('nada', now)).toBeNull()
    expect(offsetOfDate('2028-01-01', now)).toBeNull()
  })
})
