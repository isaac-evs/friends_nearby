import type { Event, Plan } from '@/api/schemas'

/** Guardados: lo próximo y en curso va arriba; lo que ya terminó se junta en "Ya pasaron". */
export const planOver = (p: Plan, now: number) => new Date(p.expiresAt).getTime() <= now
export const eventOver = (e: Event, now: number) => new Date(e.endsAt).getTime() <= now

export function splitSaved(plans: Plan[], events: Event[], now: number) {
  return {
    plans: plans.filter((p) => !planOver(p, now)),
    pastPlans: plans.filter((p) => planOver(p, now)),
    events: events.filter((e) => !eventOver(e, now)),
    pastEvents: events.filter((e) => eventOver(e, now)),
  }
}
