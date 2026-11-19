import { z } from 'zod'
import { CanceledPlan, User, Friendship, Plan, Event, Presence, PlanHistoryItem, Invite, Badge, Match, Attendance, XpEvent, ExactShare, LatLng } from './schemas'
import type { LatLng as Point } from '@/lib/geo'
import type { ImageKind } from '@/lib/image'
export { ME_ID } from './me'
import { friendlyError } from '@/lib/errors'
import { mockPlaces } from './mock/places'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
const KEY = 'friends-nearby.token'
export const getToken = () => sessionStorage.getItem(KEY)
export function setToken(token: string | null) { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); window.dispatchEvent(new globalThis.Event('friends-auth-changed')) }
export class ApiError extends Error { constructor(message: string, public status: number, public code = '') { super(message) } }
export async function request<T = unknown>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
  const data = await res.json()
  if (!res.ok) throw new ApiError(friendlyError(data.error, res.status), res.status, data.code)
  return data as T
}

export interface Bootstrap { users: z.infer<typeof User>[]; friendships: z.infer<typeof Friendship>[]; plans: z.infer<typeof Plan>[]; events: z.infer<typeof Event>[]; presence: z.infer<typeof Presence>[]; history: z.infer<typeof PlanHistoryItem>[]; invites: z.infer<typeof Invite>[]; attendees: Record<string, string[]>; badges: z.infer<typeof Badge>[]; myCenter: Point }
export interface PlacesProvider { readonly kind: 'manual' | 'mock' | 'amazon-location'; autocomplete(q: string, near: Point): Promise<z.infer<typeof Plan>['place'][]>; details(placeId: string): Promise<z.infer<typeof Plan>['place'] | null> }
export interface ApiClient { bootstrap(): Promise<Bootstrap>; places: PlacesProvider; live: { exactLocation(friendId: string, grants: z.infer<typeof ExactShare>[], now?: number): Point | null }; profile: { changePassword(input: { current: string; next: string }): Promise<void>; isUsernameAvailable(username: string, taken: string[]): Promise<boolean>; uploadMedia(kind: ImageKind, blob: Blob): Promise<string> } }
export type RankRow = z.infer<typeof User> & { rank: number; mine: boolean }
const Draft = z.object({ type: z.enum(['correr','deporte','juegos','comida','clase','musica','arte','otro']), title: z.string(), date: z.string(), time: z.string(), endTime: z.string(), place: z.string(), lateJoin: z.boolean(), inviteIds: z.array(z.string()), placeCenter: LatLng.optional(), alias: z.string(), photoUrl: z.string().optional(), capacity: z.number(), description: z.string().optional(), chatEnabled: z.boolean().optional(), requiresApproval: z.boolean(), verification: z.enum(['none','qr']).optional() })
const StateSchema = z.object({
  session: z.object({ email: z.string(), userId: z.string() }), location: z.object({ status: z.enum(['unknown','granted','denied','manual']), center: LatLng }), openMode: z.object({ enabled: z.boolean(), adult: z.boolean(), bigEvents: z.boolean(), smallPlans: z.boolean() }), xp: z.number(), xpGoal: z.number(),
  users: z.record(z.string(), User), friendships: z.record(z.string(), Friendship), plans: z.array(Plan), pastPlans: z.array(Plan).nullish().transform((v) => v ?? []), canceledPlans: z.array(CanceledPlan).nullish().transform((v) => v ?? []), events: z.array(Event), swipes: z.record(z.string(), z.enum(['pass','later','join'])), matches: z.array(Match), radiusM: z.number(), visibilityRadiusM: z.number(), invites: z.array(Invite), exactShares: z.array(ExactShare), exactGrants: z.array(ExactShare), exactPending: z.array(z.string()), exactRequests: z.array(z.string()), exactLocations: z.record(z.string(), LatLng), history: z.array(PlanHistoryItem), attendances: z.array(Attendance), xpEvents: z.array(XpEvent), record: z.array(z.string()).nullish().transform((v) => v ?? []), blocks: z.array(z.string()), presence: z.array(Presence), friendDistances: z.array(z.object({ userId: z.string(), distanceM: z.number(), updatedAt: z.string() })).nullish().transform((v) => v ?? []), badges: z.array(Badge), attendees: z.record(z.string(), z.array(z.string())), pendingAttendees: z.record(z.string(), z.array(z.string())), eventDraft: Draft.nullable().catch(null), rankings: z.object({ global: z.array(User.extend({ rank: z.number(), mine: z.boolean() })), amigos: z.array(User.extend({ rank: z.number(), mine: z.boolean() })) }),
})
let liveExact: Record<string, Point> = {}
export function clearLiveData() { liveExact = {} }
export function normalizeState(raw: unknown) {
  const s = StateSchema.parse(raw); const own = s.session.userId; const alias = (id: string) => id === own ? 'me' : id
  liveExact = s.exactLocations
  const lists = (v: Record<string, string[]>) => Object.fromEntries(Object.entries(v).map(([key, ids]) => [key, ids.map(alias)]))
  return { ...s, reports: [], dayOffset: 0,
    users: Object.fromEntries(Object.entries(s.users).map(([id,u]) => [alias(id),{...u,id:alias(id)}])),
    plans: s.plans.map(p=>({...p,authorId:alias(p.authorId),memberIds:p.memberIds?.map(alias),roster:p.roster?.map(r=>({...r,userId:alias(r.userId),confirmedBy:r.confirmedBy?alias(r.confirmedBy):undefined})),timeline:p.timeline?.map(m=>({...m,userId:alias(m.userId)}))})), pastPlans: s.pastPlans.map(p=>({...p,authorId:alias(p.authorId),memberIds:p.memberIds?.map(alias),roster:p.roster?.map(r=>({...r,userId:alias(r.userId),confirmedBy:r.confirmedBy?alias(r.confirmedBy):undefined})),timeline:p.timeline?.map(m=>({...m,userId:alias(m.userId)}))})), events:s.events.map(e=>({...e,timeline:e.timeline?.map(m=>({...m,userId:alias(m.userId)})),organizerId:e.organizerId?alias(e.organizerId):undefined,friendsGoingIds:e.friendsGoingIds.map(alias)})),
    invites:s.invites.map(i=>({...i,fromId:alias(i.fromId),toId:alias(i.toId)})),history:s.history.map(h=>({...h,attendeeIds:h.attendeeIds.map(alias)})),attendees:lists(s.attendees),pendingAttendees:lists(s.pendingAttendees),
    rankings:{global:s.rankings.global.map(u=>({...u,id:alias(u.id)})),amigos:s.rankings.amigos.map(u=>({...u,id:alias(u.id)}))},
  }
}

