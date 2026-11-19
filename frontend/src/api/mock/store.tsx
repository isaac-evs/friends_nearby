/**
 * Estado global del mock (sin backend). Reducer puro + acciones. Solo persistimos preferencias

 * no sensibles (sesión, permiso de ubicación, modo fantasma, modo abierto, bloqueos, radios): jamás coordenadas.
 * Los datos iniciales llegan de `api/client.ts` (`Bootstrap`); el store no importa el mock.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type {
  Attendance, Availability, Badge, CloseStatus, Event, EventType, ExactShare, Friendship, Invite, JoinPolicy, Match, Plan, PlanCategory, PlanHistoryItem, PlanPlace, Presence, SwipeAction, User, XpEvent,
} from '@/api/schemas'
import type { Bootstrap } from '@/api/client'
import { ME_ID } from '@/api/me'
import { roundToCell, type LatLng } from '@/lib/geo'
import type { ImageKind } from '@/lib/image'
import { MAX_LEVEL } from '@/lib/levels'
import { historyDates } from '@/lib/history'
import { endsAtIso, eventTimes } from '@/lib/planTime'
import { commitmentsOf, findConflict, joinBlock } from '@/lib/commitments'
import { MAX_DAY_OFFSET } from '@/lib/day'
import { DEFAULT_RADIUS, DEFAULT_VISIBILITY_RADIUS } from '@/lib/reach'
import { streakWeeks } from '@/lib/streak'
import { PLAN_CATEGORIES } from '@/lib/category'

export type LocationStatus = 'unknown' | 'granted' | 'denied' | 'manual'
export interface OpenMode { enabled: boolean; adult: boolean; bigEvents: boolean; smallPlans: boolean }

export interface EventDraft {
  type: EventType; title: string
  /** Fecha (YYYY-MM-DD) y hora (HH:MM, 24 h) de inicio, elegidas por quien organiza. */
  date: string; time: string
  /** Hora de fin (HH:MM). Si es menor o igual que la de inicio, el evento termina al día siguiente. */
  endTime: string
  place: string
  /** ¿Se puede unir gente con el evento en curso? */
  lateJoin: boolean
  /** Amigos a los que se invita al publicar. */
  inviteIds: string[]
  /** Punto exacto del lugar, marcado en el mapa. */
  placeCenter?: LatLng
  /** Alias del organizador (un club, un grupo). El nombre real siempre se muestra aparte. */
  alias: string
  photoUrl?: string
  capacity: number; requiresApproval: boolean
}

export interface AppState {
  session: { email: string } | null
  /** `center`: mi ubicación aproximada (celda redondeada). Solo en memoria: nunca se guarda en el navegador. */
  location: { status: LocationStatus; center: LatLng }
  ghost: boolean
  openMode: OpenMode
  xp: number
  xpGoal: number
  users: Record<string, User>
  friendships: Record<string, Friendship>
  plans: Plan[]
  events: Event[]
  swipes: Record<string, SwipeAction>
  matches: Match[]
  /** Cuánto te alejas al buscar planes, eventos y amigos (metros). Se puede ampliar. */
  radiusM: number
  /** Invitaciones a planes y eventos (recibidas y enviadas). */
  invites: Invite[]
  /** Mi ubicación exacta que comparto AHORA con amigos cercanos (temporal; nunca se guarda). */
  exactShares: ExactShare[]
  /** La ubicación exacta que mis amigos cercanos comparten conmigo ahora (temporal). */
  exactGrants: ExactShare[]
  /** Personas a las que les pedí su ubicación exacta y aún no responden. */
  exactPending: string[]
  /** Planes y eventos a los que fuiste (historial privado). Alimenta la racha. */
  history: PlanHistoryItem[]
  attendances: Attendance[]
  xpEvents: XpEvent[]
  blocks: string[]
  reports: { userId: string; reason: string }[]
  /** Dónde está cada amigo cercano ahora (celda aproximada). */
  presence: Presence[]
  badges: Badge[]
  /** Quién más va a cada evento. */
  attendees: Record<string, string[]>
  /** Qué tan lejos pueden estar mis amigos cercanos para verme (metros). 3 km por defecto. */
  visibilityRadiusM: number
  /** Día que se mira en Explorar y el mapa: 0 = hoy, 1 = mañana… Solo en memoria. */
  dayOffset: number
  eventDraft: EventDraft | null
}

/** MOCK de lo que haría la otra persona: cuánto tarda en contestar y quién nunca contesta. */
const MOCK_REPLY_MS = 3000
const MOCK_NEVER_ANSWERS = new Set(['regina'])

