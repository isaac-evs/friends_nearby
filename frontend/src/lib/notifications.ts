import type { Event, Friendship, Invite, Plan } from '@/api/schemas'

/**
 * Centro de notificaciones (§4.11). Reglas puras: arman la lista a partir del estado, agrupan y calculan el badge.
 * Nunca llevan ubicación: el texto dice "está cerca", no dónde. [PROPUESTA] el servidor las entregará ya armadas
 * (`GET /notifications`, WS `notification.new`); mientras tanto salen del estado que ya llega.
 */

export type NotificationType = 'invite' | 'friend' | 'close' | 'exact' | 'reply' | 'join' | 'checkin' | 'message' | 'changed' | 'starts' | 'near'

/** Tipos que piden una respuesta tuya: son los únicos que cuentan en el badge numérico. */
export const ACTIONABLE: readonly NotificationType[] = ['invite', 'friend', 'close', 'exact']

/** Preferencias: lo que se agrupa en "Notificaciones" del menú. In-app siempre; push opcional. */
export type PrefKey = 'invites' | 'requests' | 'activity' | 'reminders' | 'nearby'
export const PREF_GROUPS: { key: PrefKey; title: string; hint: string; types: NotificationType[] }[] = [
  { key: 'invites', title: 'Invitaciones', hint: 'Te invitan a un plan o evento y responden a tus invitaciones.', types: ['invite', 'reply'] },
  { key: 'requests', title: 'Solicitudes', hint: 'Amistad, amigo cercano y ubicación exacta.', types: ['friend', 'close', 'exact'] },
  { key: 'activity', title: 'Actividad de tus planes', hint: 'Quién se une, hace check-in, escribe o cambia la hora o el lugar.', types: ['join', 'checkin', 'message', 'changed'] },
  { key: 'reminders', title: 'Recordatorios', hint: 'Tu plan empieza en 10 minutos.', types: ['starts'] },
  { key: 'nearby', title: 'Cerca de ti', hint: 'Un amigo cercano anda a menos de 500 m. Máximo 1 por persona al día.', types: ['near'] },
]
export type NotificationPrefs = Record<PrefKey, boolean>
export const DEFAULT_PREFS: NotificationPrefs = { invites: true, requests: true, activity: true, reminders: true, nearby: false }
export const prefKeyOf = (t: NotificationType): PrefKey => PREF_GROUPS.find((g) => g.types.includes(t))!.key

export interface NotificationItem {
  id: string
  type: NotificationType
  at: string
  /** Quienes la causan (para "Mau y 2 más"). */
  userIds: string[]
  /** Plan o evento al que se refiere. */
  planId?: string
  eventId?: string
  title?: string
  /** Texto de un mensaje rápido. */
  text?: string
  /** Referencia a la invitación / solicitud para responder en línea. */
  inviteId?: string
  inviteStatus?: Invite['status']
  inviteKind?: Invite['kind']
}

export interface FeedInput {
  me: string
  now: number
  blocks: string[]
  plans: Plan[]
  events: Event[]
  invites: Invite[]
  friendships: Record<string, Friendship>
  exactRequests: string[]
  friendDistances: { userId: string; distanceM: number; updatedAt: string }[]
}

const MIN = 60_000
const DAY = 24 * 60 * MIN
export const NEAR_METERS = 500
export const STARTS_SOON_MIN = 10

const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const iso = (ms: number) => new Date(ms).toISOString()
const inPlan = (p: Plan, me: string) => p.authorId === me || !!p.memberIds?.includes(me) || !!p.roster?.some((r) => r.userId === me)

