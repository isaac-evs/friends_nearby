import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Attendance, Availability, Badge, Event, EventType, ExactShare, Friendship, Invite, JoinPolicy, Match, Plan, PlanCategory, PlanHistoryItem, PlanPlace, Presence, SwipeAction, User, XpEvent } from '@/api/schemas'
import { User as UserSchema } from '@/api/schemas'
import type { ImageKind } from '@/lib/image'
import { roundToCell, type LatLng } from '@/lib/geo'
import { eventTimes } from '@/lib/planTime'
import { api, ApiError, clearLiveData, getToken, request, setToken, WS_URL, mediaKey, type RankRow } from '@/api/client'

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
  session: { email: string; userId: string } | null
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
  exactLocations: Record<string, LatLng>
  exactRequests: string[]
  pendingAttendees: Record<string, string[]>
  rankings: { global: RankRow[]; amigos: RankRow[] }
  eventDraft: EventDraft | null
}

export interface Actions {
  signIn: (email: string, password: string, name?: string, username?: string) => Promise<boolean>
  signOut: () => void
  setLocation: (status: LocationStatus, center?: LatLng) => Promise<boolean>
  /** Cómo estás (o `null` para no mostrar nada). No cambia quién ve tu ubicación. */
  setAvailability: (availability: Availability | null) => Promise<boolean>
  /** Día que se mira (0 = hoy, 1 = mañana…). */
  setDay: (offset: number) => void
  /** Qué tan lejos pueden estar tus amigos cercanos para verte. */
  setVisibilityRadius: (radiusM: number) => Promise<boolean>
  toggleGhost: () => Promise<boolean>
  setOpenMode: (patch: Partial<OpenMode>) => Promise<boolean>
  swipe: (kind: 'plan' | 'event', id: string, action: SwipeAction) => Promise<boolean>
  resetSwipes: (kind: 'plan' | 'event') => Promise<boolean>
  jalo: (planId: string) => Promise<string | null>
  setQuickMessage: (matchId: string, message: string) => Promise<boolean>
  confirmMeet: (matchId: string, who?: 'me') => Promise<boolean>
  /**
   * Publica un plan (el lugar es obligatorio). Devuelve `null` si choca con otro plan/evento tuyo (solo uno a la vez).
   * `inviteIds`: amigos a los que se invita (cada persona responde desde sus notificaciones).
   */
  publishPlan: (input: { category: PlanCategory; line: string; startsAt: string; durationMin: number; joinPolicy: JoinPolicy; place: PlanPlace; capacity?: number; photoUrl?: string; lateJoin: boolean; inviteIds: string[] }) => Promise<Plan | null>
  /** Invita a amigos a UNO DE TUS planes (los que ya tienen invitación se omiten). Devuelve a cuántos invitó. */
  invitePeople: (planId: string, ids: string[]) => Promise<number | null>
  /** Cambia la hora o la duración de uno de tus planes. */
  updatePlan: (id: string, startsAt: string, durationMin: number) => Promise<boolean>
  removePlan: (id: string) => Promise<boolean>
  publishEvent: (draft: EventDraft) => Promise<Event | null>
  saveDraft: (draft: EventDraft | null) => Promise<boolean>
  joinEvent: (eventId: string, pace?: string) => Promise<boolean>
  leaveEvent: (eventId: string) => Promise<boolean>
  setPace: (eventId: string, pace: string) => Promise<boolean>
  setFriendStatus: (userId: string, status: Friendship['status']) => Promise<boolean>
  block: (userId: string) => Promise<boolean>
  report: (userId: string, reason: string) => Promise<boolean>
  /** Elimina la amistad sin avisar a la otra persona. */
  removeFriend: (userId: string) => Promise<boolean>
  /** Amigo cercano = solicitud aparte y mutua. La otra persona debe aceptar. */
  requestClose: (userId: string) => Promise<boolean>
  cancelClose: (userId: string) => Promise<boolean>
  acceptClose: (userId: string) => Promise<boolean>
  declineClose: (userId: string) => Promise<boolean>
  removeClose: (userId: string) => Promise<boolean>
  /** Compartir MI ubicación exacta con un amigo cercano por `minutes` (temporal, se apaga sola). */
  startExact: (userId: string, minutes: number) => Promise<boolean>
  stopExact: (userId: string) => Promise<boolean>
  /** Pedirle su ubicación exacta (la otra persona decide). */
  askExact: (userId: string) => Promise<boolean>
  cancelAskExact: (userId: string) => Promise<boolean>
  /** Verifica que están en el punto de encuentro. La ubicación la ve solo el sistema, una sola vez. */
  verifyTogether: (matchId: string) => Promise<boolean>
  updateHandle: (handle: string) => Promise<boolean>
  /** Cambia el rango de búsqueda (metros). */
  setRadius: (radiusM: number) => Promise<boolean>
  /** Acepta o rechaza una invitación recibida. Si aceptas un plan, te une (`matchId`); si no se puede, dice por qué. */
  respondInvite: (id: string, accept: boolean) => Promise<{ ok: boolean; reason?: string; matchId?: string }>
  updateName: (name: string) => Promise<boolean>
  updateBio: (bio: string) => Promise<boolean>
  /** Cambia o quita la foto de perfil / portada. Libera la URL de objeto anterior. */
  setProfileImage: (kind: ImageKind, url: string | null) => Promise<boolean>
  searchUser: (username: string) => Promise<void>
  loadUser: (id: string) => Promise<boolean>
  forgotPassword: (email: string) => Promise<boolean>
  resetPassword: (token: string, password: string) => Promise<boolean>
  approveAttendance: (id: string, userId: string, approve: boolean) => Promise<boolean>
  declineExactRequest: (userId: string) => Promise<boolean>
  leavePlan: (id: string) => Promise<boolean>
}