const PERSIST_KEY = 'jalas.mock.v1'
interface Persisted {
  session: AppState['session']; location: { status: LocationStatus }; ghost: boolean; openMode: OpenMode; blocks: string[]
  /** Preferencia no sensible: con quién eres amigo cercano (solo `mutual` o `none`). Nunca coordenadas. */
  close: Record<string, CloseStatus>
  radiusM: number
  visibilityRadiusM: number
}

/** Versión anterior guardaba `closeness`. */
const legacy = (p: Partial<Persisted>) => (p as { closeness?: Record<string, unknown> }).closeness

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
  } catch {
    return {}
  }
}

/** Lee lo guardado, incluidas versiones anteriores ("cercano" → mutual, "amigo"/"conocido" → none). Lo demás se ignora. */
const savedClose = (v: unknown): CloseStatus | undefined => (v === 'mutual' || v === 'cercano' ? 'mutual' : v === 'none' || v === 'amigo' || v === 'conocido' ? 'none' : undefined)

const keyOf = (kind: 'plan' | 'event', id: string) => `${kind}:${id}`
const byId = <T extends { id: string }>(l: T[]) => Object.fromEntries(l.map((x) => [x.id, x]))

/** Mi racha sale del historial (no es un número suelto). */
function withStreak(users: Record<string, User>, history: PlanHistoryItem[]): Record<string, User> {
  return { ...users, [ME_ID]: { ...users[ME_ID]!, streakWeeks: streakWeeks(historyDates(history)) } }
}

export function initialState(b: Bootstrap): AppState {
  const p = loadPersisted()
  return {
    session: p.session ?? null,
    location: { status: p.location?.status ?? 'unknown', center: b.myCenter },
    ghost: p.ghost ?? false,
    openMode: p.openMode ?? { enabled: false, adult: false, bigEvents: true, smallPlans: false },
    xp: 340,
    xpGoal: 500,
    users: withStreak(byId(b.users), b.history),
    friendships: Object.fromEntries(b.friendships.map((f) => [f.userId, { ...f, close: savedClose(p.close?.[f.userId] ?? legacy(p)?.[f.userId]) ?? f.close }])),
    plans: b.plans,
    events: b.events,
    swipes: {},
    matches: [],
    radiusM: p.radiusM ?? DEFAULT_RADIUS,
    invites: b.invites,
    exactShares: [],
    exactGrants: [],
    exactPending: [],
    history: b.history,
    attendances: [],
    xpEvents: [],
    blocks: p.blocks ?? [],
    reports: [],
    presence: b.presence,
    badges: b.badges,
    attendees: b.attendees,
    visibilityRadiusM: p.visibilityRadiusM ?? DEFAULT_VISIBILITY_RADIUS,
    dayOffset: 0,
    eventDraft: null,
  }
}

type Action =
  | { type: 'signIn'; email: string; name?: string }
  | { type: 'signOut' }
  | { type: 'setLocation'; status: LocationStatus; center?: LatLng }
  | { type: 'setAvailability'; availability: Availability | null }
  | { type: 'setVisibilityRadius'; radiusM: number }
  | { type: 'setDay'; offset: number }
  | { type: 'toggleGhost' }
  | { type: 'setOpenMode'; patch: Partial<OpenMode> }
  | { type: 'swipe'; kind: 'plan' | 'event'; id: string; action: SwipeAction }
  | { type: 'resetSwipes'; kind: 'plan' | 'event' }
  | { type: 'jalo'; plan: Plan; match: Match }
  | { type: 'quickMessage'; matchId: string; message: string }
  | { type: 'confirmMeet'; matchId: string; who: 'me' | 'them' }
  | { type: 'addPlan'; plan: Plan }
  | { type: 'updatePlan'; id: string; startsAt: string; durationMin: number }
  | { type: 'removePlan'; id: string }
  | { type: 'addEvent'; event: Event }
  | { type: 'saveDraft'; draft: EventDraft | null }
  | { type: 'joinEvent'; eventId: string; pace?: string }
  | { type: 'leaveEvent'; eventId: string }
  | { type: 'setPace'; eventId: string; pace: string }
  | { type: 'friendStatus'; userId: string; status: Friendship['status'] }
  | { type: 'block'; userId: string }
  | { type: 'report'; userId: string; reason: string }
  | { type: 'removeFriend'; userId: string }
  | { type: 'close'; userId: string; op: 'request' | 'cancel' | 'accept' | 'decline' | 'remove' | 'accepted' }
  | { type: 'exactStart'; userId: string; until: string }
  | { type: 'exactStop'; userId: string }
  | { type: 'exactAsk'; userId: string }
  | { type: 'exactAskCancel'; userId: string }
  | { type: 'exactGrant'; userId: string; until: string }
  | { type: 'verifyTogether'; matchId: string }
  | { type: 'setHandle'; handle: string }
  | { type: 'setRadius'; radiusM: number }
  | { type: 'invites'; list: Invite[] }
  | { type: 'inviteStatus'; id: string; status: Invite['status'] }
  | { type: 'setName'; name: string }
  | { type: 'setBio'; bio: string }
  | { type: 'setImage'; kind: ImageKind; url: string | null }

