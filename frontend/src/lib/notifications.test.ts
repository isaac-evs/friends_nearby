import { describe, expect, it } from 'vitest'
import type { Plan } from '@/api/schemas'
import { applyPrefs, badgeOf, withoutDismissed, bucketOf, buildFeed, DEFAULT_PREFS, groupFeed, namesLabel, type FeedInput } from './notifications'
import { splitSaved } from './saved'

const now = new Date(2026, 10, 19, 18, 0).getTime()
const at = (min: number) => new Date(now + min * 60_000).toISOString()
const plan = (o: Partial<Plan> = {}): Plan => ({ id: 'p1', authorId: 'me', category: 'cafe', line: 'Café', startsAt: at(-30), durationMin: 60, expiresAt: at(30), joinPolicy: 'friends', joinedCount: 2, place: { name: 'Café', center: { lat: 0, lng: 0 } }, lateJoin: true, ...o })
const input = (o: Partial<FeedInput> = {}): FeedInput => ({ me: 'me', now, blocks: [], plans: [], events: [], invites: [], friendships: {}, exactRequests: [], friendDistances: [], ...o })
const fr = (userId: string, o = {}) => ({ userId, status: 'friends' as const, mutualFriendIds: [], locationPaused: false, close: 'none' as const, ...o })

describe('buildFeed (§4.11)', () => {
  it('invitación recibida pendiente es accionable; una enviada y contestada es respuesta', () => {
    const f = buildFeed(input({ invites: [
      { id: 'a', kind: 'plan', targetId: 'p9', title: 'Cena', fromId: 'mau', toId: 'me', status: 'pending', at: at(-5) },
      { id: 'b', kind: 'evento', targetId: 'e1', title: 'Rave', fromId: 'me', toId: 'sofi', status: 'accepted', at: at(-3) },
    ] }))
    expect(f.map((n) => n.type).sort()).toEqual(['invite', 'reply'])
    expect(badgeOf(f, 0).count).toBe(1)
  })
  it('respeta bloqueos', () => {
    const f = buildFeed(input({ blocks: ['mau'], invites: [{ id: 'a', kind: 'plan', targetId: 'p9', title: 'x', fromId: 'mau', toId: 'me', status: 'pending', at: at(-5) }] }))
    expect(f).toHaveLength(0)
  })
  it('solicitudes de amistad, de cercano y ubicación exacta', () => {
    const f = buildFeed(input({ friendships: { a: { ...fr('a'), status: 'requested_in' }, b: fr('b', { close: 'requested_in' }) }, exactRequests: ['c'] }))
    expect(f.map((n) => n.type).sort()).toEqual(['close', 'exact', 'friend'])
  })
  it('en tu plan: se unieron, check-in, mensaje rápido y empieza en 10 min', () => {
    const p = plan({ startsAt: at(8), roster: [{ userId: 'me', organizer: true }, { userId: 'mau', organizer: false, arrivedAt: at(-1) }, { userId: 'sofi', organizer: false }], timeline: [{ userId: 'mau', text: 'Ya llegué', at: at(-2) }] })
    const types = buildFeed(input({ plans: [p] })).map((n) => n.type)
    expect(types).toEqual(expect.arrayContaining(['join', 'checkin', 'message', 'starts']))
    expect(types.filter((t) => t === 'join')).toHaveLength(2)
  })
  it('"se unió" nunca queda en el futuro', () => {
    const p = plan({ startsAt: at(120), roster: [{ userId: 'me', organizer: true }, { userId: 'mau', organizer: false }] })
    const j = buildFeed(input({ plans: [p] })).find((n) => n.type === 'join')!
    expect(new Date(j.at).getTime()).toBeLessThanOrEqual(now)
  })
  it('cambio de hora o lugar solo avisa si no lo hiciste tú', () => {
    expect(buildFeed(input({ plans: [plan({ changedAt: at(-4) })] })).some((n) => n.type === 'changed')).toBe(false)
    const other = plan({ authorId: 'mau', memberIds: ['me'], changedAt: at(-4) })
    expect(buildFeed(input({ plans: [other] })).some((n) => n.type === 'changed')).toBe(true)
  })
  it('cercano a < 500 m: solo cercanos mutuos y sin ubicación en el texto', () => {
    const f = buildFeed(input({
      friendships: { mau: fr('mau', { close: 'mutual' }), pau: fr('pau') },
      friendDistances: [{ userId: 'mau', distanceM: 300, updatedAt: at(-1) }, { userId: 'pau', distanceM: 200, updatedAt: at(-1) }, { userId: 'sofi', distanceM: 900, updatedAt: at(-1) }],
    }))
    expect(f.map((n) => n.userIds[0])).toEqual(['mau'])
    expect(JSON.stringify(f)).not.toMatch(/distanceM|lat|lng/)
  })
})

