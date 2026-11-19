/** Formatos es-MX: distancias siempre aproximadas, tiempos relativos y fechas. */

export function formatApproxDistance(m: number): string {
  if (m < 1000) return `~${Math.max(100, Math.round(m / 100) * 100)} m`
  const km = m < 5000 ? Math.round(m / 500) / 2 : Math.round(m / 1000)
  return `~${Number.isInteger(km) ? km : km.toFixed(1)} km`
}

const MIN = 60_000

export function minutesLabel(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const h = Math.floor(min / 60)
  const rest = Math.round(min - h * 60)
  return rest >= 15 ? `${h} h ${rest} min` : `${h} h`
}

/** "quedan 40 min" / "en 1 h" para la card de un plan. */
export function formatPlanTime(plan: { startsAt?: string; expiresAt: string }, now = Date.now()): string {
  if (plan.startsAt) {
    const until = (new Date(plan.startsAt).getTime() - now) / MIN
    if (until > 1) return `en ${minutesLabel(until)}`
  }
  const left = (new Date(plan.expiresAt).getTime() - now) / MIN
  return left <= 0 ? 'terminó' : `quedan ${minutesLabel(left)}`
}

/** "hace 3 min" / "en vivo". */
export function formatAgo(iso: string, now = Date.now()): string {
  const min = (now - new Date(iso).getTime()) / MIN
  if (min < 1) return 'en vivo'
  if (min < 60) return `hace ${Math.round(min)} min`
  return `hace ${Math.round(min / 60)} h`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "hoy", "ayer" o "hace N días" (por día calendario, no por horas). */
export function formatLastVisit(iso: string, now = Date.now()): string {
  const day = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
  const days = Math.round((day(now) - day(new Date(iso).getTime())) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

export function weekdayLong(iso: string): string {
  return cap(new Date(iso).toLocaleDateString('es-MX', { weekday: 'long' }))
}
export function weekdayShort(iso: string): string {
  return cap(new Date(iso).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''))
}
export function dayNumber(iso: string): string {
  return String(new Date(iso).getDate())
}
export function monthShortUpper(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase()
}
export function timeLabel(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?([ap])\.?\s?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`)
}
/** "Sábado · 7:00 am" */
export function eventWhen(iso: string): string {
  return `${weekdayLong(iso)} · ${timeLabel(iso)}`
}
/** "Sáb 21 nov · 7:00 am" */
export function eventWhenShort(iso: string): string {
  const d = new Date(iso)
  const mon = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
  return `${weekdayShort(iso)} ${d.getDate()} ${mon} · ${timeLabel(iso)}`
}

/** "Sáb 21 nov · 7:00 am – 9:00 pm" (si termina otro día: "… – Dom 22 nov · 2:00 am"). Para eventos: inicio y FIN, no duración. */
export function eventRange(ev: { startsAt: string; endsAt: string }): string {
  const sameDay = new Date(ev.startsAt).toDateString() === new Date(ev.endsAt).toDateString()
  return `${eventWhenShort(ev.startsAt)} – ${sameDay ? timeLabel(ev.endsAt) : eventWhenShort(ev.endsAt)}`
}

/** Cercanía de una PERSONA en rangos, nunca un número exacto: "a menos de 500 m". */
export function formatNearby(m: number): string {
  if (m < 250) return 'a menos de 250 m'
  if (m < 500) return 'a menos de 500 m'
  if (m < 1000) return 'a menos de 1 km'
  if (m < 3000) return 'a menos de 3 km'
  if (m < 5000) return 'a menos de 5 km'
  return `a unos ${Math.round(m / 1000)} km`
}

/** "actualizado hace 12 min" solo si la ubicación lleva más de 5 min sin actualizarse; si no, cadena vacía. */
export function staleLabel(iso: string, now = Date.now()): string {
  return (now - new Date(iso).getTime()) / MIN > 5 ? `actualizado ${formatAgo(iso, now)}` : ''
}
