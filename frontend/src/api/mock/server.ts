/**
 * "Servidor" mock. Aquí vive el punto exacto de cada amigo y solo sale por `getExactLocation`,
 * que exige un match activo (regla de privacidad: coordenadas exactas solo con match, y temporal).
 * En el backend real esto es una respuesta de la API protegida, no un dato del cliente.
 */
import { MOCK_ORIGIN, offsetMeters, type LatLng } from '@/lib/geo'
import type { Match } from '../schemas'

const EXACT: Record<string, LatLng> = {
  sofi: offsetMeters(MOCK_ORIGIN, 405, 655),
  mau: offsetMeters(MOCK_ORIGIN, -980, 1290),
  regina: offsetMeters(MOCK_ORIGIN, 830, -520),
  dani: offsetMeters(MOCK_ORIGIN, -790, 450),
}

export function getExactLocation(friendId: string, matches: Match[], now = Date.now()): LatLng | null {
  const active = matches.some(
    (m) => m.friendId === friendId && new Date(m.exactShareUntil).getTime() > now,
  )
  return active ? (EXACT[friendId] ?? null) : null
}
