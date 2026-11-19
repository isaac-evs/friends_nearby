import { useMemo } from 'react'
import type { Event, Plan } from '@/api/schemas'
import { ME_ID } from '@/api/me'
import { useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { eventDistanceM, inRange, planDistanceM, planVisibility } from '@/lib/reach'
import { planPhase } from '@/lib/planTime'
import { inDay } from '@/lib/day'
import { EVENT_TYPES, type EventGroup } from '@/lib/category'

export type Mode = 'amigos' | 'abierto'
export type TypeFilter = 'Todos' | EventGroup

export interface Deck {
  /** Total de candidatos DENTRO de tu rango (sin contar lo ya deslizado) y cuántos quedan. */
  total: number
  remaining: Array<{ kind: 'plan'; plan: Plan } | { kind: 'event'; event: Event }>
  gated: boolean
  /** Cuántos más habría si ampliaras el rango (para sugerirlo). */
  hidden: number
}

/**
 * Candidatos de Explorar. Privacidad: solo planes de tus amigos; los eventos (gente nueva) solo con el modo abierto activo. Solo lo que esté dentro de tu rango y
 * no haya terminado. "Paso" no notifica a nadie.
 */
export function useDeck(mode: Mode, type: TypeFilter): Deck {
  const { state } = useApp()
  const now = useNow()
  return useMemo(() => {
    if (mode === 'amigos') {
      const visible = state.plans.filter((p) => p.authorId !== ME_ID && planVisibility(state, p).visible && new Date(p.expiresAt).getTime() > now && inDay(p, state.dayOffset, now))
      const all = visible.filter((p) => inRange(planDistanceM(p, state.location.center), state.radiusM))
      const remaining = all.filter((p) => !state.swipes[`plan:${p.id}`]).map((plan) => ({ kind: 'plan' as const, plan }))
      return { total: all.length, remaining, gated: false, hidden: visible.length - all.length }
    }
    if (!state.openMode.enabled) return { total: 0, remaining: [], gated: true, hidden: 0 }
    const visible = state.events.filter((e) => {
      if (type !== 'Todos' && EVENT_TYPES[e.type].group !== type) return false
      return e.organizerId !== ME_ID && planPhase(e, now) !== 'ended' && inDay(e, state.dayOffset, now)
    })
    const all = visible.filter((e) => inRange(eventDistanceM(e, state.location.center), state.radiusM))
    const remaining = all
      .filter((e) => !state.swipes[`event:${e.id}`] && !state.attendances.some((a) => a.eventId === e.id))
      .map((event) => ({ kind: 'event' as const, event }))
    return { total: all.length, remaining, gated: false, hidden: visible.length - all.length }
  }, [mode, type, state, now])
}