/** Todas las notificaciones que hoy se pueden armar, más recientes primero. Respeta bloqueos. */
export function buildFeed(i: FeedInput): NotificationItem[] {
  const ok = (id: string) => !i.blocks.includes(id)
  const out: NotificationItem[] = []

  for (const v of i.invites) {
    if (v.toId === i.me && ok(v.fromId)) out.push({ id: `inv:${v.id}`, type: 'invite', at: v.at, userIds: [v.fromId], title: v.title, inviteId: v.id, inviteStatus: v.status, inviteKind: v.kind, planId: v.kind === 'plan' ? v.targetId : undefined, eventId: v.kind === 'evento' ? v.targetId : undefined })
    else if (v.fromId === i.me && v.status !== 'pending' && ok(v.toId)) out.push({ id: `rep:${v.id}`, type: 'reply', at: v.at, userIds: [v.toId], title: v.title, inviteStatus: v.status, inviteKind: v.kind, planId: v.kind === 'plan' ? v.targetId : undefined, eventId: v.kind === 'evento' ? v.targetId : undefined })
  }

  for (const f of Object.values(i.friendships)) {
    if (!ok(f.userId)) continue
    if (f.status === 'requested_in') out.push({ id: `friend:${f.userId}`, type: 'friend', at: iso(i.now), userIds: [f.userId] })
    if (f.status === 'friends' && f.close === 'requested_in') out.push({ id: `close:${f.userId}`, type: 'close', at: iso(i.now), userIds: [f.userId] })
  }
  for (const uid of i.exactRequests) if (ok(uid)) out.push({ id: `exact:${uid}`, type: 'exact', at: iso(i.now), userIds: [uid] })

  for (const p of i.plans) {
    const mine = inPlan(p, i.me)
    if (!mine) continue
    const base = { planId: p.id, title: p.line }
    // Quien se une / hace check-in. Sin hora propia, "se unió" cuenta desde que se publicó o empezó (nunca en el futuro).
    const joinAt = iso(Math.min(i.now, new Date(p.startsAt).getTime()))
    if (p.authorId === i.me) {
      for (const r of p.roster ?? []) if (!r.organizer && r.userId !== i.me && ok(r.userId)) out.push({ id: `join:${p.id}:${r.userId}`, type: 'join', at: joinAt, userIds: [r.userId], ...base })
    }
    for (const r of p.roster ?? []) if (r.arrivedAt && r.userId !== i.me && ok(r.userId)) out.push({ id: `checkin:${p.id}:${r.userId}`, type: 'checkin', at: r.arrivedAt, userIds: [r.userId], ...base })
    for (const m of p.timeline ?? []) if (m.userId !== i.me && ok(m.userId)) out.push({ id: `msg:${p.id}:${m.userId}:${m.at}`, type: 'message', at: m.at, userIds: [m.userId], text: m.text, ...base })
    if (p.changedAt && p.authorId !== i.me && ok(p.authorId)) out.push({ id: `changed:${p.id}:${p.changedAt}`, type: 'changed', at: p.changedAt, userIds: [p.authorId], ...base })
    const until = (new Date(p.startsAt).getTime() - i.now) / MIN
    if (until > 0 && until <= STARTS_SOON_MIN) out.push({ id: `starts:${p.id}`, type: 'starts', at: iso(new Date(p.startsAt).getTime() - STARTS_SOON_MIN * MIN), userIds: [], ...base })
  }

  // Un cercano a menos de 500 m: 1 por persona al día. Solo amigos cercanos mutuos; solo "está cerca", nunca dónde.
  for (const d of i.friendDistances) {
    const f = i.friendships[d.userId]
    if (!f || f.status !== 'friends' || f.close !== 'mutual' || !ok(d.userId) || d.distanceM >= NEAR_METERS) continue
    out.push({ id: `near:${d.userId}:${dayKey(new Date(d.updatedAt).getTime())}`, type: 'near', at: d.updatedAt, userIds: [d.userId] })
  }

  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Quita lo que apagaste en preferencias. In-app es siempre para lo que pide respuesta (si no, te pierdes invitaciones). */
export function applyPrefs(items: NotificationItem[], prefs: NotificationPrefs): NotificationItem[] {
  return items.filter((n) => ACTIONABLE.includes(n.type) || n.type === 'reply' || prefs[prefKeyOf(n.type)] !== false)
}

/** ¿Sigue esperando tu respuesta? Una invitación ya contestada deja de ser accionable. */
export const needsAction = (n: NotificationItem) => ACTIONABLE.includes(n.type) && (n.type !== 'invite' || n.inviteStatus === 'pending')

export type Bucket = 'Hoy' | 'Esta semana' | 'Antes'
export const BUCKETS: Bucket[] = ['Hoy', 'Esta semana', 'Antes']

export function bucketOf(at: string, now: number): Bucket {
  const t = new Date(at).getTime()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  if (t >= start.getTime()) return 'Hoy'
  return t >= start.getTime() - 6 * DAY ? 'Esta semana' : 'Antes'
}

/** Una fila ya agrupada: varias personas que hicieron lo mismo en el mismo plan ("Mau y 2 más se unieron"). */
export interface NotificationGroup { key: string; type: NotificationType; items: NotificationItem[]; userIds: string[]; at: string; planId?: string; title?: string }

const GROUPABLE: NotificationType[] = ['join', 'checkin']

export function groupFeed(items: NotificationItem[]): NotificationGroup[] {
  const groups: NotificationGroup[] = []
  const byKey = new Map<string, NotificationGroup>()
  for (const n of items) {
    const key = GROUPABLE.includes(n.type) ? `${n.type}:${n.planId}` : n.id
    const g = byKey.get(key)
    if (g) { g.items.push(n); for (const u of n.userIds) if (!g.userIds.includes(u)) g.userIds.push(u); continue }
    const fresh: NotificationGroup = { key, type: n.type, items: [n], userIds: [...n.userIds], at: n.at, planId: n.planId, title: n.title }
    byKey.set(key, fresh)
    groups.push(fresh)
  }
  return groups
}

/** "Mau", "Mau y Sofi", "Mau y 2 más". */
export function namesLabel(names: string[]): string {
  if (names.length === 0) return 'Alguien'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} y ${names[1]}`
  return `${names[0]} y ${names.length - 1} más`
}

export interface Badge { count: number; unread: number; total: number; dot: boolean }
/**
 * `count` = lo que espera tu respuesta; `unread` = novedades sin leer que no piden nada; `total` = ambos (el número que se ve
 * junto a la campana). `dot` = hay novedades sin leer.
 */
export function badgeOf(items: NotificationItem[], readAt: number): Badge {
  const count = items.filter(needsAction).length
  const unread = items.filter((n) => !needsAction(n) && new Date(n.at).getTime() > readAt).length
  return { count, unread, total: count + unread, dot: unread > 0 }
}

/** Quita lo que borraste (borrado suave: se puede deshacer). Lo que pide respuesta no se puede borrar. */
export function withoutDismissed(items: NotificationItem[], dismissed: readonly string[]): NotificationItem[] {
  return items.filter((n) => needsAction(n) || !dismissed.includes(n.id))
}
