import { describe, expect, it } from 'vitest'
import type { Event, Friendship, Plan } from '@/api/schemas'
import { cellDistanceM, DEFAULT_VISIBILITY_RADIUS, eventDistanceM, inRange, planDistanceM, planVisibility, radiusLabel, VISIBILITY_RADIUS_OPTIONS } from './reach'

const f = (userId: string, status: Friendship['status']): Friendship => ({ userId, status, close: 'none', mutualFriendIds: [], locationPaused: false })
const friendships = Object.fromEntries([f('sofi', 'friends'), f('mau', 'friends'), f('karla', 'none'), f('pau', 'requested_in')].map((x) => [x.userId, x]))
const me = { lat: 20.675, lng: -103.365 }
const plan = (authorId: string): Plan => ({
  id: 'p', authorId, category: 'correr', line: 'x', startsAt: '2026-11-18T20:00:00.000Z', durationMin: 60, expiresAt: '2026-11-18T21:00:00.000Z', joinPolicy: 'friends', joinedCount: 0, lateJoin: true,
  place: { name: 'Parque Rojo', center: { lat: 20.676, lng: -103.366 } },
})

describe('rango', () => {
  it('opciones y etiquetas', () => expect([500, 1000, 5000, 25000].map(radiusLabel)).toEqual(['500 m', '1 km', '5 km', '25 km']))
  it('dentro o fuera del rango', () => {
    expect(inRange(800, 1000)).toBe(true)
    expect(inRange(1000, 1000)).toBe(true)
    expect(inRange(1001, 1000)).toBe(false)
  })
  it('la distancia de un plan es al lugar exacto, desde tu ubicación aproximada', () => {
    const d = planDistanceM(plan('sofi'), me)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(200)
    expect(planDistanceM(plan('sofi'), { lat: 20.676, lng: -103.366 })).toBe(0)
  })
  it('distancia a un evento y a la celda de un amigo', () => {
    expect(eventDistanceM({ center: { lat: 20.676, lng: -103.366 } } as Pick<Event, 'center'>, me)).toBeGreaterThan(100)
    expect(cellDistanceM({ lat: 20.675, lng: -103.365 }, me)).toBe(0)
  })
})

describe('radio de visibilidad de amigos cercanos', () => {
  it('3 km por defecto y se puede cambiar', () => {
    expect(DEFAULT_VISIBILITY_RADIUS).toBe(3000)
    expect(VISIBILITY_RADIUS_OPTIONS).toContain(DEFAULT_VISIBILITY_RADIUS)
    expect(VISIBILITY_RADIUS_OPTIONS.length).toBeGreaterThan(1)
  })
})

describe('quién ve un plan: solo tus amigos', () => {
  const s = { friendships, blocks: [] as string[] }
  it('el de un amigo, siempre', () => expect(planVisibility(s, plan('sofi'))).toEqual({ visible: true }))
  it('quien no es tu amigo no (aunque comparta amigos contigo)', () => {
    expect(planVisibility(s, plan('karla')).visible).toBe(false)
    expect(planVisibility(s, plan('pau')).visible).toBe(false) // solicitud pendiente: aún no es amigo
    expect(planVisibility(s, plan('desconocido')).visible).toBe(false)
  })
  it('un amigo bloqueado tampoco', () => {
    expect(planVisibility({ friendships, blocks: ['sofi'] }, plan('sofi')).visible).toBe(false)
  })
})
