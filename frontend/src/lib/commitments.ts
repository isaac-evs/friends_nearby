/**
 * Compromisos: tus planes y eventos (los que organizas y a los que vas). Solo puedes tener UNO a la vez:
 * dos compromisos no pueden traslaparse en el tiempo.
 */
import type { Attendance, Event, Match, Plan } from '@/api/schemas'
import { planEnd, planPhase, planStart, type Timed } from '@/lib/planTime'

const ME = 'me'


export interface Commitment extends Timed { key: string; kind: 'plan' | 'evento'; id: string; title: string; role: 'organizador' | 'voy' }

export interface CommitmentSource { plans: Plan[]; matches: Match[]; events: Event[]; attendances: Attendance[]; }

export function commitmentsOf(s: CommitmentSource): Commitment[] {
  const out: Commitment[] = []
  for (const p of s.plans) if (p.authorId === ME) out.push({ key: `plan:${p.id}`, kind: 'plan', id: p.id, title: p.line, startsAt: p.startsAt, durationMin: p.durationMin, role: 'organizador' })
  for (const m of s.matches) {
    const p = s.plans.find((x) => x.id === m.planId)
    if (p && p.authorId !== ME) out.push({ key: `plan:${p.id}`, kind: 'plan', id: p.id, title: p.line, startsAt: p.startsAt, durationMin: p.durationMin, role: 'voy' })
  }
  for (const e of s.events) {
    const att = s.attendances.find((a) => a.eventId === e.id)
    const mine = e.organizerId === ME
    // Una solicitud pendiente todavía no te compromete.
    if (mine || att?.status === 'going') out.push({ key: `event:${e.id}`, kind: 'evento', id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, role: mine ? 'organizador' : 'voy' })
  }
  return out
}

export const overlaps = (a: Timed, b: Timed): boolean => planStart(a) < planEnd(b) && planStart(b) < planEnd(a)

/** El compromiso con el que choca un plan/evento nuevo (o `undefined`). `ignoreKey`: el que estás editando. */
export function findConflict(list: Commitment[], cand: Timed, ignoreKey?: string): Commitment | undefined {
  return list.find((c) => c.key !== ignoreKey && overlaps(c, cand))
}

/** Motivo por el que NO puedes unirte (o `null` si puedes). */
export function joinBlock(
  s: CommitmentSource, item: Timed & { lateJoin: boolean; capacity?: number; joinedCount?: number; going?: number }, key: string, now = Date.now(),
): string | null {
  const list = commitmentsOf(s)
  if (list.some((c) => c.key === key)) return 'Ya vas a este plan.'
  const phase = planPhase(item, now)
  if (phase === 'ended') return 'Ya terminó.'
  if (phase === 'live' && !item.lateJoin) return 'Ya empezó y no admite más gente.'
  const filled = item.joinedCount ?? item.going
  if (item.capacity !== undefined && filled !== undefined && filled >= item.capacity) return 'Ya está lleno.'
  const c = findConflict(list, item)
  if (c) return `Ya tienes "${c.title}" a esa hora. Solo puedes tener un plan a la vez.`
  return null
}
