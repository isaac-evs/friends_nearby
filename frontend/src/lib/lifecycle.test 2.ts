import { describe, expect, it } from 'vitest'
import { arrivalXP, arrivedLabel, dueAt, joinedInProgress, cancelPenalty, leavePenalty, lobbyPhase, reliability, sortRoster } from './lifecycle'

const now = new Date(2026, 10, 19, 18, 0).getTime()
const at = (min: number) => new Date(now + min * 60_000).toISOString()

describe('cancelPenalty (§4.8)', () => {
  it('> 90 min: −10 XP y no cuenta como falla', () => expect(cancelPenalty(120)).toEqual({ xp: 10, miss: false }))
  it('entre 90 y 15 min: sube de 25 a 50 conforme se acerca', () => {
    expect(cancelPenalty(90).xp).toBe(25)
    expect(cancelPenalty(50).xp).toBeGreaterThan(25)
    expect(cancelPenalty(15).xp).toBeLessThanOrEqual(50)
    expect(cancelPenalty(15).miss).toBe(false)
  })
  it('< 15 min o ya empezado: −60 XP y cuenta como falla', () => {
    expect(cancelPenalty(14)).toEqual({ xp: 60, miss: true })
    expect(cancelPenalty(-30)).toEqual({ xp: 100, miss: true })
  })
})

describe('leavePenalty', () => {
  it('un cambio de hora o lugar de hace < 2 h libera de la penalización', () => {
    expect(leavePenalty({ startsAt: at(60), durationMin: 60, changedAt: at(-30) }, now)).toBeNull()
    expect(leavePenalty({ startsAt: at(60), durationMin: 60, changedAt: at(-180) }, now)?.xp).toBeGreaterThan(0)
  })
})

describe('reliability', () => {
  it('"Cumple 18 de 20" con los últimos 20', () => {
    const rec = [...Array(5).fill('miss'), ...Array(2).fill('miss'), ...Array(18).fill('ok')]
    expect(reliability(rec)?.label).toBe('Cumple 18 de 20')
  })
  it('sin compromisos no hay dato', () => expect(reliability([])).toBeNull())
})

describe('lobby', () => {
  it('abre 10 min antes y cierra al terminar', () => {
    const p = { startsAt: at(30), durationMin: 60 }
    expect(lobbyPhase(p, now)).toBe('before')
    expect(lobbyPhase({ ...p, startsAt: at(9) }, now)).toBe('open')
    expect(lobbyPhase({ startsAt: at(-120), durationMin: 60 }, now)).toBe('over')
  })
  it('ordena: llegaron primero (por hora), luego quien organiza, luego el resto', () => {
    const r = sortRoster([{ userId: 'c', organizer: false }, { userId: 'b', organizer: false, arrivedAt: '2026-11-19T18:05:00Z' }, { userId: 'a', organizer: true }, { userId: 'd', organizer: false, arrivedAt: '2026-11-19T18:01:00Z' }])
    expect(r.map((x) => x.userId)).toEqual(['d', 'b', 'a', 'c'])
  })
})

describe('puntualidad al llegar', () => {
  const start = new Date(2026, 10, 19, 18, 0).toISOString()
  const at = (min: number) => new Date(new Date(start).getTime() + min * 60_000).toISOString()
  it('temprano paga más; tarde, menos', () => {
    expect(arrivalXP(start, at(-10))).toMatchObject({ xp: 30, label: 'temprano' })
    expect(arrivalXP(start, at(0))).toMatchObject({ xp: 20, label: 'a tiempo' })
    expect(arrivalXP(start, at(12))).toMatchObject({ xp: 12, label: 'tarde', lateMin: 12 })
    expect(arrivalXP(start, at(25)).xp).toBe(8)
    expect(arrivalXP(start, at(45))).toMatchObject({ xp: 5, label: 'muy tarde' })
  })
  it('etiquetas con hora, según quién', () => {
    expect(arrivedLabel(start, at(-7), true)).toBe('Llegaste 17:53 · temprano')
    expect(arrivedLabel(start, at(3))).toBe('Llegó 18:03 · a tiempo')
    expect(arrivedLabel(start, at(12))).toBe('Llegó 18:12 · tarde (12 min)')
  })
})

describe('unirse con el plan en curso', () => {
  const start = new Date(2026, 10, 19, 18, 0).toISOString()
  const at = (min: number) => new Date(new Date(start).getTime() + min * 60_000).toISOString()
  it('no penaliza ni llega tarde', () => {
    expect(joinedInProgress(start, at(-30))).toBe(false)
    expect(joinedInProgress(start, at(1))).toBe(false) // plan "ahora": empieza ya
    expect(joinedInProgress(start, at(20))).toBe(true)
    expect(dueAt(start, at(20))).toBe(at(20))
    expect(dueAt(start, at(-30))).toBe(start)
    expect(arrivalXP(dueAt(start, at(20)), at(23)).label).toBe('a tiempo')
  })
})
