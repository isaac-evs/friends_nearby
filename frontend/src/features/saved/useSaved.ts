import { useMemo } from 'react'
import type { Event, Plan } from '@/api/schemas'
import { useApp } from '@/app/store'

export interface Saved { plans: Plan[]; events: Event[]; count: number }

/**
 * Lo que dejaste "para luego" (swipe ↑ / botón marcador). Respeta bloqueos y el modo abierto:
 * los eventos con gente nueva solo se listan si el modo abierto sigue activo.
 */
export function useSaved(): Saved {
  const { state } = useApp()
  return useMemo(() => {
    const plans = state.plans.filter((p) => state.swipes[`plan:${p.id}`] === 'later' && !state.blocks.includes(p.authorId))
    const events = state.openMode.enabled ? state.events.filter((e) => state.swipes[`event:${e.id}`] === 'later') : []
    return { plans, events, count: plans.length + events.length }
  }, [state.plans, state.events, state.swipes, state.blocks, state.openMode.enabled])
}