/** Corta toda ubicación exacta (compartida, recibida o pedida) con esa persona. */
function clearExact(s: AppState, userId: string): AppState {
  return {
    ...s,
    exactShares: s.exactShares.filter((x) => x.userId !== userId),
    exactGrants: s.exactGrants.filter((x) => x.userId !== userId),
    exactPending: s.exactPending.filter((x) => x !== userId),
  }
}

/** Suma (o resta) XP. Nunca baja de nivel ni de 0 XP; el nivel 100 es el máximo y deja la barra llena. */
export function addXp(s: AppState, amount: number, reason: string): AppState {
  let xp = s.xp + amount
  let me = s.users[ME_ID]!
  while (xp >= s.xpGoal && me.level < MAX_LEVEL) {
    xp -= s.xpGoal
    me = { ...me, level: me.level + 1 }
  }
  xp = me.level >= MAX_LEVEL ? s.xpGoal : Math.max(0, xp)
  const ev: XpEvent = { id: `xp-${s.xpEvents.length + 1}`, amount, reason, at: new Date().toISOString() }
  return { ...s, xp, users: { ...s.users, [ME_ID]: me }, xpEvents: [...s.xpEvents, ev] }
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'signIn': {
      const users = a.name ? { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, name: a.name } } : s.users
      return { ...s, users, session: { email: a.email } }
    }
    case 'signOut':
      return { ...s, session: null }
    case 'setLocation':
      return { ...s, location: { status: a.status, center: a.center ? roundToCell(a.center) : s.location.center } }
    case 'setAvailability': {
      const me = { ...s.users[ME_ID]! }
      if (a.availability) me.availability = a.availability
      else delete me.availability
      return { ...s, users: { ...s.users, [ME_ID]: me } }
    }
    case 'setDay':
      return { ...s, dayOffset: Math.min(MAX_DAY_OFFSET, Math.max(0, Math.round(a.offset))) }
    case 'setVisibilityRadius':
      return { ...s, visibilityRadiusM: a.radiusM }
    case 'toggleGhost':
      // Al esconderte se corta TODA ubicación exacta: la que compartías y la que te compartían (en fantasma tampoco ves a tus cercanos).
      return s.ghost ? { ...s, ghost: false } : { ...s, ghost: true, exactShares: [], exactGrants: [], exactPending: [] }
    case 'setOpenMode':
      return { ...s, openMode: { ...s.openMode, ...a.patch } }
    case 'swipe':
      return { ...s, swipes: { ...s.swipes, [keyOf(a.kind, a.id)]: a.action } }
    case 'resetSwipes': {
      // Solo se recupera lo descartado con "Paso"; lo guardado ("Luego") y lo ya jalado se conserva.
      const swipes = Object.fromEntries(Object.entries(s.swipes).filter(([k, v]) => !(k.startsWith(`${a.kind}:`) && v === 'pass')))
      return { ...s, swipes }
    }
    case 'jalo': {
      if (s.matches.some((m) => m.planId === a.plan.id)) return s
      // Solo un plan a la vez, y no a uno que ya terminó o que no admite gente una vez en curso.
      if (joinBlock(s, a.plan, `plan:${a.plan.id}`)) return s
      return {
        ...s,
        swipes: { ...s.swipes, [keyOf('plan', a.plan.id)]: 'join' },
        matches: [...s.matches, a.match],
        plans: s.plans.map((p) => (p.id === a.plan.id ? { ...p, joinedCount: p.joinedCount + 1 } : p)),
      }
    }
    case 'quickMessage':
      return { ...s, matches: s.matches.map((m) => (m.id === a.matchId ? { ...m, quickMessage: a.message } : m)) }
    case 'confirmMeet': {
      let next: AppState = {
        ...s,
        matches: s.matches.map((m) =>
          m.id === a.matchId ? { ...m, myConfirmed: a.who === 'me' ? true : m.myConfirmed, theirConfirmed: a.who === 'them' ? true : m.theirConfirmed } : m,
        ),
      }
      const m = next.matches.find((x) => x.id === a.matchId)
      // XP y racha solo cuando AMBOS confirman (brief).
      if (m && m.myConfirmed && m.theirConfirmed && !m.rewarded) {
        next = addXp({ ...next, matches: next.matches.map((x) => (x.id === m.id ? { ...x, rewarded: true } : x)) }, 20, 'Ya nos vimos')
        const me = next.users[ME_ID]!
        // El plan entra al historial (título, lugar público y quién fue; nunca coordenadas) y la racha se recalcula:
        // semanas seguidas con al menos un plan o evento.
        const plan = next.plans.find((p) => p.id === m.planId)
        const history = plan
          ? [...next.history, { id: `hist-${m.id}`, kind: 'plan' as const, title: plan.line, categoryLabel: PLAN_CATEGORIES[plan.category].label, placeName: m.meetPoint, at: new Date().toISOString(), attendeeIds: [m.friendId] }]
          : next.history
        next = { ...next, history, users: { ...next.users, [ME_ID]: { ...me, streakWeeks: streakWeeks(historyDates(history)), hangouts: me.hangouts + 1 } } }
      }
      return next
    }
    case 'addPlan':
      if (findConflict(commitmentsOf(s), a.plan)) return s
      return { ...s, plans: [a.plan, ...s.plans] }
    case 'updatePlan':
      // Solo puedes cambiar la hora de TUS planes, y sin traslapar con otro compromiso.
      if (findConflict(commitmentsOf(s), a, `plan:${a.id}`)) return s
      return { ...s, plans: s.plans.map((p) => (p.id === a.id && p.authorId === ME_ID ? { ...p, startsAt: a.startsAt, durationMin: a.durationMin, expiresAt: endsAtIso(a.startsAt, a.durationMin) } : p)) }
    case 'removePlan':
      return { ...s, plans: s.plans.filter((p) => p.id !== a.id) }
    case 'addEvent':
      if (findConflict(commitmentsOf(s), a.event)) return s
      return { ...s, events: [a.event, ...s.events], eventDraft: null }
    case 'saveDraft':
      return { ...s, eventDraft: a.draft }
    case 'joinEvent': {
      const ev = s.events.find((e) => e.id === a.eventId)
      if (!ev || s.attendances.some((x) => x.eventId === a.eventId)) return s
      if (joinBlock(s, ev, `event:${ev.id}`)) return s
      const pending = ev.requiresApproval
      const att: Attendance = { eventId: a.eventId, pace: a.pace, joinedAt: new Date().toISOString(), status: pending ? 'pending' : 'going' }
      const next = { ...s, attendances: [...s.attendances, att] }
      return pending ? next : { ...next, events: s.events.map((e) => (e.id === ev.id ? { ...e, going: e.going + 1 } : e)) }
    }
    case 'leaveEvent': {
      const att = s.attendances.find((x) => x.eventId === a.eventId)
      if (!att) return s
      return {
        ...s,
        attendances: s.attendances.filter((x) => x.eventId !== a.eventId),
        events: att.status === 'going' ? s.events.map((e) => (e.id === a.eventId ? { ...e, going: Math.max(0, e.going - 1) } : e)) : s.events,
      }
    }
    case 'setPace':
      return { ...s, attendances: s.attendances.map((x) => (x.eventId === a.eventId ? { ...x, pace: a.pace } : x)) }
    case 'friendStatus': {
      const cur = s.friendships[a.userId]
      // Un amigo nuevo entra como "Amigo": no ve tu ubicación hasta que lo subas a "Cercano".
      const keepsClose = cur?.status === 'friends' && a.status === 'friends'
      const f: Friendship = cur
        ? { ...cur, status: a.status, close: keepsClose ? cur.close : 'none' }
        : { userId: a.userId, status: a.status, mutualFriendIds: [], locationPaused: false, close: 'none' }
      const next = { ...s, friendships: { ...s.friendships, [a.userId]: f } }
      return keepsClose ? next : clearExact(next, a.userId)
    }
    case 'block': {
      if (s.blocks.includes(a.userId)) return s
      const cur = s.friendships[a.userId]
      const next = { ...s, blocks: [...s.blocks, a.userId], friendships: cur ? { ...s.friendships, [a.userId]: { ...cur, close: 'none' as const } } : s.friendships }
      return clearExact(next, a.userId)
    }
    case 'report':
      return { ...s, reports: [...s.reports, { userId: a.userId, reason: a.reason }] }
    case 'close': {
      const cur = s.friendships[a.userId]
      if (cur?.status !== 'friends') return s
      const from = cur.close
      const to: CloseStatus | null =
        a.op === 'request' && from === 'none' ? 'requested_out'
        : a.op === 'cancel' && from === 'requested_out' ? 'none'
        : a.op === 'accept' && from === 'requested_in' ? 'mutual'
        : a.op === 'decline' && from === 'requested_in' ? 'none'
        : a.op === 'remove' && from === 'mutual' ? 'none'
        : a.op === 'accepted' && from === 'requested_out' ? 'mutual' // mock: la otra persona aceptó
        : null
      if (!to) return s
      const next = { ...s, friendships: { ...s.friendships, [a.userId]: { ...cur, close: to } } }
      return to === 'mutual' ? next : clearExact(next, a.userId)
    }
    case 'exactStart': {
      // Solo entre amigos cercanos, nunca en modo fantasma, y siempre con fin.
      if (s.ghost || s.friendships[a.userId]?.close !== 'mutual' || !(new Date(a.until).getTime() > Date.now())) return s
      return { ...s, exactShares: [...s.exactShares.filter((x) => x.userId !== a.userId), { userId: a.userId, until: a.until }] }
    }
    case 'exactStop':
      return { ...s, exactShares: s.exactShares.filter((x) => x.userId !== a.userId) }
    case 'exactAsk':
      if (s.ghost || s.friendships[a.userId]?.close !== 'mutual' || s.exactPending.includes(a.userId)) return s
      return { ...s, exactPending: [...s.exactPending, a.userId] }
    case 'exactAskCancel':
      return { ...s, exactPending: s.exactPending.filter((x) => x !== a.userId) }
    case 'exactGrant': {
      if (!s.exactPending.includes(a.userId) || s.friendships[a.userId]?.close !== 'mutual') return s
      return { ...s, exactPending: s.exactPending.filter((x) => x !== a.userId), exactGrants: [...s.exactGrants.filter((x) => x.userId !== a.userId), { userId: a.userId, until: a.until }] }
    }
    case 'verifyTogether':
      return { ...s, matches: s.matches.map((m) => (m.id === a.matchId && !m.togetherAt ? { ...m, togetherAt: new Date().toISOString() } : m)) }
    case 'setRadius':
      return { ...s, radiusM: a.radiusM }
    case 'invites':
      return { ...s, invites: [...a.list, ...s.invites] }
    case 'inviteStatus': {
      const inv = s.invites.find((i) => i.id === a.id)
      if (!inv || inv.status !== 'pending') return s
      let next: AppState = { ...s, invites: s.invites.map((i) => (i.id === a.id ? { ...i, status: a.status } : i)) }
      // Si alguien aceptó TU invitación, suma a quienes van.
      if (inv.fromId === ME_ID && a.status === 'accepted') {
        next = inv.kind === 'plan'
          ? { ...next, plans: next.plans.map((p) => (p.id === inv.targetId ? { ...p, joinedCount: p.joinedCount + 1 } : p)) }
          : { ...next, events: next.events.map((e) => (e.id === inv.targetId ? { ...e, going: e.going + 1 } : e)) }
      }
      return next
    }
    case 'setHandle':
      return { ...s, users: { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, handle: `@${a.handle}` } } }
    case 'removeFriend': {
      // Sin notificar a la otra persona. Deja de verse en cercanos, mapa y ranking.
      const cur = s.friendships[a.userId]
      if (cur?.status !== 'friends') return s
      return clearExact({ ...s, friendships: { ...s.friendships, [a.userId]: { ...cur, status: 'none', close: 'none' } } }, a.userId)
    }
    case 'setName':
      return { ...s, users: { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, name: a.name } } }
    case 'setBio': {
      const me = { ...s.users[ME_ID]! }
      if (a.bio) me.bio = a.bio
      else delete me.bio
      return { ...s, users: { ...s.users, [ME_ID]: me } }
    }
    case 'setImage': {
      const key = a.kind === 'avatar' ? 'avatarUrl' : 'coverUrl'
      const me = { ...s.users[ME_ID]! }
      if (a.url) me[key] = a.url
      else delete me[key]
      return { ...s, users: { ...s.users, [ME_ID]: me } }
    }
  }
}

