import { z } from 'zod'
import { User, Friendship, Plan, Event, Presence, PlanHistoryItem, Invite, Badge, Match, Attendance, XpEvent, ExactShare, LatLng } from './schemas'
import type { LatLng as Point } from '@/lib/geo'
import type { ImageKind } from '@/lib/image'
export { ME_ID } from './me'

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
  if (!res.ok) throw new ApiError(data.error || 'No pudimos completar la operación.', res.status, data.code)
  return data as T
}

export interface Bootstrap { users: z.infer<typeof User>[]; friendships: z.infer<typeof Friendship>[]; plans: z.infer<typeof Plan>[]; events: z.infer<typeof Event>[]; presence: z.infer<typeof Presence>[]; history: z.infer<typeof PlanHistoryItem>[]; invites: z.infer<typeof Invite>[]; attendees: Record<string, string[]>; badges: z.infer<typeof Badge>[]; myCenter: Point }
export interface PlacesProvider { readonly kind: 'manual' | 'amazon-location'; autocomplete(q: string, near: Point): Promise<z.infer<typeof Plan>['place'][]>; details(placeId: string): Promise<z.infer<typeof Plan>['place'] | null> }
export interface ApiClient { bootstrap(): Promise<Bootstrap>; places: PlacesProvider; live: { exactLocation(friendId: string, grants: z.infer<typeof ExactShare>[], now?: number): Point | null }; profile: { changePassword(input: { current: string; next: string }): Promise<void>; isUsernameAvailable(username: string, taken: string[]): Promise<boolean>; uploadMedia(kind: ImageKind, blob: Blob): Promise<string> } }
export type RankRow = z.infer<typeof User> & { rank: number; mine: boolean }
const Draft = z.object({ type: z.enum(['correr','deporte','juegos','comida','clase','musica','arte','otro']), title: z.string(), date: z.string(), time: z.string(), endTime: z.string(), place: z.string(), lateJoin: z.boolean(), inviteIds: z.array(z.string()), placeCenter: LatLng.optional(), alias: z.string(), photoUrl: z.string().optional(), capacity: z.number(), requiresApproval: z.boolean() })
const StateSchema = z.object({
  session: z.object({ email: z.string(), userId: z.string() }), location: z.object({ status: z.enum(['unknown','granted','denied','manual']), center: LatLng }), ghost: z.boolean(), openMode: z.object({ enabled: z.boolean(), adult: z.boolean(), bigEvents: z.boolean(), smallPlans: z.boolean() }), xp: z.number(), xpGoal: z.number(),
  users: z.record(z.string(), User), friendships: z.record(z.string(), Friendship), plans: z.array(Plan), events: z.array(Event), swipes: z.record(z.string(), z.enum(['pass','later','join'])), matches: z.array(Match), radiusM: z.number(), visibilityRadiusM: z.number(), invites: z.array(Invite), exactShares: z.array(ExactShare), exactGrants: z.array(ExactShare), exactPending: z.array(z.string()), exactRequests: z.array(z.string()), exactLocations: z.record(z.string(), LatLng), history: z.array(PlanHistoryItem), attendances: z.array(Attendance), xpEvents: z.array(XpEvent), blocks: z.array(z.string()), presence: z.array(Presence), badges: z.array(Badge), attendees: z.record(z.string(), z.array(z.string())), pendingAttendees: z.record(z.string(), z.array(z.string())), eventDraft: Draft.nullable().catch(null), rankings: z.object({ global: z.array(User.extend({ rank: z.number(), mine: z.boolean() })), amigos: z.array(User.extend({ rank: z.number(), mine: z.boolean() })) }),
})
let liveExact: Record<string, Point> = {}
export function clearLiveData() { liveExact = {} }
export function normalizeState(raw: unknown) {
  const s = StateSchema.parse(raw); const own = s.session.userId; const alias = (id: string) => id === own ? 'me' : id
  liveExact = s.exactLocations
  const lists = (v: Record<string, string[]>) => Object.fromEntries(Object.entries(v).map(([key, ids]) => [key, ids.map(alias)]))
  return { ...s, reports: [], dayOffset: 0,
    users: Object.fromEntries(Object.entries(s.users).map(([id,u]) => [alias(id),{...u,id:alias(id)}])),
    plans: s.plans.map(p=>({...p,authorId:alias(p.authorId),memberIds:p.memberIds?.map(alias)})), events:s.events.map(e=>({...e,organizerId:e.organizerId?alias(e.organizerId):undefined,friendsGoingIds:e.friendsGoingIds.map(alias)})),
    invites:s.invites.map(i=>({...i,fromId:alias(i.fromId),toId:alias(i.toId)})),history:s.history.map(h=>({...h,attendeeIds:h.attendeeIds.map(alias)})),attendees:lists(s.attendees),pendingAttendees:lists(s.pendingAttendees),
    rankings:{global:s.rankings.global.map(u=>({...u,id:alias(u.id)})),amigos:s.rankings.amigos.map(u=>({...u,id:alias(u.id)}))},
  }
}

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
  places: { kind:'manual' as const, async autocomplete(){return []}, async details(){return null} },
  live: { exactLocation(friendId: string, grants: z.infer<typeof ExactShare>[], now=Date.now()){ return grants.some(g=>g.userId===friendId&&new Date(g.until).getTime()>now)?liveExact[friendId]??null:null } },
  profile: {
    async changePassword(input:{current:string;next:string}) { const data=await request<{token:string}>('/me/password',input);setToken(data.token) },
    async isUsernameAvailable(username:string,_taken:string[]) { const data=await request<{available:boolean}>(`/usernames/${encodeURIComponent(username)}`);return data.available },
    async uploadMedia(kind:ImageKind,blob:Blob){const data=await request<{uploadUrl:string;publicUrl:string;key:string}>('/me/media/presign',{kind,content_type:blob.type,size:blob.size});const res=await fetch(data.uploadUrl,{method:'PUT',headers:{'Content-Type':blob.type},body:blob,signal:AbortSignal.timeout(60_000)});if(!res.ok)throw new Error('No pudimos subir la imagen.');mediaKeys.set(data.publicUrl,data.key);return data.publicUrl},
  },
}
