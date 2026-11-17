/**
 * Estado global del mock (sin backend). Reducer puro + acciones. Solo persistimos preferencias
 * no sensibles (sesión, zona elegida, modo fantasma, modo abierto, bloqueos): jamás coordenadas.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type {
  Attendance, Audience, Event, EventAudience, EventType, Friendship, Match, Plan, PlanCategory, SwipeAction, User, XpEvent,
} from '@/api/schemas'
import { events as seedEvents, friendships as seedFriendships, plans as seedPlans, users as seedUsers, ME_ID } from '@/api/mock'
import { MOCK_ORIGIN, offsetMeters, roundToZone, ZONE_RADIUS_M } from '@/lib/geo'

export type LocationStatus = 'unknown' | 'granted' | 'denied' | 'manual'
export interface OpenMode { enabled: boolean; adult: boolean; bigEvents: boolean; smallPlans: boolean }

export interface EventDraft {
  type: EventType; title: string; dayOffset: number; time: string; place: string
  capacity: number; audience: EventAudience; requiresApproval: boolean
}

export interface AppState {
  session: { email: string } | null
  location: { status: LocationStatus; zoneName: string }
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
  attendances: Attendance[]
  xpEvents: XpEvent[]
  blocks: string[]
  reports: { userId: string; reason: string }[]
  waved: string[]
  eventDraft: EventDraft | null
}

const PERSIST_KEY = 'jalas.mock.v1'
interface Persisted { session: AppState['session']; location: AppState['location']; ghost: boolean; openMode: OpenMode; blocks: string[] }

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
  } catch {
    return {}
  }
}

const keyOf = (kind: 'plan' | 'event', id: string) => `${kind}:${id}`
const byId = <T extends { id: string }>(l: T[]) => Object.fromEntries(l.map((x) => [x.id, x]))

export function initialState(): AppState {
  const p = loadPersisted()
  return {
    session: p.session ?? null,
    location: p.location ?? { status: 'unknown', zoneName: 'Chapultepec' },
    ghost: p.ghost ?? false,
    openMode: p.openMode ?? { enabled: false, adult: false, bigEvents: true, smallPlans: false },
    xp: 340,
    xpGoal: 500,
    users: byId(seedUsers),
    friendships: Object.fromEntries(seedFriendships.map((f) => [f.userId, f])),
    plans: seedPlans,
    events: seedEvents,
    swipes: {},
    matches: [],
    attendances: [],
    xpEvents: [],
    blocks: p.blocks ?? [],
    reports: [],
    waved: [],
    eventDraft: null,
  }
}

type Action =
  | { type: 'signIn'; email: string; name?: string }
  | { type: 'signOut' }
  | { type: 'setLocation'; status: LocationStatus; zoneName: string }
  | { type: 'toggleGhost' }
  | { type: 'setOpenMode'; patch: Partial<OpenMode> }
  | { type: 'swipe'; kind: 'plan' | 'event'; id: string; action: SwipeAction }
  | { type: 'resetSwipes'; kind: 'plan' | 'event' }
  | { type: 'jalo'; plan: Plan; match: Match }
  | { type: 'quickMessage'; matchId: string; message: string }
  | { type: 'confirmMeet'; matchId: string; who: 'me' | 'them' }
  | { type: 'addPlan'; plan: Plan }
  | { type: 'removePlan'; id: string }
  | { type: 'addEvent'; event: Event }
  | { type: 'saveDraft'; draft: EventDraft | null }
  | { type: 'joinEvent'; eventId: string; pace?: string }
  | { type: 'leaveEvent'; eventId: string }
  | { type: 'setPace'; eventId: string; pace: string }
  | { type: 'friendStatus'; userId: string; status: Friendship['status'] }
  | { type: 'block'; userId: string }
  | { type: 'report'; userId: string; reason: string }
  | { type: 'wave'; userId: string }
  | { type: 'toggleRanking' }

function addXp(s: AppState, amount: number, reason: string): AppState {
  let xp = s.xp + amount
  let me = s.users[ME_ID]!
  while (xp >= s.xpGoal) {
    xp -= s.xpGoal
    me = { ...me, level: me.level + 1 }
  }
  const ev: XpEvent = { id: `xp-${s.xpEvents.length + 1}`, amount, reason, at: new Date().toISOString() }
  return { ...s, xp, users: { ...s.users, [ME_ID]: me }, xpEvents: [...s.xpEvents, ev] }
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'signIn': {
      const users = a.name ? { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, name: a.name } } : s.users
      return { ...s, users, session: { email: a.email } }
    }
    case 'signOut':
      return { ...s, session: null }
    case 'setLocation':
      return { ...s, location: { status: a.status, zoneName: a.zoneName } }
    case 'toggleGhost':
      return { ...s, ghost: !s.ghost }
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
        next = { ...next, users: { ...next.users, [ME_ID]: { ...me, streakWeeks: me.streakWeeks + 1, hangouts: me.hangouts + 1 } } }
      }
      return next
    }
    case 'addPlan':
      return { ...s, plans: [a.plan, ...s.plans.filter((p) => p.authorId !== ME_ID)] }
    case 'removePlan':
      return { ...s, plans: s.plans.filter((p) => p.id !== a.id) }
    case 'addEvent':
      return { ...s, events: [a.event, ...s.events], eventDraft: null }
    case 'saveDraft':
      return { ...s, eventDraft: a.draft }
    case 'joinEvent': {
      const ev = s.events.find((e) => e.id === a.eventId)
      if (!ev || s.attendances.some((x) => x.eventId === a.eventId)) return s
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
      const f: Friendship = cur ? { ...cur, status: a.status } : { userId: a.userId, status: a.status, mutualFriendIds: [], locationPaused: false }
      return { ...s, friendships: { ...s.friendships, [a.userId]: f } }
    }
    case 'block':
      return s.blocks.includes(a.userId) ? s : { ...s, blocks: [...s.blocks, a.userId] }
    case 'report':
      return { ...s, reports: [...s.reports, { userId: a.userId, reason: a.reason }] }
    case 'wave':
      return s.waved.includes(a.userId) ? s : { ...s, waved: [...s.waved, a.userId] }
    case 'toggleRanking': {
      const me = s.users[ME_ID]!
      return { ...s, users: { ...s.users, [ME_ID]: { ...me, rankingOptIn: !me.rankingOptIn } } }
    }
  }
}

export interface Actions {
  signIn: (email: string, name?: string) => void
  signOut: () => void
  setLocation: (status: LocationStatus, zoneName: string) => void
  toggleGhost: () => void
  setOpenMode: (patch: Partial<OpenMode>) => void
  swipe: (kind: 'plan' | 'event', id: string, action: SwipeAction) => void
  resetSwipes: (kind: 'plan' | 'event') => void
  jalo: (planId: string) => string | null
  setQuickMessage: (matchId: string, message: string) => void
  confirmMeet: (matchId: string, who: 'me' | 'them') => void
  publishPlan: (input: { category: PlanCategory; line: string; durationMin: number; audience: Audience }) => Plan
  removePlan: (id: string) => void
  publishEvent: (draft: EventDraft) => Event
  saveDraft: (draft: EventDraft | null) => void
  joinEvent: (eventId: string, pace?: string) => void
  leaveEvent: (eventId: string) => void
  setPace: (eventId: string, pace: string) => void
  setFriendStatus: (userId: string, status: Friendship['status']) => void
  block: (userId: string) => void
  report: (userId: string, reason: string) => void
  wave: (userId: string) => void
  toggleRanking: () => void
}

interface Ctx { state: AppState; actions: Actions }
const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial ?? initialState())
  // Estado más reciente para acciones que lo leen sin volver a crear `actions`.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const p: Persisted = { session: state.session, location: state.location, ghost: state.ghost, openMode: state.openMode, blocks: state.blocks }
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(p)) } catch { /* sin storage: seguimos en memoria */ }
  }, [state.session, state.location, state.ghost, state.openMode, state.blocks])

  const actions = useMemo<Actions>(() => ({
    signIn: (email, name) => dispatch({ type: 'signIn', email, name }),
    signOut: () => dispatch({ type: 'signOut' }),
    setLocation: (status, zoneName) => dispatch({ type: 'setLocation', status, zoneName }),
    toggleGhost: () => dispatch({ type: 'toggleGhost' }),
    setOpenMode: (patch) => dispatch({ type: 'setOpenMode', patch }),
    swipe: (kind, id, action) => dispatch({ type: 'swipe', kind, id, action }),
    resetSwipes: (kind) => dispatch({ type: 'resetSwipes', kind }),
    jalo: (planId) => {
      const plan = stateRef.current.plans.find((p) => p.id === planId)
      if (!plan) return null
      const id = `match-${planId}`
      const created = new Date()
      // Ubicación exacta compartida como máximo 1 h o hasta que expire el plan.
      const until = Math.min(created.getTime() + 60 * 60_000, new Date(plan.expiresAt).getTime())
      const match: Match = {
        id, planId, friendId: plan.authorId, createdAt: created.toISOString(), exactShareUntil: new Date(until).toISOString(),
        meetPoint: plan.meetPoint, quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false,
      }
      dispatch({ type: 'jalo', plan, match })
      return id
    },
    setQuickMessage: (matchId, message) => dispatch({ type: 'quickMessage', matchId, message }),
    confirmMeet: (matchId, who) => dispatch({ type: 'confirmMeet', matchId, who }),
    publishPlan: ({ category, line, durationMin, audience }) => {
      const now = Date.now()
      const origin = zoneForName(stateRef.current.location.zoneName)
      const plan: Plan = {
        id: `plan-me-${now}`, authorId: ME_ID, category, line, expiresAt: new Date(now + durationMin * 60_000).toISOString(),
        audience, joinedCount: 0, zoneUpdatedAt: new Date(now).toISOString(), meetPoint: stateRef.current.location.zoneName,
        // Zona aproximada: centro redondeado, nunca el punto exacto.
        zone: { name: stateRef.current.location.zoneName, center: roundToZone(origin), radiusM: ZONE_RADIUS_M, approxDistanceM: 0 },
      }
      dispatch({ type: 'addPlan', plan })
      return plan
    },
    removePlan: (id) => dispatch({ type: 'removePlan', id }),
    publishEvent: (d) => {
      const day = new Date()
      day.setDate(day.getDate() + d.dayOffset)
      const m = /(\d+):(\d+)\s*(am|pm)/i.exec(d.time)
      let h = m ? Number(m[1]) : 17
      if (m && m[3]!.toLowerCase() === 'pm' && h < 12) h += 12
      if (m && m[3]!.toLowerCase() === 'am' && h === 12) h = 0
      day.setHours(h, m ? Number(m[2]) : 0, 0, 0)
      const ev: Event = {
        id: `evt-me-${Date.now()}`, type: d.type, subtype: '', title: d.title.trim() || 'Evento sin nombre', startsAt: day.toISOString(),
        placeName: d.place.trim() || 'Lugar público', center: roundToZone(offsetMeters(MOCK_ORIGIN, 300, 300)), approxDistanceM: 500,
        capacity: d.capacity, going: 1, organizer: { name: 'Tú', verified: false, eventsCount: 1 }, audience: d.audience,
        requiresApproval: d.requiresApproval, friendsGoingIds: [], xp: 40,
      }
      dispatch({ type: 'addEvent', event: ev })
      return ev
    },
    saveDraft: (draft) => dispatch({ type: 'saveDraft', draft }),
    joinEvent: (eventId, pace) => dispatch({ type: 'joinEvent', eventId, pace }),
    leaveEvent: (eventId) => dispatch({ type: 'leaveEvent', eventId }),
    setPace: (eventId, pace) => dispatch({ type: 'setPace', eventId, pace }),
    setFriendStatus: (userId, status) => dispatch({ type: 'friendStatus', userId, status }),
    block: (userId) => dispatch({ type: 'block', userId }),
    report: (userId, reason) => dispatch({ type: 'report', userId, reason }),
    wave: (userId) => dispatch({ type: 'wave', userId }),
    toggleRanking: () => dispatch({ type: 'toggleRanking' }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

const ZONE_OFFSETS: Record<string, [number, number]> = {
  Chapultepec: [0, 0], Providencia: [424, 680], Colomos: [-1008, 1256], ITESO: [800, -552], Centro: [-2500, 600], Andares: [-3000, 1800],
}
function zoneForName(name: string) {
  const [e, n] = ZONE_OFFSETS[name] ?? [0, 0]
  return offsetMeters(MOCK_ORIGIN, e, n)
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fuera de <AppProvider>')
  return c
}

/** Alias cómodo. */
export const useActions = () => useApp().actions
export function useMe(): User { return useApp().state.users[ME_ID]! }
