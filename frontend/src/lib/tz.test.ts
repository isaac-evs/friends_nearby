import { describe, expect, it } from 'vitest'
import { dateKey, fromWall, hhmm, parseWall, startOfDay, startOfWeek, wall } from './tz'
import { eventTimes, dayStr } from './planTime'

describe('hora de México', () => {
  it('convierte UTC a la hora de pared de México (UTC−6)', () => {
    const t = Date.parse('2026-11-20T03:30:00Z') // jueves 19 nov, 9:30 pm en México
    expect(wall(t)).toMatchObject({ y: 2026, mo: 11, d: 19, h: 21, mi: 30, dow: 4 })
    expect(dateKey(t)).toBe('2026-11-19')
    expect(hhmm(t)).toBe('21:30')
  })
  it('fromWall es el inverso de wall', () => {
    const t = fromWall(2026, 11, 19, 21, 30)
    expect(new Date(t).toISOString()).toBe('2026-11-20T03:30:00.000Z')
  })
  it('inicio de día y de semana son a las 00:00 de México', () => {
    const t = Date.parse('2026-11-20T03:30:00Z')
    expect(new Date(startOfDay(t)).toISOString()).toBe('2026-11-19T06:00:00.000Z')
    expect(new Date(startOfWeek(t)).toISOString()).toBe('2026-11-16T06:00:00.000Z') // lunes
  })
  it('parseWall rechaza fechas y horas imposibles', () => {
    expect(parseWall('2026-02-30', '10:00')).toBeNull()
    expect(parseWall('2026-11-19', '24:00')).toBeNull()
    expect(parseWall('2026-11-19', '19:05')).toBe(Date.parse('2026-11-20T01:05:00Z'))
  })
  it('un evento que termina antes de la hora de inicio acaba al día siguiente', () => {
    expect(eventTimes('2026-11-19', '22:00', '02:00')).toEqual({ startsAt: '2026-11-20T04:00:00.000Z', endsAt: '2026-11-20T08:00:00.000Z' })
  })
  it('dayStr usa el día de México aunque en UTC ya sea otro', () => {
    const now = Date.parse('2026-11-20T03:30:00Z')
    expect(dayStr(0, now)).toBe('2026-11-19')
    expect(dayStr(2, now)).toBe('2026-11-21')
  })
})
