import { useMemo } from 'react'
import type { Event, Plan } from '@/api/schemas'
import { ME_ID } from '@/api/mock'
import { useApp } from '@/app/store'
import { EVENT_TYPES, type EventGroup } from '@/lib/category'

export type Mode = 'amigos' | 'abierto'
export type TypeFilter = 'Todos' | EventGroup

export interface Deck {
  /** Total de candidatos (sin contar lo ya deslizado) y cuántos quedan. */
  total: number
  remaining: Array<{ kind: 'plan'; plan: Plan } | { kind: 'event'; event: Event }>
  gated: boolean
}

/**
 * Candidatos de Explorar. Privacidad: solo planes de amigos aceptados y no bloqueados; los eventos
 * (gente nueva) solo con el modo abierto activo. "Paso" no notifica a nadie.
 */
export function useDeck(mode: Mode, type: TypeFilter): Deck {
  const { state } = useApp()
  return useMemo(() => {
    const now = Date.now()
    if (mode === 'amigos') {
      const all = state.plans.filter((p) => {
        const fs = state.friendships[p.authorId]
        return p.authorId !== ME_ID && fs?.status === 'friends' && !state.blocks.includes(p.authorId) && new Date(p.expiresAt).getTime() > now
      })
      const remaining = all.filter((p) => !state.swipes[`plan:${p.id}`]).map((plan) => ({ kind: 'plan' as const, plan }))
      return { total: all.length, remaining, gated: false }
    }
    if (!state.openMode.enabled) return { total: 0, remaining: [], gated: true }
    const all = state.events.filter((e) => {
      if (type !== 'Todos' && EVENT_TYPES[e.type].group !== type) return false
      return e.organizer.name !== 'Tú'
    })
    const remaining = all
      .filter((e) => !state.swipes[`event:${e.id}`] && !state.attendances.some((a) => a.eventId === e.id))
      .map((event) => ({ kind: 'event' as const, event }))
    return { total: all.length, remaining, gated: false }
  }, [mode, type, state.plans, state.friendships, state.blocks, state.swipes, state.openMode.enabled, state.events, state.attendances])
}
