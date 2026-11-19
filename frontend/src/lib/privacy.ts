/**
 * Regla de privacidad de la ubicación (única fuente de verdad en el cliente):
 *   alguien ve tu ubicación aproximada si y solo si
 *     · NO estás en modo fantasma,
 *     · es tu amigo aceptado, no bloqueado,
 *     · y son amigos cercanos DE LOS DOS (solicitud aparte, aceptada por ambos).
 * Un amigo normal no la ve. Quien no es tu amigo nunca ve tu ubicación.
 *
 * La ubicación EXACTA no sale de esta regla: solo existe mientras una persona la comparte con otra por un rato
 * (`ExactShare`), y se apaga sola. El backend debe imponerlo; aquí solo se refleja para decirte quién ve qué.
 */
import type { ExactShare, Friendship } from '@/api/schemas'

export interface PrivacyState {
  ghost: boolean
  friendships: Record<string, Friendship>
  blocks: string[]
}

export function canSeeMyLocation(s: PrivacyState, userId: string): boolean {
  if (s.ghost || s.blocks.includes(userId)) return false
  const f = s.friendships[userId]
  return f?.status === 'friends' && f.close === 'mutual'
}

/** Ids de quienes ven tu ubicación aproximada ahora. */
export function locationViewers(s: PrivacyState): string[] {
  return Object.keys(s.friendships).filter((id) => canSeeMyLocation(s, id))
}

/** Amigos cercanos (de los dos) "configurados" (ignora el fantasma): sirve para decir "3 cercanos" aunque estés oculto. */
export function closeFriendIds(s: Pick<PrivacyState, 'friendships' | 'blocks'>): string[] {
  return Object.values(s.friendships)
    .filter((f) => f.status === 'friends' && f.close === 'mutual' && !s.blocks.includes(f.userId))
    .map((f) => f.userId)
}

/** Lo que esa persona ve de ti, en una línea. */
export function locationLineText(s: PrivacyState, userId: string): string {
  if (canSeeMyLocation(s, userId)) return 'Ve tu ubicación aproximada'
  if (s.ghost && s.friendships[userId]?.close === 'mutual') return 'No te ve: modo fantasma'
  return 'No ve tu ubicación'
}

// ---- ubicación exacta temporal ----
/** Solo las comparticiones que siguen vigentes. */
export const activeShares = (shares: ExactShare[], now = Date.now()): ExactShare[] => shares.filter((x) => new Date(x.until).getTime() > now)

export const shareWith = (shares: ExactShare[], userId: string, now = Date.now()): ExactShare | undefined =>
  activeShares(shares, now).find((x) => x.userId === userId)

/** Minutos que faltan (redondeado hacia arriba). */
export const minutesLeft = (until: string, now = Date.now()): number => Math.max(0, Math.ceil((new Date(until).getTime() - now) / 60_000))

/** Duraciones que se ofrecen al compartir la ubicación exacta (en minutos). */
export const EXACT_DURATIONS = [30, 60, 120, 240] as const
export const durationLabel = (min: number): string => (min < 60 ? `${min} min` : `${min / 60} h`)
