import { describe, expect, it } from 'vitest'
import type { CloseStatus, ExactShare, Friendship } from '@/api/schemas'
import { activeShares, canSeeMyLocation, closeFriendIds, durationLabel, EXACT_DURATIONS, minutesLeft, shareWith, locationLineText, locationViewers, type PrivacyState } from './privacy'

const f = (userId: string, status: Friendship['status'], close: CloseStatus): Friendship => ({ userId, status, close, mutualFriendIds: [], locationPaused: false })
const base = (over: Partial<PrivacyState> = {}): PrivacyState => ({
  ghost: false,
  blocks: [],
  friendships: Object.fromEntries([
    f('sofi', 'friends', 'mutual'), f('mau', 'friends', 'mutual'), f('dani', 'friends', 'requested_in'), f('leo', 'friends', 'none'), f('regina', 'friends', 'requested_out'),
    f('pau', 'requested_in', 'mutual'), f('karla', 'none', 'mutual'), f('beto', 'requested_out', 'mutual'),
  ].map((x) => [x.userId, x])),
  ...over,
})

describe('quién ve tu ubicación', () => {
  it('solo los amigos cercanos de los DOS (solicitud aceptada)', () => {
    expect(locationViewers(base())).toEqual(['sofi', 'mau'])
  })
  it('una solicitud pendiente (enviada o recibida) o un amigo normal no la ve', () => {
    for (const id of ['dani', 'leo', 'regina']) expect(canSeeMyLocation(base(), id)).toBe(false)
  })
  it('quien no es amigo nunca la ve, aunque quedara un estado "mutual"', () => {
    for (const id of ['pau', 'karla', 'beto', 'nadie']) expect(canSeeMyLocation(base(), id)).toBe(false)
  })
  it('el modo fantasma la oculta a todos, también a los cercanos', () => {
    expect(locationViewers(base({ ghost: true }))).toEqual([])
  })
  it('un cercano bloqueado no la ve', () => {
    expect(locationViewers(base({ blocks: ['sofi'] }))).toEqual(['mau'])
  })
  it('closeFriendIds ignora el fantasma pero no a bloqueados ni a no amigos', () => {
    expect(closeFriendIds(base({ ghost: true, blocks: ['mau'] }))).toEqual(['sofi'])
  })
})

describe('texto de vista previa', () => {
  it('dice que la ve solo a quien la ve', () => {
    expect(locationLineText(base(), 'sofi')).toBe('Ve tu ubicación aproximada')
    for (const id of ['dani', 'leo', 'regina', 'karla', 'pau']) expect(locationLineText(base(), id)).toBe('No ve tu ubicación')
  })
  it('con fantasma nadie la ve y el texto lo explica', () => {
    expect(locationLineText(base({ ghost: true }), 'sofi')).toBe('No te ve: modo fantasma')
    expect(locationLineText(base({ ghost: true }), 'dani')).toBe('No ve tu ubicación')
  })
})

describe('ubicación exacta temporal', () => {
  const now = new Date(2026, 10, 18, 20, 0).getTime()
  const at = (min: number) => new Date(now + min * 60_000).toISOString()
  const shares: ExactShare[] = [{ userId: 'sofi', until: at(42) }, { userId: 'mau', until: at(-1) }]
  it('solo cuentan las vigentes', () => {
    expect(activeShares(shares, now).map((x) => x.userId)).toEqual(['sofi'])
    expect(shareWith(shares, 'sofi', now)).toBeTruthy()
    expect(shareWith(shares, 'mau', now)).toBeUndefined() // ya venció
    expect(shareWith(shares, 'nadie', now)).toBeUndefined()
  })
  it('calcula los minutos que faltan (hacia arriba) y nunca baja de 0', () => {
    expect(minutesLeft(at(42), now)).toBe(42)
    expect(minutesLeft(new Date(now + 90_000).toISOString(), now)).toBe(2)
    expect(minutesLeft(at(-5), now)).toBe(0)
  })
  it('etiquetas de duración', () => {
    expect([30, 60, 120, 240].map(durationLabel)).toEqual(['30 min', '1 h', '2 h', '4 h'])
    expect(EXACT_DURATIONS).toEqual([30, 60, 120, 240])
  })
})