export interface Actions {
  signIn: (email: string, name?: string) => void
  signOut: () => void
  setLocation: (status: LocationStatus, center?: LatLng) => void
  /** Cómo estás (o `null` para no mostrar nada). No cambia quién ve tu ubicación. */
  setAvailability: (availability: Availability | null) => void
  /** Día que se mira (0 = hoy, 1 = mañana…). */
  setDay: (offset: number) => void
  /** Qué tan lejos pueden estar tus amigos cercanos para verte. */
  setVisibilityRadius: (radiusM: number) => void
  toggleGhost: () => void
  setOpenMode: (patch: Partial<OpenMode>) => void
  swipe: (kind: 'plan' | 'event', id: string, action: SwipeAction) => void
  resetSwipes: (kind: 'plan' | 'event') => void
  jalo: (planId: string) => string | null
  setQuickMessage: (matchId: string, message: string) => void
  confirmMeet: (matchId: string, who: 'me' | 'them') => void
  /**
   * Publica un plan (el lugar es obligatorio). Devuelve `null` si choca con otro plan/evento tuyo (solo uno a la vez).
   * `inviteIds`: amigos a los que se invita (en el mock responden solos a los pocos segundos).
   */
  publishPlan: (input: { category: PlanCategory; line: string; startsAt: string; durationMin: number; joinPolicy: JoinPolicy; place: PlanPlace; capacity?: number; photoUrl?: string; lateJoin: boolean; inviteIds: string[] }) => Plan | null
  /** Invita a amigos a UNO DE TUS planes (los que ya tienen invitación se omiten). Devuelve a cuántos invitó. */
  invitePeople: (planId: string, ids: string[]) => number
  /** Cambia la hora o la duración de uno de tus planes. */
  updatePlan: (id: string, startsAt: string, durationMin: number) => void
  removePlan: (id: string) => void
  publishEvent: (draft: EventDraft) => Event | null
  saveDraft: (draft: EventDraft | null) => void
  joinEvent: (eventId: string, pace?: string) => void
  leaveEvent: (eventId: string) => void
  setPace: (eventId: string, pace: string) => void
  setFriendStatus: (userId: string, status: Friendship['status']) => void
  block: (userId: string) => void
  report: (userId: string, reason: string) => void
  /** Elimina la amistad sin avisar a la otra persona. */
  removeFriend: (userId: string) => void
  /** Amigo cercano = solicitud aparte y mutua. En el mock la otra persona responde sola (ver MOCK_*). */
  requestClose: (userId: string) => void
  cancelClose: (userId: string) => void
  acceptClose: (userId: string) => void
  declineClose: (userId: string) => void
  removeClose: (userId: string) => void
  /** Compartir MI ubicación exacta con un amigo cercano por `minutes` (temporal, se apaga sola). */
  startExact: (userId: string, minutes: number) => void
  stopExact: (userId: string) => void
  /** Pedirle su ubicación exacta (la otra persona decide; en el mock acepta sola). */
  askExact: (userId: string) => void
  cancelAskExact: (userId: string) => void
  /** Verifica que están en el punto de encuentro. La ubicación la ve solo el sistema, una sola vez. */
  verifyTogether: (matchId: string) => void
  updateHandle: (handle: string) => void
  /** Cambia el rango de búsqueda (metros). */
  setRadius: (radiusM: number) => void
  /** Acepta o rechaza una invitación recibida. Si aceptas un plan, te une (`matchId`); si no se puede, dice por qué. */
  respondInvite: (id: string, accept: boolean) => { ok: boolean; reason?: string; matchId?: string }
  updateName: (name: string) => void
  updateBio: (bio: string) => void
  /** Cambia o quita la foto de perfil / portada. Libera la URL de objeto anterior. */
  setProfileImage: (kind: ImageKind, url: string | null) => void
}

