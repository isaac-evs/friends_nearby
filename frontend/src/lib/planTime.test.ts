import { describe, expect, it } from 'vitest'
import { countdownLabel, durationText, endsAtIso, eventTimes, minutesUntilEnd, minutesUntilStart, planEnd, planPhase, spanMin, startLabel, timeTodayIso, verifyWindow } from './planTime'

const now = new Date(2026, 10, 18, 18, 0).getTime() // miércoles 18:00
const at = (min: number) => new Date(now + min * 60_000).toISOString()
const plan = (startMin: number, durationMin: number) => ({ startsAt: at(startMin), durationMin })

describe('fase del plan', () => {
  it('aún no empieza / en curso / terminó', () => {
    expect(planPhase(plan(30, 60), now)).toBe('upcoming')
    expect(planPhase(plan(0, 60), now)).toBe('live') // justo ahora ya cuenta como en curso
    expect(planPhase(plan(-20, 60), now)).toBe('live')
    expect(planPhase(plan(-60, 60), now)).toBe('ended') // el instante de fin ya es "terminó"
    expect(planPhase(plan(-90, 60), now)).toBe('ended')
  })
  it('calcula fin y minutos', () => {
    expect(new Date(planEnd(plan(10, 60))).toISOString()).toBe(at(70))
    expect(endsAtIso(at(10), 60)).toBe(at(70))
    expect(minutesUntilStart(plan(25, 60), now)).toBe(25)
    expect(minutesUntilStart(plan(-5, 60), now)).toBe(-5)
    expect(minutesUntilEnd(plan(-20, 60), now)).toBe(40)
    expect(minutesUntilEnd(plan(-90, 60), now)).toBe(0)
  })
})

describe('textos', () => {
  it('hoy, mañana y otro día', () => {
    expect(startLabel(at(60), now)).toBe('Hoy 7:00 pm')
    expect(startLabel(new Date(2026, 10, 19, 9, 0).toISOString(), now)).toBe('Mañana 9:00 am')
    expect(startLabel(new Date(2026, 10, 21, 7, 0).toISOString(), now)).toMatch(/^sáb 7:00 am$/)
  })
  it('cuenta regresiva según la fase', () => {
    expect(countdownLabel(plan(25, 60), now)).toBe('empieza en 25 min')
    expect(countdownLabel(plan(90, 60), now)).toBe('empieza en 1 h 30 min')
    expect(countdownLabel(plan(-20, 60), now)).toBe('en curso · termina en 40 min')
    expect(countdownLabel(plan(-100, 60), now)).toBe('ya terminó')
  })
  it('duración', () => {
    expect([30, 60, 90, 120, 150, 480].map(durationText)).toEqual(['30 min', '1 h', '1 h 30 min', '2 h', '2 h 30 min', '8 h'])
  })
})

describe('"otra hora" de hoy', () => {
  it('acepta una hora futura y rechaza una pasada o inválida', () => {
    expect(timeTodayIso('19:30', now)).toBe(new Date(2026, 10, 18, 19, 30).toISOString())
    expect(timeTodayIso('18:00', now)).toBeTruthy()
    expect(timeTodayIso('17:00', now)).toBeNull()
    for (const bad of ['', '25:00', '12:60', 'abc', '7']) expect(timeTodayIso(bad, now)).toBeNull()
  })
})

describe('ventana para verificar que estamos juntos', () => {
  it('desde 30 min antes del inicio hasta que termina', () => {
    expect(verifyWindow(plan(31, 60), now)).toBe('early')
    expect(verifyWindow(plan(30, 60), now)).toBe('open')
    expect(verifyWindow(plan(-20, 60), now)).toBe('open')
    expect(verifyWindow(plan(-60, 60), now)).toBe('closed')
  })
})

describe('eventTimes: hora de inicio y de fin', () => {
  it('mismo día', () => {
    const t = eventTimes('2026-11-22', '18:00', '21:00')!
    expect(new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime()).toBe(3 * 3_600_000)
  })
  it('si la hora de fin no es mayor, termina al día siguiente', () => {
    const t = eventTimes('2026-11-22', '22:00', '02:00')!
    expect(new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime()).toBe(4 * 3_600_000)
    expect(eventTimes('2026-11-22', '18:00', '18:00')).not.toBeNull()
  })
  it('entradas inválidas', () => {
    expect(eventTimes('22/11/2026', '18:00', '19:00')).toBeNull()
    expect(eventTimes('2026-11-22', '', '19:00')).toBeNull()
  })
  it('un evento usa su hora de fin para la fase', () => {
    const now = Date.now()
    const ev = { startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 60_000).toISOString() }
    expect(planPhase(ev, now)).toBe('live')
    expect(spanMin(ev)).toBe(2)
  })
})

describe('dayTimeIso y dayStr (otro día)', async () => {
  const { dayTimeIso, dayStr } = await import('./planTime')
  const now = new Date(2026, 10, 19, 12, 0).getTime()
  it('acepta un día futuro y rechaza el pasado o fechas inválidas', () => {
    expect(dayTimeIso('2026-11-20', '09:30', now)).toBe(new Date(2026, 10, 20, 9, 30).toISOString())
    expect(dayTimeIso('2026-11-19', '09:30', now)).toBeNull()
    expect(dayTimeIso('2026-02-31', '09:30', now)).toBeNull()
    expect(dayTimeIso('2026-11-20', '25:00', now)).toBeNull()
  })
  it('dayStr suma días en fecha local', () => expect(dayStr(2, now)).toBe('2026-11-21'))
})