describe('agrupación, cubetas y badge', () => {
  it('agrupa por plan y tipo: "Mau y 2 más"', () => {
    const p = plan({ roster: [{ userId: 'me', organizer: true }, ...['mau', 'sofi', 'nico'].map((userId) => ({ userId, organizer: false }))] })
    const g = groupFeed(buildFeed(input({ plans: [p] })))
    const join = g.find((x) => x.type === 'join')!
    expect(join.userIds).toHaveLength(3)
    expect(namesLabel(['Mau', 'Sofi', 'Nico'])).toBe('Mau y 2 más')
    expect(namesLabel(['Mau', 'Sofi'])).toBe('Mau y Sofi')
    expect(namesLabel([])).toBe('Alguien')
  })
  it('Hoy · Esta semana · Antes', () => {
    expect(bucketOf(at(-60), now)).toBe('Hoy')
    expect(bucketOf(at(-60 * 24 * 3), now)).toBe('Esta semana')
    expect(bucketOf(at(-60 * 24 * 10), now)).toBe('Antes')
  })
  it('el badge numérico solo cuenta lo que pide respuesta; lo demás es punto hasta que lo lees', () => {
    const p = plan({ roster: [{ userId: 'me', organizer: true }, { userId: 'mau', organizer: false }] })
    const f = buildFeed(input({ plans: [p] }))
    expect(badgeOf(f, 0)).toEqual({ count: 0, unread: 1, total: 1, dot: true })
    expect(badgeOf(f, now)).toEqual({ count: 0, unread: 0, total: 0, dot: false })
  })
  it('preferencias apagan el tipo, pero nunca lo que pide respuesta', () => {
    const f = buildFeed(input({ friendships: { a: { ...fr('a'), status: 'requested_in' } }, plans: [plan({ roster: [{ userId: 'me', organizer: true }, { userId: 'mau', organizer: false }] })] }))
    const off = applyPrefs(f, { ...DEFAULT_PREFS, requests: false, activity: false })
    expect(off.map((n) => n.type)).toEqual(['friend'])
  })
})

describe('Guardados: Ya pasaron', () => {
  it('separa lo próximo/en curso de lo terminado', () => {
    const live = plan({ id: 'a' }), done = plan({ id: 'b', expiresAt: at(-1) })
    const ev = (id: string, endsAt: string) => ({ id, endsAt }) as never
    const s = splitSaved([live, done], [ev('e1', at(60)), ev('e2', at(-5))], now)
    expect(s.plans.map((p) => p.id)).toEqual(['a'])
    expect(s.pastPlans.map((p) => p.id)).toEqual(['b'])
    expect(s.events).toHaveLength(1)
    expect(s.pastEvents).toHaveLength(1)
  })
})

describe('borrado suave', () => {
  it('quita lo borrado, pero nunca lo que pide respuesta', () => {
    const f = buildFeed(input({ friendships: { a: { ...fr('a'), status: 'requested_in' } }, plans: [plan({ roster: [{ userId: 'me', organizer: true }, { userId: 'mau', organizer: false }] })] }))
    const all = f.map((n) => n.id)
    expect(withoutDismissed(f, all).map((n) => n.type)).toEqual(['friend'])
    expect(withoutDismissed(f, [])).toHaveLength(f.length)
  })
})
