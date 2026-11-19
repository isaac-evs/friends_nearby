/**
 * Alcance: qué tan lejos buscas (rango), qué tan lejos te ven tus cercanos y quién puede ver qué.
 *  · Rango de búsqueda: planes y eventos más lejos que tu rango no salen (se puede ampliar).
 *  · Radio de visibilidad: qué tan lejos pueden estar tus amigos cercanos para verte (3 km por defecto, modificable).
 *  · Un plan solo lo ven tus amigos. Un invitado de un amigo entra por la invitación y no sale en ningún mapa.
 */
import type { Event, Friendship, Plan } from '@/api/schemas'
import { distanceM, type LatLng } from '@/lib/geo'

export const RADIUS_OPTIONS = [1000, 3000, 5000, 10000, 25000] as const
export const DEFAULT_RADIUS = 5000
export const radiusLabel = (m: number): string => (m < 1000 ? `${m} m` : `${m / 1000} km`)

/** Radio de visibilidad de tus amigos cercanos. */
export const VISIBILITY_RADIUS_OPTIONS = [500, 1000, 3000, 5000, 10000] as const
export const DEFAULT_VISIBILITY_RADIUS = 3000

/** Distancia de tu ubicación aproximada al lugar (exacto) de un plan, en metros. */
export const planDistanceM = (p: Pick<Plan, 'place'>, from: LatLng): number => Math.round(distanceM(from, p.place.center))
/** Distancia de tu ubicación aproximada al lugar de un evento. */
export const eventDistanceM = (e: Pick<Event, 'center'>, from: LatLng): number => Math.round(distanceM(from, e.center))
/** Distancia a la celda aproximada de un amigo. */
export const cellDistanceM = (cell: LatLng, from: LatLng): number => Math.round(distanceM(from, cell))

export const inRange = (distM: number, radiusM: number): boolean => distM <= radiusM

/** ¿Puedes ver este plan en Explorar y en el mapa? Solo si quien lo publicó es tu amigo y no lo bloqueaste. */
export function planVisibility(s: { friendships: Record<string, Friendship>; blocks: string[] }, plan: Pick<Plan, 'authorId'>): { visible: boolean } {
  if (s.blocks.includes(plan.authorId)) return { visible: false }
  return { visible: s.friendships[plan.authorId]?.status === 'friends' }
}
