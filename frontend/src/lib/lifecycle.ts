import { hhmm } from '@/lib/tz'
/**
 * Ciclo de vida de un plan (G6): penalizaciones, confiabilidad, lobby y check-in. Las MISMAS reglas que aplica el servidor
 * (`backend/internal/api/social.go`); aquí solo sirven para avisar antes ("Perderás 25 XP"), el servidor decide.
 */
import { planEnd, planStart, type Timed } from '@/lib/planTime'

const MIN = 60_000
/** El lobby y el check-in abren 10 min antes del inicio y cierran al terminar. */
export const LOBBY_LEAD_MIN = 10
export const CHECKIN_METERS = 250
/** Cuántos compromisos cuentan para la confiabilidad. */
export const RECORD_SIZE = 20
/** Chat del plan: texto libre (hasta `CHAT_MAX` caracteres); los rápidos son atajos. Espera corta entre mensajes. */
export const CHAT_MAX = 280
export const QUICK_MESSAGES = ['Ya voy', 'Llego en 5', 'Llego en 10', 'Voy tarde', 'Ya estoy aquí', '¿Dónde están?'] as const
export const MESSAGE_COOLDOWN_S = 1

/** XP que cuesta cancelar con `minutes` minutos antes del inicio (negativo = ya empezó) y si cuenta como falla. */
export function cancelPenalty(minutes: number): { xp: number; miss: boolean } {
  if (minutes > 90) return { xp: 10, miss: false }
  if (minutes >= 15) return { xp: 25 + Math.floor(((90 - minutes) * 25) / 75), miss: false }
  return { xp: minutes < 0 ? STARTED_CANCEL_XP : 60, miss: true }
}
/** Cancelar cuando el plan ya empezó (y no llegaste) cuesta más que cancelar tarde. */
export const STARTED_CANCEL_XP = 100
export const NO_SHOW_XP = 80

/** ¿Te dará penalización cancelar? Cambios de hora/lugar hechos hace < 2 h por quien organiza te liberan. */
export function leavePenalty(plan: Timed & { changedAt?: string }, now = Date.now()): { xp: number; miss: boolean } | null {
  if (plan.changedAt && now - new Date(plan.changedAt).getTime() <= 2 * 60 * MIN) return null
  return cancelPenalty(Math.floor((planStart(plan) - now) / MIN))
}

/** "Cumple 18 de 20" (o `null` si aún no hay compromisos). Solo cuentan los últimos 20. */
export function reliability(record: readonly string[]): { ok: number; total: number; label: string } | null {
  const last = record.slice(-RECORD_SIZE)
  if (last.length === 0) return null
  const ok = last.filter((r) => r === 'ok').length
  return { ok, total: last.length, label: `Cumple ${ok} de ${last.length}` }
}

export type LobbyPhase = 'before' | 'open' | 'over'
export function lobbyPhase(p: Timed, now = Date.now()): LobbyPhase {
  if (now < planStart(p) - LOBBY_LEAD_MIN * MIN) return 'before'
  return now < planEnd(p) ? 'open' : 'over'
}

export interface RosterEntry { userId: string; organizer: boolean; arrivedAt?: string; confirmedBy?: string; distanceM?: number; locAt?: string; joinedAt?: string }
/** Orden del lobby: primero quienes ya llegaron (por hora de llegada), luego quien organiza y después el resto. */
export function sortRoster(roster: readonly RosterEntry[]): RosterEntry[] {
  return [...roster].sort((a, b) => {
    if (!!a.arrivedAt !== !!b.arrivedAt) return a.arrivedAt ? -1 : 1
    if (a.arrivedAt && b.arrivedAt) return a.arrivedAt.localeCompare(b.arrivedAt)
    return Number(b.organizer) - Number(a.organizer)
  })
}

/**
 * Puntualidad al llegar (mismas reglas que `arrivalXP` del servidor). El check-in abre 10 min antes: temprano paga más; tarde, menos.
 *   ≥ 5 min antes: +30 · de −5 a +5 min: +20 · hasta 15 min tarde: +12 · hasta 30: +8 · más: +5.
 */
export type Punctuality = 'temprano' | 'a tiempo' | 'tarde' | 'muy tarde'
export function arrivalXP(startsAt: string, at: number | string = Date.now()): { xp: number; label: Punctuality; lateMin: number } {
  const d = (new Date(at).getTime() - new Date(startsAt).getTime()) / MIN
  const lateMin = Math.max(0, Math.round(d))
  if (d <= -5) return { xp: 30, label: 'temprano', lateMin: 0 }
  if (d <= 5) return { xp: 20, label: 'a tiempo', lateMin: 0 }
  if (d <= 15) return { xp: 12, label: 'tarde', lateMin }
  if (d <= 30) return { xp: 8, label: 'tarde', lateMin }
  return { xp: 5, label: 'muy tarde', lateMin }
}

/** Cómo llegó alguien, con la hora: "Llegaste 11:39 · a tiempo" (tú) o "Llegó 11:40 · tarde (12 min)" (otra persona). */
export function arrivedLabel(startsAt: string, arrivedAt: string, you = false): string {
  const a = arrivalXP(startsAt, arrivedAt)
  const clock = hhmm(new Date(arrivedAt).getTime())
  const how = a.label === 'temprano' ? 'temprano' : a.label === 'a tiempo' ? 'a tiempo' : `tarde (${a.lateMin} min)`
  return `${you ? 'Llegaste' : 'Llegó'} ${clock} · ${how}`
}

/** Unirse hasta 2 min después del inicio sigue siendo "a tiempo" (un plan creado con "ahora" empieza ya). */
const JOIN_GRACE_MIN = 2
/** Te uniste con el plan ya iniciado: no llegas tarde, no cuenta como no-show y salirte no penaliza. */
export function joinedInProgress(startsAt: string, joinedAt?: string): boolean {
  return !!joinedAt && new Date(joinedAt).getTime() > new Date(startsAt).getTime() + JOIN_GRACE_MIN * MIN
}
/** Desde cuándo se espera que llegue alguien: el inicio o, si se unió después, cuando se unió. */
export function dueAt(startsAt: string, joinedAt?: string): string {
  return joinedAt && new Date(joinedAt).getTime() > new Date(startsAt).getTime() ? joinedAt : startsAt
}
