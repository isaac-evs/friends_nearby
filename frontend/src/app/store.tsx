import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CanceledPlan, Attendance, Badge, Event, EventType, ExactShare, Friendship, Invite, JoinPolicy, Match, Plan, PlanCategory, PlanHistoryItem, PlanPlace, Presence, SwipeAction, User, XpEvent } from '@/api/schemas'
import { User as UserSchema } from '@/api/schemas'
import { ErrorToast } from '@/design/ErrorToast'
import type { ImageKind } from '@/lib/image'
import { distanceM, roundToCell, type LatLng } from '@/lib/geo'
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
  /** Descripción del evento y si hay chat (lo decide quien organiza). */
  description?: string; chatEnabled?: boolean
  /** Cómo se verifica a los asistentes. */
  verification?: 'none' | 'qr'
}

export interface AppState {
  session: { email: string; userId: string } | null
  /** `center`: mi ubicación aproximada (celda redondeada). Solo en memoria: nunca se guarda en el navegador. */
  location: { status: LocationStatus; center: LatLng }
  openMode: OpenMode
  xp: number
  xpGoal: number
  users: Record<string, User>
  friendships: Record<string, Friendship>
  plans: Plan[]
  /** Planes que ya terminaron y en los que estuviste (30 días): historial con su chat. */
  pastPlans: Plan[]
  /** Cancelados (30 días): por qué y cuándo. */
  canceledPlans: CanceledPlan[]
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
  /** A cuántos metros anda cada amigo (redondeado a 100 m, sin coordenadas; nunca va al mapa) y cuándo se actualizó. */
  friendDistances: { userId: string; distanceM: number; updatedAt: string }[]
  xpEvents: XpEvent[]
  /** Últimos compromisos: "ok" cumplido, "miss" faltó o canceló tarde (confiabilidad). */
  record: string[]
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
  /** Día que se mira (0 = hoy, 1 = mañana…). */
  setDay: (offset: number) => void
  /** Qué tan lejos pueden estar tus amigos cercanos para verte. */
  setVisibilityRadius: (radiusM: number) => Promise<boolean>
  setOpenMode: (patch: Partial<OpenMode>) => Promise<boolean>
  swipe: (kind: 'plan' | 'event', id: string, action: SwipeAction) => Promise<boolean>
  resetSwipes: (kind: 'plan' | 'event') => Promise<boolean>
  /** Te une al plan. Devuelve el id del plan (para abrir su detalle) o `null` si no se pudo. */
  jalo: (planId: string) => Promise<string | null>
  setQuickMessage: (matchId: string, message: string) => Promise<boolean>
  confirmMeet: (matchId: string, who?: 'me') => Promise<boolean>
  /** G6: check-in en el lugar (el servidor verifica ≤ 250 m). Devuelve el XP ganado y la puntualidad, o el motivo si falló. */
  checkIn: (planId: string, center: LatLng | null, accuracy?: number) => Promise<{ xp: number; punctuality: string } | string>
  /** G6: quien ya llegó confirma a quien no puede hacer check-in por GPS. */
  confirmArrival: (planId: string, userId: string) => Promise<boolean>
  /** G6: mensaje rápido al plan (uno cada 30 s). */
  planMessage: (planId: string, message: string) => Promise<boolean>
  /** Solo quien organiza: tema del chat y borrar mensajes. */
  setChatTheme: (planId: string, theme: string) => Promise<boolean>
  deleteChatMessage: (planId: string, messageId: string) => Promise<boolean>
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
  /** Terminar ahora un plan en curso que organizas. */
  endPlan: (id: string) => Promise<boolean>
  publishEvent: (draft: EventDraft) => Promise<Event | null>
  /** Solo quien organiza: editar, cancelar, avisos y chat del evento. */
  updateEvent: (id: string, input: { title: string; description: string; date: string; time: string; endTime: string; capacity: number; lateJoin: boolean; requiresApproval: boolean; placeName: string; center: LatLng }) => Promise<boolean>
  cancelEvent: (id: string) => Promise<boolean>
  postAnnouncement: (id: string, text: string) => Promise<boolean>
  deleteAnnouncement: (id: string, announcementId: string) => Promise<boolean>
  setEventChat: (id: string, enabled: boolean) => Promise<boolean>
  eventMessage: (id: string, text: string) => Promise<boolean>
  deleteEventMessage: (id: string, messageId: string) => Promise<boolean>
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
 return {session:null,location:{status:'unknown',center:{lat:0,lng:0}},openMode:{enabled:false,adult:false,bigEvents:true,smallPlans:false},xp:0,xpGoal:500,users:{},friendships:{},plans:[],pastPlans:[],canceledPlans:[],events:[],swipes:{},matches:[],radiusM:5000,visibilityRadiusM:3000,invites:[],exactShares:[],exactGrants:[],exactPending:[],exactRequests:[],exactLocations:{},history:[],attendances:[],xpEvents:[],friendDistances:[],record:[],blocks:[],reports:[],presence:[],badges:[],attendees:{},pendingAttendees:{},rankings:{global:[],amigos:[]},dayOffset:0,eventDraft:null}
}
interface Ctx { /** Última lectura real del GPS/red que ya usa la app (para el check-in). */lastPosition:()=>GeolocationPosition|null;state:AppState;actions:Actions;connected:boolean;loading:boolean;authError:string|null;clearAuthError:()=>void;locationIssue:{code:number}|null;retryLocation:()=>void }
/** Causas reales de un fallo de ubicación (códigos de `GeolocationPositionError`). */
const LOCATION_MSGS={
  denied:'El navegador bloqueó tu ubicación para este sitio. Permítela desde el candado de la barra de direcciones.',
  unavailable:'Tu dispositivo no está entregando la ubicación. Revisa que los servicios de ubicación estén activos en tu sistema; seguimos intentando.',
  timeout:'Tu ubicación tarda demasiado en llegar. Seguimos intentando; revisa tu señal o Wi‑Fi.',
  shown:'',
}
const AppCtx=createContext<Ctx|null>(null)
export function AppProvider({children,initial}:{children:ReactNode;initial?:AppState}) {
 const [state,setState]=useState(initial??initialState)
 const [loading,setLoading]=useState(!!getToken())
 const [connected,setConnected]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [authError,setAuthError]=useState<string|null>(null)
 const [retryMsg,setRetryMsg]=useState<string|null>(null)
 const [locationIssue,setLocationIssue]=useState<{code:number}|null>(null)
 const locationRetry=useRef<(()=>void)|null>(null)
 const livePos=useRef<GeolocationPosition|null>(null)
 // La ubicación se vigila durante toda la sesión: el aviso de fallo se da UNA vez hasta que se recupere (no al cambiar de pantalla).
 const locAnnounced=useRef(false)
 const [authEpoch,setAuthEpoch]=useState(0)
 const stateRef=useRef(state);stateRef.current=state
 const radiusSync=useRef<{pending:number|null;busy:boolean}>({pending:null,busy:false})
 const sequence=useRef(0),known=useRef<string[]>([]),socket=useRef<WebSocket|null>(null)
 const logout=()=>{setToken(null);sequence.current++;known.current=[];socket.current?.close();clearLiveData();setState(initialState());setLoading(false);setConnected(false);setError(null)}
 const failed=(e:unknown)=>{if(e instanceof ApiError&&e.status===401)logout();const msg=e instanceof ApiError?e.message:e instanceof Error&&e.name==='ZodError'?'El servidor respondió con datos que no entendemos. Actualiza la app e intenta de nuevo.':'No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.';setError(msg);setRetryMsg(e instanceof ApiError&&e.status<500&&e.status!==409?null:msg)}
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
   signIn:async(email,password,name,username)=>{try{setError(null);setAuthError(null);const d=await request<{token:string}>(name?'/auth/register':'/auth/login',{email,password,display_name:name,username});known.current=[];setToken(d.token);await refresh();return true}catch(e){setAuthError(e instanceof ApiError?(e.status===401?'Correo o contraseña incorrectos.':e.message):'No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.');return false}},
   forgotPassword:async email=>{try{await request('/auth/forgot',{email});return true}catch(e){failed(e);return false}},
   resetPassword:async(token,password)=>{try{await request('/auth/reset',{token,password});logout();return true}catch(e){failed(e);return false}},
   setLocation:(status,center)=>mutate({type:'setLocation',location:{status,center:center?roundToCell(center):stateRef.current.location.center}}),
   setDay:dayOffset=>setState(s=>({...s,dayOffset})),
   setRadius:async radiusM=>{
    // El slider cambia muchas veces por segundo: el valor se aplica al instante y al servidor solo va el último, de uno en uno (si no, las escrituras se pisan y salen conflictos).
    setState(s=>({...s,radiusM}));const q=radiusSync.current;q.pending=radiusM;if(q.busy)return true
    q.busy=true
    try{while(q.pending!==null){const v=q.pending;q.pending=null;try{setError(null);await api.action({type:'setRadius',radiusM:v})}catch(e){failed(e);q.pending=null;try{await refresh()}catch(e2){failed(e2)};return false}}}finally{q.busy=false}
    return true
   },setVisibilityRadius:radiusM=>mutate({type:'setVisibilityRadius',radiusM}),
   setOpenMode:patch=>mutate({type:'setOpenMode',openMode:{...stateRef.current.openMode,...patch}}),
   swipe:(kind,id,action)=>mutate({type:'swipe',kind,id,action}),resetSwipes:kind=>mutate({type:'resetSwipes',kind}),
   jalo:async id=>{const r=await run<string>({type:'jalo',id});return r.ok?id:null},
   setQuickMessage:(id,message)=>mutate({type:'quickMessage',id,message}),confirmMeet:id=>mutate({type:'confirmMeet',id}),
   publishPlan:async input=>{const r=await run<Plan>({type:'publishPlan',...input,photoKey:mediaKey(input.photoUrl)});return r.ok?r.result:null},
   publishEvent:async d=>{const times=eventTimes(d.date,d.time,d.endTime);if(!times||!d.placeCenter){setError('Selecciona un horario y un lugar en el mapa.');return null};const r=await run<Event>({type:'publishEvent',eventType:d.type,title:d.title,...times,placeName:d.place,center:d.placeCenter,alias:d.alias,photoKey:mediaKey(d.photoUrl),capacity:d.capacity,requiresApproval:d.requiresApproval,verification:d.verification??'none',lateJoin:d.lateJoin,inviteIds:d.inviteIds,description:d.description??'',chatEnabled:!!d.chatEnabled});return r.ok?r.result:null},
   updateEvent:async(id,i)=>{const times=eventTimes(i.date,i.time,i.endTime);if(!times){setError('Revisa la fecha y las horas.');return false};return mutate({type:'updateEvent',id,title:i.title,description:i.description,...times,capacity:i.capacity,lateJoin:i.lateJoin,requiresApproval:i.requiresApproval,placeName:i.placeName,center:i.center})},
   cancelEvent:id=>mutate({type:'cancelEvent',id}),postAnnouncement:(id,text)=>mutate({type:'postAnnouncement',id,message:text}),deleteAnnouncement:(id,a)=>mutate({type:'deleteAnnouncement',id,message:a}),setEventChat:(id,on)=>mutate({type:'setEventChat',id,accept:on}),eventMessage:(id,text)=>mutate({type:'eventMessage',id,message:text}),deleteEventMessage:(id,m)=>mutate({type:'deleteEventMessage',id,message:m}),
   invitePeople:async(id,inviteIds)=>{const r=await run<number>({type:'invitePeople',id,inviteIds});return r.ok?r.result:null},
   updatePlan:(id,startsAt,durationMin)=>mutate({type:'updatePlan',id,startsAt,durationMin}),removePlan:id=>mutate({type:'removePlan',id}),endPlan:id=>mutate({type:'endPlan',id}),
   setChatTheme:(id,theme)=>mutate({type:'setChatTheme',id,message:theme}),deleteChatMessage:(id,messageId)=>mutate({type:'deleteChatMessage',id,message:messageId}),
   checkIn:async(id,center,accuracy)=>{try{setError(null);const res=await api.action<{xp:number;punctuality:string}|null>({type:'checkIn',id,center,accuracy:accuracy??0});const at=new Date().toISOString();setState(s=>({...s,plans:s.plans.map(p=>p.id===id?{...p,roster:p.roster?.map(r=>r.userId==='me'?{...r,arrivedAt:r.arrivedAt??at}:r)}:p)}));void refresh().catch(failed);return res??{xp:0,punctuality:''}}catch(e){failed(e);return e instanceof Error?e.message:'No se pudo completar.'}},confirmArrival:(id,userId)=>mutate({type:'confirmArrival',id,userId}),planMessage:(id,message)=>mutate({type:'planMessage',id,message}),leavePlan:id=>mutate({type:'leavePlan',id}),
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
  // G6: al entrar se evalúan los planes que ya terminaron (si dijiste que ibas y no hiciste check-in cuenta como falta).
  if(!state.session)return
  void api.action({type:'settleNoShows'}).then(()=>refresh()).catch(()=>{})
 },[state.session?.userId])
 useEffect(()=>{
  if(!state.session||state.location.status!=='granted'||!navigator.geolocation)return
  let watch:number|undefined,heartbeat:number|undefined,fails=0,useHigh=false,announced=locAnnounced.current,lastOkAt=0
  // Conexión de ubicación siempre abierta mientras la app está abierta. Envío adaptativo para ser preciso sin gastar de más:
  // al moverte ≥ 30 m (máx. 1 cada 5 s) y, aunque estés quieto, un latido cada 40 s (cada 90 s con la pestaña oculta) para que tus
  // amigos te vean "ahora" (< 1 min). Se usa ubicación de red/Wi‑Fi (rápida y de poco consumo); la precisión alta solo si esa falla.
  // OJO: con `watchPosition` el navegador dispara TIMEOUT cuando no cambias de lugar aunque todo esté bien; por eso el watch no
  // tiene plazo y un timeout solo cuenta como falla si llevamos > 1 min sin NINGUNA lectura.
  let lastPos:GeolocationPosition|undefined,lastSentAt=0,lastSent:LatLng|undefined
  const clear=()=>{if(watch!==undefined)navigator.geolocation.clearWatch(watch);clearInterval(heartbeat);watch=undefined}
  const send=(lat:number,lng:number)=>{
   if(socket.current?.readyState!==WebSocket.OPEN)return
   lastSentAt=Date.now();lastSent={lat,lng};socket.current.send(JSON.stringify({action:'location',lat,lng}))
  }
  const share=(pos:GeolocationPosition)=>{
   lastOkAt=Date.now()
   if(fails>0||announced){fails=0;setLocationIssue(null);if(announced){announced=false;locAnnounced.current=false;setError(e=>e===LOCATION_MSGS.shown?null:e)}}
   lastPos=pos;livePos.current=pos;const {latitude:lat,longitude:lng}=pos.coords
   const center=roundToCell({lat,lng});setState(s=>s.location.center.lat===center.lat&&s.location.center.lng===center.lng?s:{...s,location:{...s.location,center}})
   const moved=!lastSent||distanceM(lastSent,{lat,lng})>=30
   if(Date.now()-lastSentAt>=5000&&(moved||Date.now()-lastSentAt>=(document.hidden?90000:40000)))send(lat,lng)
  }
  // Un error suelto no avisa: el mapa pinta tu punto en rojo y, si de verdad llevas > 1 min sin lecturas, se avisa UNA vez con la causa real.
  const fail=(err:GeolocationPositionError)=>{
   const silent=lastOkAt>0&&Date.now()-lastOkAt<60000
   if(err.code===3&&silent)return // sin cambios de posición no es un error
   fails++;setLocationIssue({code:err.code})
   if(fails>=2)useHigh=true // la ubicación de red no alcanza: se prueba con GPS
   if(fails>=3&&!silent&&!announced){announced=true;locAnnounced.current=true;const m=err.code===1?LOCATION_MSGS.denied:err.code===3?LOCATION_MSGS.timeout:LOCATION_MSGS.unavailable;LOCATION_MSGS.shown=m;setError(m);setRetryMsg(m)}
  }
  const one=()=>navigator.geolocation.getCurrentPosition(share,fail,{enableHighAccuracy:useHigh,maximumAge:60000,timeout:30000})
  function start(){clear();watch=navigator.geolocation.watchPosition(share,fail,{enableHighAccuracy:useHigh,maximumAge:60000,timeout:2147483647});one();heartbeat=window.setInterval(()=>{
   // Sin lecturas recientes se pide una explícita (y cuenta como intento); con lecturas, el latido reenvía la última posición.
   if(Date.now()-lastOkAt>120000)one()
   else if(lastPos&&Date.now()-lastSentAt>=(document.hidden?90000:40000))send(lastPos.coords.latitude,lastPos.coords.longitude)
  },20000)}
  // Al volver a la pestaña se pide una lectura fresca y se manda enseguida.
  const onVisible=()=>{if(!document.hidden)navigator.geolocation.getCurrentPosition(p=>{lastSentAt=0;share(p)},fail,{enableHighAccuracy:useHigh,maximumAge:30000,timeout:30000})}
  locationRetry.current=()=>{fails=0;announced=false;locAnnounced.current=false;useHigh=false;lastOkAt=0;setLocationIssue(null);start()}
  void navigator.permissions?.query({name:'geolocation'}).then(p=>{p.onchange=()=>{if(p.state==='granted')locationRetry.current?.()}}).catch(()=>{})
  start();document.addEventListener('visibilitychange',onVisible)
  return()=>{clear();locationRetry.current=null;document.removeEventListener('visibilitychange',onVisible)}
 },[state.session?.userId,state.location.status])
 return <AppCtx.Provider value={{lastPosition:()=>livePos.current,state,actions,connected,loading,authError,clearAuthError:()=>setAuthError(null),locationIssue,retryLocation:()=>locationRetry.current?.()}}>
  {error&&<ErrorToast raised={!!state.session} message={error} onRetry={retryMsg===error?()=>{setError(null);if(error===LOCATION_MSGS.shown)locationRetry.current?.();else if(getToken())void refresh().catch(failed)}:undefined} onClose={()=>setError(null)} />}
  {loading?<p role="status" className="p-6">Cargando tu cuenta…</p>:children}
 </AppCtx.Provider>
}
export function useApp(){const c=useContext(AppCtx);if(!c)throw new Error('useApp fuera de AppProvider');return c}
export const useActions=()=>useApp().actions
export const useMe=()=>useApp().state.users.me!
