/** MOCK: implementación de `ApiClient` con datos de ejemplo. Solo `api/client.ts` (y las pruebas) importan esto. */
import { z } from 'zod'
import { Badge, Event, Friendship, Invite, Plan, PlanHistoryItem, Presence, User } from '../schemas'
import type { ApiClient, Bootstrap } from '../client'
import { roundToCell, MOCK_ORIGIN } from '@/lib/geo'
import { SEED_ATTENDEES, SEED_BADGES, SEED_EVENTS, SEED_FRIENDSHIPS, SEED_HISTORY, SEED_INVITES, SEED_PLANS, SEED_PRESENCE, SEED_USERS } from './seed'
import { getExactLocation } from './server'
import { changePassword, isUsernameAvailable, uploadProfileMedia } from './profile'

/** Valida el seed contra los contratos: si el mock se desvía, falla al arrancar. */
export function createMockBootstrap(): Bootstrap {
  return {
    users: z.array(User).parse(SEED_USERS),
    friendships: z.array(Friendship).parse(SEED_FRIENDSHIPS),
    plans: z.array(Plan).parse(SEED_PLANS),
    events: z.array(Event).parse(SEED_EVENTS),
    presence: z.array(Presence).parse(SEED_PRESENCE),
    history: z.array(PlanHistoryItem).parse(SEED_HISTORY),
    invites: z.array(Invite).parse(SEED_INVITES),
    attendees: SEED_ATTENDEES,
    badges: z.array(Badge).parse(SEED_BADGES),
    myCenter: roundToCell(MOCK_ORIGIN),
  }
}

export const mockApi: ApiClient = {
  bootstrap: async () => createMockBootstrap(),
  // Preparación: sin proveedor real todavía. El lugar se escribe a mano y se marca en el mapa.
  places: { kind: 'manual', autocomplete: async () => [], details: async () => null },
  live: { exactLocation: getExactLocation },
  profile: { changePassword, isUsernameAvailable, uploadMedia: uploadProfileMedia },
}
