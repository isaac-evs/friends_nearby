/**
 * Zona horaria de la app: todo se muestra y se calcula en hora de Ciudad de México, sin importar la del dispositivo.
 * El servidor guarda y manda instantes en UTC (ISO); aquí se convierten a "hora de pared" de México y de regreso.
 */
export const TZ = 'America/Mexico_City'

const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export interface Wall { y: number; mo: number; d: number; h: number; mi: number; /** 0 = domingo */ dow: number }

/** Fecha y hora en México de un instante. */
export function wall(ms: number): Wall {
  const p: Record<string, string> = {}
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), dow: DOW[p.weekday!] ?? 0 }
}

/** Instante en que en México son las `h:mi` del día `y-mo-d` (mo 1–12). Acepta días fuera de rango (se normalizan). */
export function fromWall(y: number, mo: number, d: number, h = 0, mi = 0): number {
  const naive = Date.UTC(y, mo - 1, d, h, mi)
  let guess = naive
  for (let i = 0; i < 2; i++) {
    const w = wall(guess)
    guess += naive - Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi)
  }
  return guess
}

/** 00:00 (México) del día de `ms`, más `days` días. */
export function startOfDay(ms: number, days = 0): number {
  const w = wall(ms)
  return fromWall(w.y, w.mo, w.d + days)
}

/** Lunes 00:00 (México) de la semana de `ms`. */
export function startOfWeek(ms: number): number {
  const w = wall(ms)
  return fromWall(w.y, w.mo, w.d - ((w.dow + 6) % 7))
}

const pad = (n: number) => String(n).padStart(2, '0')
/** YYYY-MM-DD en México. */
export function dateKey(ms: number): string {
  const w = wall(ms)
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}`
}
/** HH:MM en México. */
export function hhmm(ms: number): string {
  const w = wall(ms)
  return `${pad(w.h)}:${pad(w.mi)}`
}

/** "YYYY-MM-DD" + "HH:MM" (hora de México) → instante, o `null` si no es una fecha/hora real. */
export function parseWall(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!d || !t || Number(t[1]) > 23 || Number(t[2]) > 59) return null
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const ms = fromWall(y, mo, da, Number(t[1]), Number(t[2]))
  const w = wall(ms)
  return w.y === y && w.mo === mo && w.d === da ? ms : null
}
