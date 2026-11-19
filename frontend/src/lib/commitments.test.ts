import { describe, expect, it } from 'vitest'
import type { Attendance, Event, Match, Plan } from '@/api/schemas'
import { commitmentsOf, findConflict, joinBlock, overlaps } from './commitments'

const now = new Date(2026, 10, 18, 18, 0).getTime()
const at = (min: number) => new Date(now + min * 60_000).toISOString()
const t = (startMin: number, durationMin: number) => ({ startsAt: at(startMin), durationMin })
const plan = (id: string, authorId: string, startMin: number, durationMin: number, lateJoin = true): Plan => ({
  id, authorId, category: 'cafe', line: `Plan ${id}`, ...t(startMin, durationMin), expiresAt: at(startMin + durationMin), joinPolicy: 'friends', joinedCount: 0, lateJoin,
  place: { name: 'x', center: { lat: 0, lng: 0 } },
})
const match = (planId: string): Match => ({ id: `m-${planId}`, planId, friendId: 'sofi', createdAt: '', togetherAt: null, meetPoint: 'x', quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false })
const event = (id: string, startMin: number, durationMin: number, organizerId?: string, lateJoin = true): Event => ({
  id, type: 'juegos', subtype: '', title: `Evento ${id}`, startsAt: at(startMin), endsAt: at(startMin + durationMin), lateJoin, placeName: 'x', center: { lat: 0, lng: 0 }, capacity: 10, going: 1,
  organizer: { name: 'X', verified: false, eventsCount: 1 }, organizerId, requiresApproval: false, friendsGoingIds: [], xp: 40,
})
const att = (eventId: string, status: Attendance['status']): Attendance => ({ eventId, joinedAt: '', status })
const empty = { plans: [] as Plan[], matches: [] as Match[], events: [] as Event[], attendances: [] as Attendance[] }

describe('traslape', () => {
  it('dos intervalos se traslapan solo si se cruzan (tocarse en el borde no cuenta)', () => {
    expect(overlaps(t(0, 60), t(30, 60))).toBe(true)
    expect(overlaps(t(0, 60), t(60, 60))).toBe(false)
    expect(overlaps(t(0, 60), t(-60, 60))).toBe(false)
    expect(overlaps(t(0, 120), t(30, 10))).toBe(true) // uno dentro del otro
  })
})

describe('mis compromisos', () => {
  it('suma lo que organizo y a lo que voy; una solicitud pendiente aún no cuenta', () => {
    const s = {
      plans: [plan('mio', 'me', 120, 60), plan('sofi', 'sofi', 0, 60)], matches: [match('sofi')],
      events: [event('e1', 300, 120, 'me'), event('e2', 500, 60), event('e3', 700, 60)], attendances: [att('e2', 'going'), att('e3', 'pending')],
    }
    expect(commitmentsOf(s).map((c) => `${c.key}:${c.role}`).sort()).toEqual(['event:e1:organizador', 'event:e2:voy', 'plan:mio:organizador', 'plan:sofi:voy'])
  })
  it('encuentra el compromiso que choca y puede ignorar el que se está editando', () => {
    const list = commitmentsOf({ ...empty, plans: [plan('mio', 'me', 30, 60)] })
    expect(findConflict(list, t(0, 45))?.id).toBe('mio')
    expect(findConflict(list, t(90, 30))).toBeUndefined()
    expect(findConflict(list, t(0, 45), 'plan:mio')).toBeUndefined() // editar el mismo plan no choca consigo
  })
})

describe('puedo unirme', () => {
  const sofi = plan('sofi', 'sofi', -20, 60)
  it('sí, si no choca con nada', () => expect(joinBlock(empty, { ...t(-20, 60), lateJoin: true }, 'plan:sofi', now)).toBeNull())
  it('no, si ya empezó y no admite más gente', () => {
    expect(joinBlock(empty, { ...t(-20, 60), lateJoin: false }, 'plan:x', now)).toBe('Ya empezó y no admite más gente.')
    expect(joinBlock(empty, { ...t(30, 60), lateJoin: false }, 'plan:x', now)).toBeNull() // aún no empieza: sí
  })
  it('no, si ya terminó', () => expect(joinBlock(empty, { ...t(-90, 60), lateJoin: true }, 'plan:x', now)).toBe('Ya terminó.'))
  it('no, si ya vas', () => expect(joinBlock({ ...empty, plans: [sofi], matches: [match('sofi')] }, { ...t(-20, 60), lateJoin: true }, 'plan:sofi', now)).toBe('Ya vas a este plan.'))
  it('no, si el plan ya está lleno (límite de personas)', () => {
    expect(joinBlock(empty, { ...t(30, 60), lateJoin: true, capacity: 4, joinedCount: 4 }, 'plan:x', now)).toBe('Ya está lleno.')
    expect(joinBlock(empty, { ...t(30, 60), lateJoin: true, capacity: 4, joinedCount: 3 }, 'plan:x', now)).toBeNull()
    expect(joinBlock(empty, { ...t(30, 60), lateJoin: true, joinedCount: 99 }, 'plan:x', now)).toBeNull() // sin límite
    expect(joinBlock(empty, { ...t(30, 60), lateJoin: true, capacity: 10, going: 10 }, 'evento:x', now)).toBe('Ya está lleno.')
  })
  it('un evento usa su hora de fin, no una duración', () => {
    const s = { ...empty, events: [event('e1', 0, 120, 'me')] }
    expect(joinBlock(s, { ...t(60, 30), lateJoin: true }, 'plan:otro', now)).toContain('Ya tienes "Evento e1"')
    expect(joinBlock(s, { ...t(120, 30), lateJoin: true }, 'plan:otro', now)).toBeNull()
  })
  it('no, si ya tienes otro plan a esa hora (solo uno a la vez)', () => {
    const s = { ...empty, plans: [plan('mio', 'me', 0, 120)] }
    expect(joinBlock(s, { ...t(30, 60), lateJoin: true }, 'plan:otro', now)).toContain('Ya tienes "Plan mio" a esa hora')
    expect(joinBlock(s, { ...t(130, 60), lateJoin: true }, 'plan:otro', now)).toBeNull() // después de que termine: sí
  })
})
