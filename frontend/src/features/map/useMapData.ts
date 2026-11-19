import { useMemo } from 'react'
import type { Event, Plan, PlanPlace, User } from '@/api/schemas'
import type { LatLng } from '@/lib/geo'
import { api } from '@/api/client'
import { ME_ID } from '@/api/me'
import { useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { cellDistanceM, eventDistanceM, inRange, planDistanceM, planVisibility } from '@/lib/reach'
import { planPhase } from '@/lib/planTime'
import { inDay } from '@/lib/day'

/**
 * Un AMIGO CERCANO (de los dos) que te muestra su ubicación: se dibuja con su foto, sin nombre. Celda aproximada; la exacta
 * solo existe si te la compartió por un rato (`exactUntil`). `plan`: el plan activo que tiene ahora (si tiene uno).
 */
export interface MapPerson {
  kind: 'person'; id: string; user: User; cell: LatLng; distanceM: number; updatedAt: string
  exact: LatLng | null; exactUntil?: string; plan?: Plan
  /**
   * Plan o evento EN CURSO en el que está ahora (si se ve en el mapa): se dibuja como círculo en la esquina de ese plan o
   * evento, sin marcador propio ni círculo aproximado (ya se sabe dónde está).
   */
  atId?: string
}
/** Un plan de un amigo, en el lugar EXACTO donde será (punto de encuentro, no la ubicación de nadie). `joined`: ya jalaste. */
export interface MapPlan { kind: 'plan'; id: string; plan: Plan; user: User; place: PlanPlace; distanceM: number; joined: boolean }
export interface MapEventItem { kind: 'event'; id: string; event: Event; distanceM: number }
export type MapItem = MapPerson | MapPlan | MapEventItem
/** Todos · Amigos (cercanos) · Planes · Eventos. */
export type MapFilter = 'todos' | 'amigos' | 'planes' | 'eventos'

export const personId = (userId: string) => `person-${userId}`

/**
 * Elementos visibles del mapa. Privacidad:
 *  - Personas: SOLO amigos cercanos de los dos (solicitud aceptada por ambos), sin pausa de ubicación ni bloqueo. Foto, sin nombre.
 *    Quien no comparte contigo sigue en tu lista de amigos pero no sale en el mapa. Los invitados (no amigos) nunca salen.
 *  - Planes: los de tus amigos, en su lugar exacto; los terminados y cancelados desaparecen.
 *  - Eventos: solo con el modo abierto; no exponen a nadie más que al organizador.
 */
export function useMapItems(filter: MapFilter, query: string, opts?: { ignoreDay?: boolean }): MapItem[] {
  const { state: appState } = useApp()
  // "Ahora" ignora el día elegido: es lo que pasa en este momento.
  const state = opts?.ignoreDay ? { ...appState, dayOffset: 0 } : appState
  const now = useNow() // las ubicaciones exactas temporales vencen solas
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: MapItem[] = []
    const livePlans = state.plans.filter((p) => new Date(p.expiresAt).getTime() > now)

    if (filter === 'todos' || filter === 'amigos') {
      for (const pr of state.presence) {
        const fs = state.friendships[pr.userId]
        const user = state.users[pr.userId]
        if (!user || fs?.status !== 'friends' || fs.close !== 'mutual' || fs.locationPaused || state.blocks.includes(user.id)) continue
        const dist = cellDistanceM(pr.cell, state.location.center)
        if (!inRange(dist, state.radiusM)) continue
        const plan = livePlans.find((p) => p.authorId === user.id)
        if (q && !`${user.name} ${plan?.line ?? 'sin plan'}`.toLowerCase().includes(q)) continue
        const grant = state.exactGrants.find((g) => g.userId === user.id && new Date(g.until).getTime() > now)
        out.push({
          kind: 'person', id: personId(user.id), user, cell: pr.cell, distanceM: dist, updatedAt: pr.updatedAt,
          exact: api.live.exactLocation(user.id, state.exactGrants, now), exactUntil: grant?.until, plan,
        })
      }
    }
    if (filter === 'todos' || filter === 'planes') {
      for (const plan of livePlans) {
        if (plan.authorId === ME_ID || !inDay(plan, state.dayOffset, now)) continue
        const user = state.users[plan.authorId]
        if (!user || (!planVisibility(state, plan).visible && !state.matches.some(m => m.planId === plan.id))) continue
        const dist = planDistanceM(plan, state.location.center)
        if (!inRange(dist, state.radiusM)) continue
        if (q && !`${user.name} ${plan.line} ${plan.place.name}`.toLowerCase().includes(q)) continue
        out.push({ kind: 'plan', id: plan.id, plan, user, place: plan.place, distanceM: dist, joined: state.matches.some((m) => m.planId === plan.id) })
      }
    }
    if ((filter === 'todos' || filter === 'eventos') && state.openMode.enabled) {
      for (const event of state.events) {
        const dist = eventDistanceM(event, state.location.center)
        if (planPhase(event, now) === 'ended' || !inDay(event, state.dayOffset, now) || !inRange(dist, state.radiusM)) continue
        if (q && !`${event.title} ${event.placeName}`.toLowerCase().includes(q)) continue
        out.push({ kind: 'event', id: event.id, event, distanceM: dist })
      }
    }
    // Un amigo cercano que está en un evento o plan EN CURSO se dibuja en la esquina de ese evento o plan (no aparte).
    const liveEvents = out.filter((i): i is MapEventItem => i.kind === 'event' && planPhase(i.event, now) === 'live')
    const livePlanItems = out.filter((i): i is MapPlan => i.kind === 'plan' && planPhase(i.plan, now) === 'live')
    for (const it of out) {
      if (it.kind !== 'person') continue
      const ev = liveEvents.find((e) => (state.attendees[e.event.id] ?? []).includes(it.user.id) || e.event.friendsGoingIds.includes(it.user.id))
      const pl = livePlanItems.find((p) => p.plan.authorId === it.user.id || (p.plan.memberIds ?? []).includes(it.user.id))
      const at = ev?.id ?? pl?.id
      if (at) it.atId = at
    }
    return out
  }, [opts?.ignoreDay, state.attendees, state.plans, state.friendships, state.users, state.blocks, state.matches, state.exactGrants, state.events, state.presence, state.dayOffset, state.location.center, state.openMode.enabled, state.radiusM, filter, query, now])
}

/** Punto que se dibuja: la posición exacta solo si te la compartieron; si no, la celda aproximada (personas) o el lugar (planes y eventos). */
export function itemPoint(it: MapItem): LatLng {
  if (it.kind === 'event') return it.event.center
  if (it.kind === 'plan') return it.place.center
  return it.exact ?? it.cell
}

/**
 * Conteos del encabezado "¿Qué plan hoy?" para el día elegido y tu rango: cuántos amigos quieren hacer algo (personas distintas
 * con un plan) y cuántos eventos hay. `eventsHidden`: hay eventos pero el modo abierto está apagado.
 */
export function useDayCounts(): { friends: number; plans: number; events: number; eventsHidden: boolean } {
  const items = useMapItems('todos', '')
  const { state } = useApp()
  const plans = items.filter((i): i is MapPlan => i.kind === 'plan')
  return {
    friends: new Set(plans.map((p) => p.user.id)).size,
    plans: plans.length,
    events: items.filter((i) => i.kind === 'event').length,
    eventsHidden: !state.openMode.enabled,
  }
}
