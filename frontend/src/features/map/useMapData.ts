import { useMemo } from 'react'
import type { Event, Plan, User } from '@/api/schemas'
import type { LatLng } from '@/lib/geo'
import { useApp } from '@/app/store'
import { ME_ID } from '@/api/constants'

export interface MapFriend { kind: 'friend'; id: string; plan: Plan; user: User; zoneCenter: LatLng; exact: LatLng | null }
export interface MapEventItem { kind: 'event'; id: string; event: Event }
export type MapItem = MapFriend | MapEventItem
export type MapFilter = 'todos' | 'amigos' | 'eventos'

/**
 * Elementos visibles del mapa. Privacidad:
 *  - Solo amigos (aceptados), no bloqueados y sin pausa de ubicación.
 *  - `exact` solo existe con un match activo (ver api/mock/server.ts); si no, se dibuja la zona.
 *  - Los eventos del mapa son públicos (modo abierto) y no exponen a nadie más que al organizador.
 */
export function useMapItems(filter: MapFilter, query: string): MapItem[] {
  const { state } = useApp()
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const out: MapItem[] = []
    if (filter !== 'eventos') {
      for (const plan of state.plans) {
        if (plan.authorId === ME_ID || new Date(plan.expiresAt).getTime() < now) continue
        const fs = state.friendships[plan.authorId]
        const user = state.users[plan.authorId]
        if (!user || fs?.status !== 'friends' || fs.locationPaused || state.blocks.includes(user.id)) continue
        if (q && !`${user.name} ${plan.line}`.toLowerCase().includes(q)) continue
        out.push({ kind: 'friend', id: plan.id, plan, user, zoneCenter: plan.zone.center, exact: (state.matches.some(m => m.friendId === user.id && new Date(m.exactShareUntil).getTime() > now) ? state.exactLocations[user.id] ?? null : null) })
      }
    }
    if (filter !== 'amigos' && state.openMode.enabled) {
      for (const event of state.events) {
        if (q && !`${event.title} ${event.placeName}`.toLowerCase().includes(q)) continue
        out.push({ kind: 'event', id: event.id, event })
      }
    }
    return out
  }, [state.plans, state.friendships, state.users, state.blocks, state.matches, state.events, state.openMode.enabled, state.exactLocations, filter, query])
}

/** Punto que se dibuja para un elemento: exacto solo con match, si no el centro de la zona. */
export function itemPoint(it: MapItem): LatLng {
  if (it.kind === 'event') return it.event.center
  return it.exact ?? it.zoneCenter
}