export function initialState(): AppState {
 return {session:null,location:{status:'unknown',center:{lat:0,lng:0}},ghost:false,openMode:{enabled:false,adult:false,bigEvents:true,smallPlans:false},xp:0,xpGoal:500,users:{},friendships:{},plans:[],events:[],swipes:{},matches:[],radiusM:5000,visibilityRadiusM:3000,invites:[],exactShares:[],exactGrants:[],exactPending:[],exactRequests:[],exactLocations:{},history:[],attendances:[],xpEvents:[],blocks:[],reports:[],presence:[],badges:[],attendees:{},pendingAttendees:{},rankings:{global:[],amigos:[]},dayOffset:0,eventDraft:null}
}
interface Ctx { state:AppState;actions:Actions;connected:boolean;loading:boolean }
const AppCtx=createContext<Ctx|null>(null)
export function AppProvider({children,initial}:{children:ReactNode;initial?:AppState}) {
 const [state,setState]=useState(initial??initialState)
 const [loading,setLoading]=useState(!!getToken())
 const [connected,setConnected]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [authEpoch,setAuthEpoch]=useState(0)
 const stateRef=useRef(state);stateRef.current=state
 const sequence=useRef(0),known=useRef<string[]>([]),socket=useRef<WebSocket|null>(null)
 const logout=()=>{setToken(null);sequence.current++;known.current=[];socket.current?.close();clearLiveData();setState(initialState());setLoading(false);setConnected(false);setError(null)}
 const failed=(e:unknown)=>{if(e instanceof ApiError&&e.status===401)logout();setError(e instanceof ApiError?e.message:'No pudimos sincronizar con el servidor. Intenta de nuevo.')}
 const refresh=async()=>{const token=getToken();if(!token)return;const n=++sequence.current;const next=await api.state(known.current);if(token!==getToken()||n!==sequence.current)return;setState({...next,dayOffset:stateRef.current.dayOffset})}
 const actions=useMemo<Actions>(()=>{
  const run=async<T,>(body:Record<string,unknown>):Promise<{ok:true;result:T}|{ok:false;reason:string}>=>{
   let result:T
   try{setError(null);result=await api.action<T>(body)}catch(e){failed(e);return{ok:false,reason:e instanceof Error?e.message:'No se pudo completar.'}}
   // A failed refresh must never turn an acknowledged write into a failed action.
   try{await refresh()}catch(e){failed(e)}
   return{ok:true,result}
  }
  const mutate=async(body:Record<string,unknown>)=>(await run(body)).ok
  const friend=async(userId:string,status:Friendship['status'])=>{
   try{if(status==='requested_out'){const username=stateRef.current.users[userId]?.handle.replace(/^@/,'');await request('/friends/requests',{username})}
   else await request(`/friends/${encodeURIComponent(userId)}${status==='friends'?'/accept':''}`,status==='friends'?{}:undefined,status==='friends'?'POST':'DELETE')
   }catch(e){failed(e);return false};try{await refresh()}catch(e){failed(e)};return true
  }
  return {
   signOut:logout,
   signIn:async(email,password,name,username)=>{try{setError(null);const d=await request<{token:string}>(name?'/auth/register':'/auth/login',{email,password,display_name:name,username});known.current=[];setToken(d.token);await refresh();return true}catch(e){failed(e);return false}},
   forgotPassword:async email=>{try{await request('/auth/forgot',{email});return true}catch(e){failed(e);return false}},
   resetPassword:async(token,password)=>{try{await request('/auth/reset',{token,password});logout();return true}catch(e){failed(e);return false}},
   setLocation:(status,center)=>mutate({type:'setLocation',location:{status,center:center?roundToCell(center):stateRef.current.location.center}}),
   setDay:dayOffset=>setState(s=>({...s,dayOffset})),
   setAvailability:availability=>mutate({type:'setAvailability',availability:availability??''}),
   setRadius:radiusM=>mutate({type:'setRadius',radiusM}),setVisibilityRadius:radiusM=>mutate({type:'setVisibilityRadius',radiusM}),
   toggleGhost:()=>mutate({type:'setGhost',enabled:!stateRef.current.ghost}),setOpenMode:patch=>mutate({type:'setOpenMode',openMode:{...stateRef.current.openMode,...patch}}),
   swipe:(kind,id,action)=>mutate({type:'swipe',kind,id,action}),resetSwipes:kind=>mutate({type:'resetSwipes',kind}),
   jalo:async id=>{const r=await run<string>({type:'jalo',id});return r.ok?r.result:null},
   setQuickMessage:(id,message)=>mutate({type:'quickMessage',id,message}),confirmMeet:id=>mutate({type:'confirmMeet',id}),
   publishPlan:async input=>{const r=await run<Plan>({type:'publishPlan',...input,photoKey:mediaKey(input.photoUrl)});return r.ok?r.result:null},
   publishEvent:async d=>{const times=eventTimes(d.date,d.time,d.endTime);if(!times||!d.placeCenter){setError('Selecciona un horario y un lugar en el mapa.');return null};const r=await run<Event>({type:'publishEvent',eventType:d.type,title:d.title,...times,placeName:d.place,center:d.placeCenter,alias:d.alias,photoKey:mediaKey(d.photoUrl),capacity:d.capacity,requiresApproval:d.requiresApproval,lateJoin:d.lateJoin,inviteIds:d.inviteIds});return r.ok?r.result:null},
   invitePeople:async(id,inviteIds)=>{const r=await run<number>({type:'invitePeople',id,inviteIds});return r.ok?r.result:null},
   updatePlan:(id,startsAt,durationMin)=>mutate({type:'updatePlan',id,startsAt,durationMin}),removePlan:id=>mutate({type:'removePlan',id}),leavePlan:id=>mutate({type:'leavePlan',id}),
   saveDraft:draft=>mutate({type:'saveDraft',draft}),joinEvent:(id,pace)=>mutate({type:'joinEvent',id,pace}),leaveEvent:id=>mutate({type:'leaveEvent',id}),setPace:(id,pace)=>mutate({type:'setPace',id,pace}),
   approveAttendance:(id,userId,approve)=>mutate({type:approve?'approveAttendance':'rejectAttendance',id,userId}),
   setFriendStatus:friend,removeFriend:userId=>friend(userId,'none'),block:userId=>mutate({type:'block',userId}),report:(userId,reason)=>mutate({type:'report',userId,reason}),
   requestClose:userId=>mutate({type:'requestClose',userId}),cancelClose:userId=>mutate({type:'cancelClose',userId}),acceptClose:userId=>mutate({type:'acceptClose',userId}),declineClose:userId=>mutate({type:'declineClose',userId}),removeClose:userId=>mutate({type:'removeClose',userId}),
   startExact:(userId,minutes)=>mutate({type:'startExact',userId,minutes}),stopExact:userId=>mutate({type:'stopExact',userId}),askExact:userId=>mutate({type:'askExact',userId}),cancelAskExact:userId=>mutate({type:'cancelAskExact',userId}),declineExactRequest:userId=>mutate({type:'declineExactRequest',userId}),
   verifyTogether:async id=>{try{const center=await new Promise<LatLng>((resolve,reject)=>{if(!navigator.geolocation){reject(new Error('Ubicación no disponible.'));return};navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>reject(new Error('Debes permitir la ubicación para verificar tu llegada.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000})});return await mutate({type:'verifyTogether',id,center})}catch(e){setError(e instanceof Error?e.message:'No pudimos verificar tu llegada.');return false}},
   respondInvite:async(id,accept)=>{const r=await run<{ok:boolean;matchId?:string}>({type:'respondInvite',id,accept});return r.ok?r.result:{ok:false,reason:r.reason}},
   updateName:name=>mutate({type:'updateName',name}),updateHandle:username=>mutate({type:'updateHandle',username}),updateBio:bio=>mutate({type:'updateBio',bio}),
   setProfileImage:(mediaKind,url)=>mutate({type:'setProfileImage',mediaKind,key:mediaKey(url??undefined)}),
   searchUser:async username=>{try{const user=UserSchema.parse(await request(`/app/user?username=${encodeURIComponent(username.replace(/^@/,''))}`));known.current=[...known.current.filter(id=>id!==user.id),user.id].slice(-20);setState(s=>({...s,users:{...s.users,[user.id]:user}}))}catch(e){if(!(e instanceof ApiError&&e.status===404))failed(e)}},
   loadUser:async id=>{try{const user=UserSchema.parse(await request(`/app/user?id=${encodeURIComponent(id)}`));known.current=[...known.current.filter(x=>x!==user.id),user.id].slice(-20);setState(s=>({...s,users:{...s.users,[user.id]:user}}));return true}catch(e){if(!(e instanceof ApiError&&e.status===404))failed(e);return false}},
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 useEffect(()=>{let live=true;if(getToken())void refresh().catch(failed).finally(()=>{if(live)setLoading(false)});const changed=()=>setAuthEpoch(n=>n+1);window.addEventListener('friends-auth-changed',changed);return()=>{live=false;window.removeEventListener('friends-auth-changed',changed)}},[])
 useEffect(()=>{
  if(!state.session)return
  let stopped=false,retry:number|undefined,attempt=0
  const connect=()=>{const token=getToken();if(!token||stopped)return;const url=new URL(WS_URL);url.searchParams.set('token',token);const ws=new WebSocket(url);socket.current=ws;ws.onopen=()=>{setConnected(true);attempt=0;ws.send(JSON.stringify({action:'nearby'}));void refresh().catch(failed)};ws.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.type==='error')setError(data.error);else if(data.type!=='pong')void refresh().catch(failed)}catch{}};ws.onerror=()=>ws.close();ws.onclose=()=>{setConnected(false);if(!stopped)retry=window.setTimeout(connect,Math.min(30000,1000*2**attempt++))}}
  connect();const poll=window.setInterval(()=>{if(!document.hidden)void refresh().catch(failed);if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({action:'ping'}))},10000)
  const visible=()=>{if(!document.hidden)void refresh().catch(failed)};document.addEventListener('visibilitychange',visible)
  return()=>{stopped=true;clearTimeout(retry);clearInterval(poll);socket.current?.close();socket.current=null;document.removeEventListener('visibilitychange',visible)}
 },[state.session?.userId,authEpoch])
 useEffect(()=>{
  if(!state.session||state.location.status!=='granted'||!navigator.geolocation)return
  let watch:number|undefined,heartbeat:number|undefined,lastSent=0
  const share=(pos:GeolocationPosition)=>{if(document.hidden)return;const center=roundToCell({lat:pos.coords.latitude,lng:pos.coords.longitude});setState(s=>({...s,location:{...s.location,center}}));if(!stateRef.current.ghost&&socket.current?.readyState===WebSocket.OPEN&&Date.now()-lastSent>=5000){lastSent=Date.now();socket.current.send(JSON.stringify({action:'location',lat:pos.coords.latitude,lng:pos.coords.longitude}))}}
  const denied=()=>setError('No pudimos obtener tu ubicación. Revisa el permiso del navegador.')
  const opts={enableHighAccuracy:true,maximumAge:15000,timeout:15000}
  const start=()=>{if(watch!==undefined)navigator.geolocation.clearWatch(watch);clearInterval(heartbeat);watch=undefined;if(document.hidden)return;watch=navigator.geolocation.watchPosition(share,denied,opts);heartbeat=window.setInterval(()=>navigator.geolocation.getCurrentPosition(share,denied,opts),30000)}
  start();document.addEventListener('visibilitychange',start);return()=>{if(watch!==undefined)navigator.geolocation.clearWatch(watch);clearInterval(heartbeat);document.removeEventListener('visibilitychange',start)}
 },[state.session?.userId,state.location.status,state.ghost,connected,JSON.stringify(state.exactShares)])
 return <AppCtx.Provider value={{state,actions,connected,loading}}>
  {error&&<div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-surface p-3 text-sm text-danger"><span>{error}</span><button onClick={()=>{setError(null);if(getToken())void refresh().catch(failed)}}>Reintentar</button><button aria-label="Cerrar aviso" onClick={()=>setError(null)}>×</button></div>}
  {loading?<p role="status" className="p-6">Cargando tu cuenta…</p>:children}
 </AppCtx.Provider>
}
export function useApp(){const c=useContext(AppCtx);if(!c)throw new Error('useApp fuera de AppProvider');return c}
export const useActions=()=>useApp().actions
export const useMe=()=>useApp().state.users.me!
