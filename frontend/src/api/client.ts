/**
 * ÚNICA entrada de datos del frontend. Las pantallas y el store NO importan `api/mock/*`: piden todo aquí.
 * Hoy `api` es el mock (`api/mock/`); cuando exista backend se cambia la implementación sin tocar pantallas.
 * Contratos de red: docs/especificacion.md §7 (todo [PROPUESTA]: `infra/` aún no lo tiene).
 */
import type { Badge, Event, ExactShare, Friendship, Invite, PlanHistoryItem, PlanPlace, Presence, User, Plan } from './schemas'
import type { LatLng } from '@/lib/geo'
import type { ImageKind } from '@/lib/image'
import { mockApi } from './mock'

export { ME_ID } from './me'

/** Todo lo que la app necesita para arrancar. [PROPUESTA] `GET /bootstrap` (o varias llamadas en paralelo). */
export interface Bootstrap {
  users: User[]
  friendships: Friendship[]
  plans: Plan[]
  events: Event[]
  /** Dónde está cada amigo cercano ahora (celda aproximada). Real: WS `location.update`. */
  presence: Presence[]
  history: PlanHistoryItem[]
  invites: Invite[]
  /** Quién más va a cada evento (solo nombre y avatar). */
  attendees: Record<string, string[]>
  badges: Badge[]
  /** Mi ubicación aproximada (celda redondeada). Real: la del dispositivo, redondeada antes de guardarse. */
  myCenter: LatLng
}

/**
 * Proveedor de lugares: PREPARACIÓN. [PROPUESTA] Amazon Location (`SearchPlaceIndexForText` / `GetPlace`) detrás de
 * `GET /places/autocomplete` y `GET /places/{placeId}`. Hoy NO se usa: el lugar se escribe a mano y se marca en el mapa.
 */
export interface PlacesProvider {
  readonly kind: 'manual' | 'amazon-location'
  autocomplete(q: string, near: LatLng): Promise<PlanPlace[]>
  details(placeId: string): Promise<PlanPlace | null>
}

export interface ApiClient {
  /** Carga inicial. */
  bootstrap(): Promise<Bootstrap>
  places: PlacesProvider
  /** Posiciones en vivo. Real: llegan por WebSocket; el servidor solo las manda si esa persona las compartió contigo. */
  live: { exactLocation(friendId: string, grants: ExactShare[], now?: number): LatLng | null }
  profile: {
    changePassword(input: { current: string; next: string }): Promise<void>
    isUsernameAvailable(username: string, taken: string[]): Promise<boolean>
    uploadMedia(kind: ImageKind, blob: Blob): Promise<string>
  }
}

export const api: ApiClient = mockApi
export { ApiError } from './mock/profile'
