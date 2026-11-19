/**
 * Tiempo de un plan o evento: hora de inicio + duración (planes) u hora de fin (eventos). Fases:
 *   upcoming (aún no empieza) · live (en curso: todavía te puedes unir) · ended (ya terminó).
 */
const MIN = 60_000

export type PlanPhase = 'upcoming' | 'live' | 'ended'
/** Un plan usa `durationMin`; un evento usa `endsAt` (hora de fin). */
export interface Timed { startsAt: string; durationMin?: number; endsAt?: string }

export const planStart = (p: Timed) => new Date(p.startsAt).getTime()
export const planEnd = (p: Timed) => (p.endsAt ? new Date(p.endsAt).getTime() : planStart(p) + (p.durationMin ?? 0) * MIN)
/** Minutos entre inicio y fin. */
export const spanMin = (p: Timed) => Math.round((planEnd(p) - planStart(p)) / MIN)
export const endsAtIso = (startsAt: string, durationMin: number) => new Date(new Date(startsAt).getTime() + durationMin * MIN).toISOString()

export function planPhase(p: Timed, now = Date.now()): PlanPhase {
  if (now < planStart(p)) return 'upcoming'
  return now < planEnd(p) ? 'live' : 'ended'
}

/** Minutos hasta que empieza (negativo si ya empezó), hacia arriba. */
export const minutesUntilStart = (p: Timed, now = Date.now()) => Math.ceil((planStart(p) - now) / MIN)
/** Minutos que faltan para que termine (0 si ya terminó), hacia arriba. */
export const minutesUntilEnd = (p: Timed, now = Date.now()) => Math.max(0, Math.ceil((planEnd(p) - now) / MIN))

const clock = (t: number) =>
  new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?\s?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`)
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

/** "Hoy 7:00 pm", "Mañana 9:00 am" o "sáb 7:00 am". */
export function startLabel(startsAt: string, now = Date.now()): string {
  const t = new Date(startsAt).getTime()
  const days = Math.round((dayStart(t) - dayStart(now)) / 86_400_000)
  if (days === 0) return `Hoy ${clock(t)}`
  if (days === 1) return `Mañana ${clock(t)}`
  const wd = new Date(t).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')
  return `${wd} ${clock(t)}`
}

export function durationText(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function span(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const r = min - h * 60
  return r >= 15 ? `${h} h ${r} min` : `${h} h`
}

/** "empieza en 25 min" · "en curso · termina en 40 min" · "ya terminó". */
export function countdownLabel(p: Timed, now = Date.now()): string {
  const ph = planPhase(p, now)
  if (ph === 'upcoming') return `empieza en ${span(Math.max(1, minutesUntilStart(p, now)))}`
  if (ph === 'live') return `en curso · termina en ${span(Math.max(1, minutesUntilEnd(p, now)))}`
  return 'ya terminó'
}

/**
 * Hora "HH:MM" de hoy → ISO, o `null` si ya pasó (o es inválida). Sirve para "Otra hora" al publicar.
 */
export function timeTodayIso(hhmm: string, now = Date.now()): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  const d = new Date(now)
  d.setHours(h, mi, 0, 0)
  return d.getTime() >= now - MIN ? d.toISOString() : null
}

/**
 * ¿Se puede verificar que "estamos juntos"? Desde 30 min antes del inicio hasta que termina el plan.
 */
export const VERIFY_LEAD_MIN = 30
export function verifyWindow(p: Timed, now = Date.now()): 'early' | 'open' | 'closed' {
  if (now < planStart(p) - VERIFY_LEAD_MIN * MIN) return 'early'
  return now < planEnd(p) ? 'open' : 'closed'
}


/**
 * Inicio y fin de un evento a partir de la fecha (YYYY-MM-DD) y las horas "HH:MM". Si la hora de fin no es mayor que la de
 * inicio, el evento termina al día siguiente. `null` si algo no es válido.
 */
export function eventTimes(date: string, startHHMM: string, endHHMM: string): { startsAt: string; endsAt: string } | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const a = /^(\d{1,2}):(\d{2})$/.exec(startHHMM)
  const b = /^(\d{1,2}):(\d{2})$/.exec(endHHMM)
  if (!d || !a || !b) return null
  const [y, mo, da] = [Number(d[1]), Number(d[2]) - 1, Number(d[3])]
  const start = new Date(y, mo, da, Number(a[1]), Number(a[2]), 0, 0)
  const end = new Date(y, mo, da, Number(b[1]), Number(b[2]), 0, 0)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1)
  return { startsAt: start.toISOString(), endsAt: end.toISOString() }
}

/** "4:30 pm" de un instante ISO. */
export const clockLabel = (iso: string): string => clock(new Date(iso).getTime())
