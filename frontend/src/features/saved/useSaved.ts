import { useMemo } from 'react'
import type { Event, Plan } from '@/api/schemas'
import { useApp } from '@/app/store'
import { splitSaved } from '@/lib/saved'

export interface Saved { plans: Plan[]; events: Event[]; pastPlans: Plan[]; pastEvents: Event[]; count: number; pastCount: number }

/**
 * Lo que dejaste "para luego" (swipe ↑ / botón marcador). Respeta bloqueos y el modo abierto:
 * los eventos con gente nueva solo se listan si el modo abierto sigue activo.
 * `count` = lo próximo y en curso (lo que importa en el badge); lo que ya terminó va aparte, en "Ya pasaron".
 */
export function useSaved(now = Date.now()): Saved {
  const { state } = useApp()
  const minute = Math.floor(now / 60_000)
  return useMemo(() => {
    const plans = state.plans.filter((p) => state.swipes[`plan:${p.id}`] === 'later' && !state.blocks.includes(p.authorId))
    const events = state.openMode.enabled ? state.events.filter((e) => state.swipes[`event:${e.id}`] === 'later') : []
    const s = splitSaved(plans, events, minute * 60_000)
    return { ...s, count: s.plans.length + s.events.length, pastCount: s.pastPlans.length + s.pastEvents.length }
  }, [state.plans, state.events, state.swipes, state.blocks, state.openMode.enabled, minute])
}
