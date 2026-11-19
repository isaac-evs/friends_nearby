/**
 * Día que se está mirando en Explorar: 0 = hoy, 1 = mañana… hasta `MAX_DAY_OFFSET`. Un plan o evento cuenta en ese día si
 * su intervalo (inicio–fin) cruza el día. Hoy, lo que ya terminó no cuenta.
 */
import { planEnd, planStart, type Timed } from '@/lib/planTime'

export const MAX_DAY_OFFSET = 7

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

/** [inicio, fin) del día `offset` a partir de `now`. */
export function dayRange(offset: number, now = Date.now()): [number, number] {
  const d = new Date(startOfDay(now))
  d.setDate(d.getDate() + offset)
  const start = d.getTime()
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return [start, end.getTime()]
}

export function inDay(item: Timed, offset: number, now = Date.now()): boolean {
  const [from, to] = dayRange(offset, now)
  const s = planStart(item)
  const e = planEnd(item)
  if (offset === 0 && e <= now) return false // lo que ya terminó no es "hoy"
  return s < to && e > from
}

/** "Hoy", "Mañana" o "Vie 21". */
export function dayLabel(offset: number, now = Date.now()): string {
  if (offset === 0) return 'Hoy'
  if (offset === 1) return 'Mañana'
  const [t] = dayRange(offset, now)
  const d = new Date(t)
  const wd = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()}`
}

/** "hoy", "mañana" o "el vie 21" (para frases). */
export function dayPhrase(offset: number, now = Date.now()): string {
  if (offset === 0) return 'hoy'
  if (offset === 1) return 'mañana'
  return `el ${dayLabel(offset, now).toLowerCase()}`
}

export const DAY_OFFSETS = Array.from({ length: MAX_DAY_OFFSET + 1 }, (_, i) => i)
