/**
 * Día que se está mirando en Explorar: 0 = hoy, 1 = mañana… hasta `MAX_DAY_OFFSET`. Un plan o evento cuenta en ese día si
 * su intervalo (inicio–fin) cruza el día. Hoy, lo que ya terminó no cuenta.
 */
import { planEnd, planStart, type Timed } from '@/lib/planTime'

export const MAX_DAY_OFFSET = 7
/** Con "Otra fecha" se puede mirar hasta un año adelante. */
export const MAX_CUSTOM_OFFSET = 365

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
  if (offset > 14) return `${d.getDate()} ${d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`
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

/** Cuántos días faltan para la fecha `YYYY-MM-DD` (0 = hoy), o `null` si no es válida o ya pasó o está a más de un año. */
export function offsetOfDate(date: string, now = Date.now()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  const days = Math.round((target - startOfDay(now)) / 86_400_000)
  return days >= 0 && days <= MAX_CUSTOM_OFFSET ? days : null
}

/** La fecha `YYYY-MM-DD` de un desplazamiento en días. */
export function dateOfOffset(offset: number, now = Date.now()): string {
  const d = new Date(dayRange(offset, now)[0])
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
