import { z } from 'zod'
import { User, Plan, Event, Friendship, Match, Attendance, XpEvent, Badge, LatLng } from './schemas'

const env = import.meta.env
export const API_URL = (env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')
export const WS_URL = env.VITE_WS_URL || 'ws://localhost:8080/ws'
const TOKEN_KEY = 'friends-nearby.token'
export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null) => token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY)
export class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
export async function request<T = unknown>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_URL}${path}`, {
    method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error || 'No pudimos completar la operación.', response.status)
  return data as T
}

export const StateSchema = z.object({
  session: z.object({ email: z.string(), userId: z.string() }),
  location: z.object({ status: z.enum(['unknown', 'granted', 'denied', 'manual']), zoneName: z.string(), center: LatLng.optional() }),
  ghost: z.boolean(), openMode: z.object({ enabled: z.boolean(), adult: z.boolean(), bigEvents: z.boolean(), smallPlans: z.boolean() }),
  xp: z.number(), xpGoal: z.number(), users: z.record(z.string(), User), friendships: z.record(z.string(), Friendship),
  plans: z.array(Plan), events: z.array(Event), swipes: z.record(z.string(), z.enum(['pass', 'later', 'join'])),
  matches: z.array(Match), attendances: z.array(Attendance), xpEvents: z.array(XpEvent), blocks: z.array(z.string()),
  waved: z.array(z.string()), eventDraft: z.unknown(), exactLocations: z.record(z.string(), LatLng),
  roomies: z.array(z.string()),
  eventAttendees: z.record(z.string(), z.array(z.string())), pendingAttendees: z.record(z.string(), z.array(z.string())), badges: z.array(Badge), zonesCount: z.number(),
})

// "me" remains a presentation alias used throughout the finished UI. Requests
// authenticate with the JWT; IDs belonging to other accounts remain unchanged.
export function normalizeState(raw: unknown) {
  const s = StateSchema.parse(raw)
  const own = s.session.userId
  const alias = (id: string) => id === own ? 'me' : id
  return {
    ...s,
    users: Object.fromEntries(Object.entries(s.users).map(([id, user]) => [alias(id), { ...user, id: alias(id) }])),
    plans: s.plans.map(p => ({ ...p, authorId: alias(p.authorId) })),
    events: s.events.map(e => ({ ...e, ownerId: e.ownerId ? alias(e.ownerId) : undefined, friendsGoingIds: e.friendsGoingIds.map(alias) })),
    eventAttendees: Object.fromEntries(Object.entries(s.eventAttendees).map(([id, ids]) => [id, ids.map(alias)])),
    pendingAttendees: Object.fromEntries(Object.entries(s.pendingAttendees).map(([id, ids]) => [id, ids.map(alias)])),
  }
}
