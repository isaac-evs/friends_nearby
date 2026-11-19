/**
 * Racha: semanas SEGUIDAS con al menos un plan o evento al que fuiste. La semana va de lunes a domingo (hora local).
 * La semana en curso todavía no rompe la racha: si aún no tienes un plan esta semana, cuenta hasta la semana pasada.
 */
export const weekStart = (t: number): number => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}
const prevWeek = (ws: number): number => {
  const d = new Date(ws)
  d.setDate(d.getDate() - 7)
  return d.getTime()
}

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