interface Ctx { state: AppState; actions: Actions }
const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children, data }: { children: ReactNode; data: Bootstrap }) {
  const [state, dispatch] = useReducer(reducer, data, initialState)
  // Estado más reciente para acciones que lo leen sin volver a crear `actions`.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    // Solo `mutual` o `none`: las solicitudes pendientes no se guardan (y el seed vuelve a ponerlas).
    const close = Object.fromEntries(Object.values(state.friendships).filter((f) => f.close === 'mutual' || f.close === 'none').map((f) => [f.userId, f.close]))
    const p: Persisted = { session: state.session, location: { status: state.location.status }, ghost: state.ghost, openMode: state.openMode, blocks: state.blocks, close, radiusM: state.radiusM, visibilityRadiusM: state.visibilityRadiusM }
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(p)) } catch { /* sin storage: seguimos en memoria */ }
  }, [state.session, state.location, state.ghost, state.openMode, state.blocks, state.friendships, state.radiusM, state.visibilityRadiusM])

  /** Unirse a un plan ("Jalo"): respeta "un plan a la vez", que no haya terminado y si admite gente en curso. */
  const joinPlan = (planId: string): string | null => {
    const st = stateRef.current
    const plan = st.plans.find((p) => p.id === planId)
    if (!plan) return null
    if (joinBlock(st, plan, `plan:${plan.id}`)) return null
    const id = `match-${planId}`
    const match: Match = {
      id, planId, friendId: plan.authorId, createdAt: new Date().toISOString(), togetherAt: null,
      meetPoint: plan.place.name, quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false,
    }
    dispatch({ type: 'jalo', plan, match })
    return id
  }

  /** Manda invitaciones. MOCK de la otra persona: contesta sola a los pocos segundos (Regina siempre dice que no). */
  const sendInvites = (kind: Invite['kind'], targetId: string, title: string, ids: string[]) => {
    if (ids.length === 0) return
    const at = new Date().toISOString()
    const list: Invite[] = ids.map((toId) => ({ id: `inv-${targetId}-${toId}`, kind, targetId, title, fromId: ME_ID, toId, status: 'pending', at }))
    dispatch({ type: 'invites', list })
    list.forEach((inv, i) => window.setTimeout(() => dispatch({ type: 'inviteStatus', id: inv.id, status: MOCK_NEVER_ANSWERS.has(inv.toId) ? 'declined' : 'accepted' }), MOCK_REPLY_MS + i * 700))
  }

  const actions = useMemo<Actions>(() => ({
    signIn: (email, name) => dispatch({ type: 'signIn', email, name }),
    signOut: () => dispatch({ type: 'signOut' }),
    setLocation: (status, center) => dispatch({ type: 'setLocation', status, center }),
    setAvailability: (availability) => dispatch({ type: 'setAvailability', availability }),
    setDay: (offset) => dispatch({ type: 'setDay', offset }),
    setVisibilityRadius: (radiusM) => dispatch({ type: 'setVisibilityRadius', radiusM }),
    toggleGhost: () => dispatch({ type: 'toggleGhost' }),
    setOpenMode: (patch) => dispatch({ type: 'setOpenMode', patch }),
    swipe: (kind, id, action) => dispatch({ type: 'swipe', kind, id, action }),
    resetSwipes: (kind) => dispatch({ type: 'resetSwipes', kind }),
    jalo: (planId) => joinPlan(planId),
    setQuickMessage: (matchId, message) => dispatch({ type: 'quickMessage', matchId, message }),
    confirmMeet: (matchId, who) => dispatch({ type: 'confirmMeet', matchId, who }),
    publishPlan: ({ category, line, startsAt, durationMin, joinPolicy, place, capacity, photoUrl, lateJoin, inviteIds }) => {
      const st = stateRef.current
      if (findConflict(commitmentsOf(st), { startsAt, durationMin })) return null
      const plan: Plan = {
        id: `plan-me-${Date.now()}`, authorId: ME_ID, category, line, startsAt, durationMin, expiresAt: endsAtIso(startsAt, durationMin),
        joinPolicy, joinedCount: 0, capacity, lateJoin,
        // El lugar es un punto de encuentro que tú escoges (exacto), no tu ubicación.
        place, photoUrl,
      }
      dispatch({ type: 'addPlan', plan })
      sendInvites('plan', plan.id, plan.line, inviteIds)
      return plan
    },
    invitePeople: (planId, ids) => {
      const st = stateRef.current
      const plan = st.plans.find((p) => p.id === planId && p.authorId === ME_ID)
      if (!plan) return 0
      const fresh = ids.filter((id) => !st.invites.some((i) => i.targetId === planId && i.toId === id))
      sendInvites('plan', plan.id, plan.line, fresh)
      return fresh.length
    },
    removePlan: (id) => dispatch({ type: 'removePlan', id }),
    updatePlan: (id, startsAt, durationMin) => dispatch({ type: 'updatePlan', id, startsAt, durationMin }),
    publishEvent: (d) => {
      const times = eventTimes(d.date, d.time, d.endTime)
      if (!times || !d.placeCenter) return null
      const st = stateRef.current
      if (findConflict(commitmentsOf(st), times)) return null
      const ev: Event = {
        id: `evt-me-${Date.now()}`, type: d.type, subtype: '', title: d.title.trim() || 'Evento sin nombre', ...times,
        placeName: d.place.trim() || 'Lugar sin nombre', center: d.placeCenter,
        capacity: d.capacity, going: 1,
        // Tu nombre real siempre va; el alias es solo cómo te presentas.
        organizer: { name: st.users[ME_ID]!.name, alias: d.alias.trim() || undefined, verified: false, eventsCount: 1 }, organizerId: ME_ID,
        photoUrl: d.photoUrl, lateJoin: d.lateJoin,
        requiresApproval: d.requiresApproval, friendsGoingIds: [], xp: 40,
      }
      dispatch({ type: 'addEvent', event: ev })
      sendInvites('evento', ev.id, ev.title, d.inviteIds)
      return ev
    },
    saveDraft: (draft) => dispatch({ type: 'saveDraft', draft }),
    joinEvent: (eventId, pace) => dispatch({ type: 'joinEvent', eventId, pace }),
    leaveEvent: (eventId) => dispatch({ type: 'leaveEvent', eventId }),
    setPace: (eventId, pace) => dispatch({ type: 'setPace', eventId, pace }),
    setFriendStatus: (userId, status) => dispatch({ type: 'friendStatus', userId, status }),
    block: (userId) => dispatch({ type: 'block', userId }),
    report: (userId, reason) => dispatch({ type: 'report', userId, reason }),
    removeFriend: (userId) => dispatch({ type: 'removeFriend', userId }),
    requestClose: (userId) => {
      dispatch({ type: 'close', userId, op: 'request' })
      // MOCK de la otra persona: acepta a los pocos segundos, salvo quien "nunca contesta" (para ver el estado pendiente).
      if (MOCK_NEVER_ANSWERS.has(userId)) return
      window.setTimeout(() => {
        if (stateRef.current.friendships[userId]?.close === 'requested_out') dispatch({ type: 'close', userId, op: 'accepted' })
      }, MOCK_REPLY_MS)
    },
    cancelClose: (userId) => dispatch({ type: 'close', userId, op: 'cancel' }),
    acceptClose: (userId) => dispatch({ type: 'close', userId, op: 'accept' }),
    declineClose: (userId) => dispatch({ type: 'close', userId, op: 'decline' }),
    removeClose: (userId) => dispatch({ type: 'close', userId, op: 'remove' }),
    startExact: (userId, minutes) => dispatch({ type: 'exactStart', userId, until: new Date(Date.now() + minutes * 60_000).toISOString() }),
    stopExact: (userId) => dispatch({ type: 'exactStop', userId }),
    askExact: (userId) => {
      dispatch({ type: 'exactAsk', userId })
      // MOCK de la otra persona: comparte 1 h a los pocos segundos.
      window.setTimeout(() => {
        if (stateRef.current.exactPending.includes(userId)) dispatch({ type: 'exactGrant', userId, until: new Date(Date.now() + 60 * 60_000).toISOString() })
      }, MOCK_REPLY_MS)
    },
    cancelAskExact: (userId) => dispatch({ type: 'exactAskCancel', userId }),
    verifyTogether: (matchId) => dispatch({ type: 'verifyTogether', matchId }),
    updateHandle: (handle) => dispatch({ type: 'setHandle', handle }),
    setRadius: (radiusM) => dispatch({ type: 'setRadius', radiusM }),
    respondInvite: (id, accept) => {
      const st = stateRef.current
      const inv = st.invites.find((i) => i.id === id && i.toId === ME_ID && i.status === 'pending')
      if (!inv) return { ok: false, reason: 'La invitación ya no está.' }
      if (!accept) { dispatch({ type: 'inviteStatus', id, status: 'declined' }); return { ok: true } }
      if (inv.kind === 'plan') {
        const plan = st.plans.find((p) => p.id === inv.targetId)
        if (!plan) return { ok: false, reason: 'El plan ya no existe.' }
        const reason = joinBlock(st, plan, `plan:${plan.id}`)
        if (reason) return { ok: false, reason }
        const matchId = joinPlan(plan.id)
        dispatch({ type: 'inviteStatus', id, status: 'accepted' })
        return { ok: true, matchId: matchId ?? undefined }
      }
      const ev = st.events.find((e) => e.id === inv.targetId)
      if (!ev) return { ok: false, reason: 'El evento ya no existe.' }
      const reason = joinBlock(st, ev, `event:${ev.id}`)
      if (reason) return { ok: false, reason }
      dispatch({ type: 'joinEvent', eventId: ev.id })
      dispatch({ type: 'inviteStatus', id, status: 'accepted' })
      return { ok: true }
    },
    updateName: (name) => dispatch({ type: 'setName', name }),
    updateBio: (bio) => dispatch({ type: 'setBio', bio }),
    setProfileImage: (kind, url) => {
      const me = stateRef.current.users[ME_ID]!
      const old = kind === 'avatar' ? me.avatarUrl : me.coverUrl
      dispatch({ type: 'setImage', kind, url })
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old)
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fuera de <AppProvider>')
  return c
}

/** Alias cómodo. */
export const useActions = () => useApp().actions
export function useMe(): User { return useApp().state.users[ME_ID]! }
