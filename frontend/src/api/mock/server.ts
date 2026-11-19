/**
 * "Servidor" mock. Aquí vive el punto exacto de cada amigo y solo sale por `getExactLocation`, que exige que ESA persona
 * lo haya compartido contigo (amigo cercano, temporal). En el backend real esto es una respuesta de la API protegida
 * (con TTL en Redis), no un dato del cliente.
 */
import { MOCK_ORIGIN, offsetMeters, type LatLng } from '@/lib/geo'
import type { ExactShare } from '../schemas'

const EXACT: Record<string, LatLng> = {
  sofi: offsetMeters(MOCK_ORIGIN, 405, 655),
  mau: offsetMeters(MOCK_ORIGIN, -980, 1290),
  regina: offsetMeters(MOCK_ORIGIN, 830, -520),
  dani: offsetMeters(MOCK_ORIGIN, -790, 450),
  nico: offsetMeters(MOCK_ORIGIN, -300, -230),
}

/** `grants`: lo que tus amigos cercanos compartieron contigo (ver `AppState.exactGrants`). */
export function getExactLocation(friendId: string, grants: ExactShare[], now = Date.now()): LatLng | null {
  const active = grants.some((g) => g.userId === friendId && new Date(g.until).getTime() > now)
  return active ? (EXACT[friendId] ?? null) : null
}
