import { describe, expect, it } from 'vitest'
import { streakWeeks, thisWeekDone, weekStart } from './streak'

// Miércoles 18 de noviembre de 2026, 15:00 (la semana va del lunes 16 al domingo 22).
const now = new Date(2026, 10, 18, 15, 0).getTime()
const at = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString()

describe('semana', () => {
  it('empieza el lunes a las 00:00', () => {
    expect(new Date(weekStart(now))).toEqual(new Date(2026, 10, 16, 0, 0))
    expect(new Date(weekStart(new Date(2026, 10, 22, 23, 59).getTime()))).toEqual(new Date(2026, 10, 16, 0, 0)) // domingo
    expect(new Date(weekStart(new Date(2026, 10, 23, 0, 1).getTime()))).toEqual(new Date(2026, 10, 23, 0, 0)) // lunes siguiente
  })
})

describe('racha de semanas', () => {
  it('sin planes no hay racha', () => expect(streakWeeks([], now)).toBe(0))
  it('cuenta semanas seguidas, con al menos un plan por semana', () => {
    // semanas del 9 nov, 2 nov, 26 oct y 19 oct; la actual (16 nov) aún sin plan
    expect(streakWeeks([at(10, 11), at(10, 4), at(9, 28), at(9, 21)], now)).toBe(4)
  })
  it('varios planes en una semana cuentan como una sola', () => {
    expect(streakWeeks([at(10, 11), at(10, 12), at(10, 13), at(10, 4)], now)).toBe(2)
  })
  it('la semana en curso suma si ya hubo un plan', () => {
    expect(streakWeeks([at(10, 17), at(10, 11), at(10, 4)], now)).toBe(3)
  })
  it('una semana vacía corta la racha', () => {
    // faltó la semana del 26 oct
    expect(streakWeeks([at(10, 11), at(10, 4), at(9, 21)], now)).toBe(2)
  })
  it('si la semana pasada también quedó vacía, la racha es 0 (aunque la actual esté abierta)', () => {
    expect(streakWeeks([at(10, 4), at(9, 28)], now)).toBe(0)
  })
  it('un plan solo de esta semana es racha de 1', () => {
    expect(streakWeeks([at(10, 16, 9)], now)).toBe(1)
  })
})

describe('esta semana', () => {
  it('detecta si ya hay un plan esta semana', () => {
    expect(thisWeekDone([at(10, 11)], now)).toBe(false)
    expect(thisWeekDone([at(10, 11), at(10, 17)], now)).toBe(true)
    expect(thisWeekDone([at(10, 23, 8)], now)).toBe(false) // lunes siguiente = otra semana
  })
})
