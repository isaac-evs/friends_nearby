import { startOfWeek } from '@/lib/tz'

/**
 * Racha: semanas SEGUIDAS con al menos un plan o evento al que fuiste. La semana va de lunes a domingo (hora de México).
 * La semana en curso todavía no rompe la racha: si aún no tienes un plan esta semana, cuenta hasta la semana pasada.
 */
export const weekStart = (t: number): number => startOfWeek(t)
const prevWeek = (ws: number): number => startOfWeek(ws - 3 * 86_400_000) // lunes de la semana anterior (sin depender de la zona del dispositivo)

/** ¿Ya cuenta esta semana (hubo al menos un plan o evento)? */
export function thisWeekDone(dates: string[], now = Date.now()): boolean {
  const cur = weekStart(now)
  return dates.some((x) => weekStart(new Date(x).getTime()) === cur)
}

/** Semanas de racha. */
export function streakWeeks(dates: string[], now = Date.now()): number {
  const weeks = new Set(dates.map((x) => weekStart(new Date(x).getTime())))
  let w = weekStart(now)
  if (!weeks.has(w)) w = prevWeek(w) // la semana actual sigue abierta
  let n = 0
  while (weeks.has(w)) { n++; w = prevWeek(w) }
  return n
}