const readJson = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(`friends-nearby.${key}`); return v === null ? fallback : JSON.parse(v) as T } catch { return fallback } }
const writeJson = (key: string, value: unknown) => { try { localStorage.setItem(`friends-nearby.${key}`, JSON.stringify(value)) } catch { /* sin almacenamiento: se queda en memoria de esta sesión */ } }
const mediaKeys = new Map<string,string>()
export function mediaKey(url?: string) { if (!url) return ''; const known=mediaKeys.get(url); if(known)return known; try{return new URL(url).pathname.replace(/^\//,'')}catch{return ''} }
const pendingIntents = new Map<string,string>()
export const api = {
  async state(extraIds: string[] = []) { return normalizeState(await request(`/app/state${extraIds.length ? '?includeUsers='+encodeURIComponent(extraIds.slice(-20).join(',')) : ''}`)) },
  async action<T = unknown>(body: Record<string,unknown>): Promise<T> {
    const fingerprint=JSON.stringify(body); let id=pendingIntents.get(fingerprint); if(!id){id=crypto.randomUUID();pendingIntents.set(fingerprint,id)}
    try { const response=await request<{result:T}>('/app/actions',{...body,requestId:id});pendingIntents.delete(fingerprint);return response.result }
    catch(e){ if(e instanceof ApiError && e.status<500 && e.status!==409)pendingIntents.delete(fingerprint);throw e }
  },
  async bootstrap(): Promise<Bootstrap> { const s=await api.state();return {users:Object.values(s.users),friendships:Object.values(s.friendships),plans:s.plans,events:s.events,presence:s.presence,history:s.history,invites:s.invites,attendees:s.attendees,badges:s.badges,myCenter:s.location.center} },
  /**
   * [PROPUESTA] `PUT /me/notification-prefs` y `POST /notifications/read`. Hoy se guardan en este dispositivo (por cuenta);
   * la interfaz no cambia cuando el servidor los guarde.
   */
  notifications: {
    prefs(userId: string): Record<string, boolean> { return readJson(`prefs.${userId}`, {}) },
    savePrefs(userId: string, prefs: Record<string, boolean>) { writeJson(`prefs.${userId}`, prefs) },
    readAt(userId: string): number { return readJson<number>(`read.${userId}`, 0) },
    markRead(userId: string, at = Date.now()) { writeJson(`read.${userId}`, at) },
    /** Notificaciones borradas (borrado suave: se guardan para poder deshacer). [PROPUESTA] `DELETE /notifications/{id}` con `deletedAt`. */
    dismissed(userId: string): string[] { return readJson<string[]>(`dismissed.${userId}`, []) },
    setDismissed(userId: string, ids: string[]) { writeJson(`dismissed.${userId}`, ids.slice(-500)) },
    /** Hasta qué mensaje del chat de un plan ya leíste (para el contador del ícono). [PROPUESTA] viaja con `POST /notifications/read`. */
    chatSeen(userId: string, planId: string): string { return readJson<string>(`chat.${userId}.${planId}`, '') },
    markChatSeen(userId: string, planId: string, at: string) { writeJson(`chat.${userId}.${planId}`, at) },
  },
  /** [PROPUESTA] `GET /places/autocomplete`. Hoy: buscador de ejemplo; el pin manual sigue de respaldo. */
  places: mockPlaces as PlacesProvider,
  live: { exactLocation(friendId: string, grants: z.infer<typeof ExactShare>[], now=Date.now()){ return grants.some(g=>g.userId===friendId&&new Date(g.until).getTime()>now)?liveExact[friendId]??null:null } },
  profile: {
    /** `POST /me/delete {password}`: borra la cuenta (irreversible). Cancela tus planes y eventos y te saca de los demás. */
    async deleteAccount(password:string) { await request('/me/delete',{password}) },
    async changePassword(input:{current:string;next:string}) { const data=await request<{token:string}>('/me/password',input);setToken(data.token) },
    async isUsernameAvailable(username:string,_taken:string[]) { const data=await request<{available:boolean}>(`/usernames/${encodeURIComponent(username)}`);return data.available },
    async uploadMedia(kind:ImageKind,blob:Blob){const data=await request<{uploadUrl:string;publicUrl:string;key:string}>('/me/media/presign',{kind,content_type:blob.type,size:blob.size});const res=await fetch(data.uploadUrl,{method:'PUT',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(60_000)});if(!res.ok)throw new Error('No pudimos subir la imagen.');mediaKeys.set(data.publicUrl,data.key);return data.publicUrl},
  },
}
