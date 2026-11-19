import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Attendance, Audience, Badge, Event, EventAudience, EventType, Friendship, Match, Plan, PlanCategory, SwipeAction, User, XpEvent } from '@/api/schemas'
import { User as UserSchema } from '@/api/schemas'
import type { LatLng } from '@/lib/geo'
import { roundToZone } from '@/lib/geo'
import { ApiError, getToken, normalizeState, request, setToken, WS_URL } from '@/api/client'

export type LocationStatus = 'unknown' | 'granted' | 'denied' | 'manual'
export interface OpenMode { enabled: boolean; adult: boolean; bigEvents: boolean; smallPlans: boolean }

export interface EventDraft {
  type: EventType; title: string; dayOffset: number; time: string; place: string
  capacity: number; audience: EventAudience; requiresApproval: boolean
}

export interface AppState {
  session: { email: string; userId: string } | null
  location: { status: LocationStatus; zoneName: string; center?: LatLng }
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
  exactLocations: Record<string, LatLng>
  eventAttendees: Record<string, string[]>
  pendingAttendees: Record<string, string[]>
  badges: Badge[]
  zonesCount: number
  roomies: string[]
  eventDraft: EventDraft | null
}

export interface Actions {
  toggleRoomie: (userId: string) => Promise<boolean>
  signIn: (email: string, password: string, name?: string, username?: string) => Promise<boolean>
  signOut: () => void
  setLocation: (status: LocationStatus, zoneName: string, center?: LatLng) => Promise<boolean>
  toggleGhost: () => Promise<boolean>
  setOpenMode: (patch: Partial<OpenMode>) => Promise<boolean>
  swipe: (kind: 'plan' | 'event', id: string, action: SwipeAction) => Promise<boolean>
  resetSwipes: (kind: 'plan' | 'event') => Promise<boolean>
  jalo: (planId: string) => Promise<string | null>
  setQuickMessage: (matchId: string, message: string) => Promise<boolean>
  confirmMeet: (matchId: string, who?: 'me') => Promise<boolean>
  publishPlan: (input: { category: PlanCategory; line: string; durationMin: number; audience: Audience }) => Promise<Plan | null>
  removePlan: (id: string) => Promise<boolean>
  publishEvent: (draft: EventDraft) => Promise<Event | null>
  saveDraft: (draft: EventDraft | null) => Promise<boolean>
  joinEvent: (eventId: string, pace?: string) => Promise<boolean>
  leaveEvent: (eventId: string) => Promise<boolean>
  setPace: (eventId: string, pace: string) => Promise<boolean>
  setFriendStatus: (userId: string, status: Friendship['status']) => Promise<boolean>
  block: (userId: string) => Promise<boolean>
  report: (userId: string, reason: string) => Promise<boolean>
  wave: (userId: string) => Promise<boolean>
  toggleRanking: () => Promise<boolean>
  approveAttendance: (eventId: string, userId: string, approve: boolean) => Promise<boolean>
  searchUser: (username: string) => Promise<void>
  loadUser: (id: string) => Promise<boolean>
  forgotPassword: (email: string) => Promise<boolean>
  resetPassword: (token: string, password: string) => Promise<boolean>
  uploadPhoto: (file: File) => Promise<boolean>
}

export function initialState(): AppState {
  return { session: null, location: { status: 'unknown', zoneName: 'Chapultepec' }, ghost: false,
    openMode: { enabled: false, adult: false, bigEvents: true, smallPlans: false }, xp: 0, xpGoal: 500,
    users: {}, friendships: {}, plans: [], events: [], swipes: {}, matches: [], attendances: [], xpEvents: [],
    blocks: [], reports: [], waved: [], eventDraft: null, exactLocations: {}, eventAttendees: {}, pendingAttendees: {}, badges: [], zonesCount: 0, roomies: [] }
}
interface Ctx { state: AppState; actions: Actions; loading: boolean; connected: boolean; error: string | null }
const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, setState] = useState(initial ?? initialState)
  const [loading, setLoading] = useState(!!getToken())
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const stateRef = useRef(state); stateRef.current = state
  const socket = useRef<WebSocket | null>(null)
  const refreshNumber = useRef(0)
  const extras = useRef<Record<string, User>>({})

  const signOut = () => {
    setToken(null); refreshNumber.current++; extras.current = {}; socket.current?.close(); setConnected(false)
    setState(initialState()); setError(null); setLoading(false)
  }
  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) signOut()
    setError(e instanceof Error ? e.message : 'No pudimos conectar con el servidor.')
  }
  const refresh = async () => {
    const token = getToken(); if (!token) return
    const seq = ++refreshNumber.current
    const next = normalizeState(await request('/app/state'))
    if (token !== getToken() || seq !== refreshNumber.current) return
    const draft = next.eventDraft as EventDraft | null
    setState({ ...next, eventDraft: draft, reports: [], users: { ...extras.current, ...next.users } })
  }

  const actions = useMemo<Actions>(() => {
    const run = async (path: string, body?: unknown, method?: string) => {
      try { setError(null); const data = await request<{ result?: unknown }>(path, body, method); await refresh(); return { ok: true, result: data.result } }
      catch (e) { handleError(e); return { ok: false, result: undefined } }
    }
    const mutate = async (body: Record<string, unknown>) => (await run('/app/actions', body)).ok
    return {
      signOut,
      signIn: async (email, password, name, username) => {
        try {
          setError(null)
          const data = await request<{ token: string }>(name ? '/auth/register' : '/auth/login', { email, password, display_name: name, username })
          extras.current = {}; setToken(data.token); await refresh(); return true
        } catch (e) { handleError(e); return false }
      },
      forgotPassword: async email => {
        try { await request('/auth/forgot', { email }); return true } catch (e) { handleError(e); return false }
      },
      resetPassword: async (token, password) => {
        try { await request('/auth/reset', { token, password }); signOut(); return true } catch (e) { handleError(e); return false }
      },
      uploadPhoto: async file => {
        try {
          const data = await request<{ upload_url: string; key: string }>('/me/photo-upload-url', { content_type: file.type })
          const res = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
          if (!res.ok) throw new Error('No pudimos subir tu foto.')
          return (await run('/me', { photo_key: data.key }, 'PATCH')).ok
        } catch (e) { handleError(e); return false }
      },
      setLocation: (status, zoneName, center) => mutate({ type: 'setLocation', location: { status, zoneName, center: center ? roundToZone(center) : undefined } }),
      toggleGhost: async () => (await run('/me', { ghost_mode: !stateRef.current.ghost }, 'PATCH')).ok,
      setOpenMode: patch => mutate({ type: 'setOpenMode', openMode: { ...stateRef.current.openMode, ...patch } }),
      toggleRanking: () => mutate({ type: 'toggleRanking' }),
      toggleRoomie: userId => mutate({ type: 'toggleRoomie', userId }),
      swipe: (kind, id, action) => mutate({ type: 'swipe', kind, id, action }),
      resetSwipes: kind => mutate({ type: 'resetSwipes', kind }),
      jalo: async id => { const r = await run('/app/actions', { type: 'jalo', id }); return r.ok && typeof r.result === 'string' ? r.result : null },
      setQuickMessage: (id, message) => mutate({ type: 'quickMessage', id, message }),
      confirmMeet: id => mutate({ type: 'confirmMeet', id }),
      publishPlan: async input => { const r = await run('/app/actions', { type: 'publishPlan', ...input }); return r.ok ? r.result as Plan : null },
      removePlan: id => mutate({ type: 'removePlan', id }),
      publishEvent: async d => {
        const dt = new Date(); dt.setDate(dt.getDate() + d.dayOffset)
        const m = /^(\d+):(\d+)\s*(am|pm)$/i.exec(d.time)
        if (!m) { setError('Selecciona una hora válida.'); return null }
        dt.setHours(Number(m[1]) % 12 + (m[3]!.toLowerCase() === 'pm' ? 12 : 0), Number(m[2]), 0, 0)
        const r = await run('/app/actions', { type: 'publishEvent', eventType: d.type, title: d.title, startsAt: dt.toISOString(), placeName: d.place, capacity: d.capacity, audience: d.audience, requiresApproval: d.requiresApproval })
        return r.ok ? r.result as Event : null
      },
      saveDraft: draft => mutate({ type: 'saveDraft', draft }),
      joinEvent: (id, pace) => mutate({ type: 'joinEvent', id, pace }),
      leaveEvent: id => mutate({ type: 'leaveEvent', id }),
      setPace: (id, pace) => mutate({ type: 'setPace', id, pace }),
      approveAttendance: (id, userId, approve) => mutate({ type: approve ? 'approveAttendance' : 'rejectAttendance', id, userId }),
      setFriendStatus: async (id, status) => {
        if (status === 'requested_out') {
          const username = stateRef.current.users[id]?.handle.replace(/^@/, '')
          return (await run('/friends/requests', { username })).ok
        }
        return (await run(`/friends/${encodeURIComponent(id)}${status === 'friends' ? '/accept' : ''}`, status === 'friends' ? {} : undefined, status === 'friends' ? 'POST' : 'DELETE')).ok
      },
      block: async userId => { const ok = await mutate({ type: 'block', userId }); if (ok) { delete extras.current[userId]; await refresh() }; return ok },
      report: (userId, reason) => mutate({ type: 'report', userId, reason }),
      wave: userId => mutate({ type: 'wave', userId }),
      searchUser: async username => {
        try {
          const result = await request(`/app/user?username=${encodeURIComponent(username.replace(/^@/, ''))}`)
          const user = UserSchema.parse(result); extras.current[user.id] = user
          setState(s => ({ ...s, users: { ...s.users, [user.id]: user } }))
        } catch (e) { if (!(e instanceof ApiError && e.status === 404)) handleError(e) }
      },
      loadUser: async id => {
        try {
          const result = await request(`/app/user?id=${encodeURIComponent(id)}`)
          const user = UserSchema.parse(result); extras.current[user.id] = user
          setState(s => ({ ...s, users: { ...s.users, [user.id]: user } })); return true
        } catch (e) { if (!(e instanceof ApiError && e.status === 404)) handleError(e); return false }
      },
    }
  // Functions use refs so socket/polling callbacks keep the current session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    if (getToken()) refresh().catch(handleError).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!state.session) return
    let stopped = false; let retry: number | undefined; let attempts = 0
    const connect = () => {
      const token = getToken(); if (!token || stopped) return
      const url = new URL(WS_URL); url.searchParams.set('token', token)
      const ws = new WebSocket(url); socket.current = ws
      ws.onopen = () => { attempts = 0; setConnected(true); ws.send(JSON.stringify({ action: 'nearby' })); void refresh().catch(handleError) }
      ws.onmessage = e => {
        try { const data = JSON.parse(e.data); if (data.type === 'error') setError(data.error); else { if (data.type === 'wave') setNotification(`${data.friend.display_name} te saludó`); if (data.type !== 'pong') void refresh().catch(handleError) } } catch { /* ignore malformed frames */ }
      }
      ws.onclose = () => { setConnected(false); if (!stopped) retry = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts++)) }
      ws.onerror = () => ws.close()
    }
    connect()
    const poll = window.setInterval(() => { if (!document.hidden) void refresh().catch(handleError); if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ action: 'ping' })) }, 10_000)
    const visible = () => { if (!document.hidden) void refresh().catch(handleError) }
    document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; clearTimeout(retry); clearInterval(poll); socket.current?.close(); socket.current = null; document.removeEventListener('visibilitychange', visible) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.session?.userId])

  useEffect(() => {
    if (!state.session || state.location.status !== 'granted' || state.ghost || !navigator.geolocation) return
    let watch: number | undefined; let heartbeat: number | undefined; let lastSent = 0
    const start = () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch)
      clearInterval(heartbeat)
      watch = undefined
      if (document.hidden) return
      const share = (pos: GeolocationPosition) => {
        // Exact position is sent to the authenticated backend and never persisted
        // in browser storage. Only the rounded zone enters React state.
        const ws = socket.current
        if (!document.hidden && ws?.readyState === WebSocket.OPEN && Date.now() - lastSent >= 5000) {
          lastSent = Date.now(); ws.send(JSON.stringify({ action: 'location', lat: pos.coords.latitude, lng: pos.coords.longitude }))
          const center = roundToZone({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setState(s => ({ ...s, location: { ...s.location, center } }))
        }
      }
      const denied = () => setError('No pudimos obtener tu ubicación. Revisa el permiso del navegador.')
      const options = { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
      watch = navigator.geolocation.watchPosition(share, denied, options)
      heartbeat = window.setInterval(() => { if (!document.hidden) navigator.geolocation.getCurrentPosition(share, denied, options) }, 30_000)
    }
    start(); document.addEventListener('visibilitychange', start)
    return () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); clearInterval(heartbeat); document.removeEventListener('visibilitychange', start) }
  }, [state.session?.userId, state.location.status, state.ghost, connected])

  return <AppCtx.Provider value={{ state, actions, loading, connected, error }}>
    {notification && <div role="status" className="sticky top-0 z-50 flex justify-between bg-surface p-3"><span>{notification}</span><button onClick={() => setNotification(null)} aria-label="Cerrar saludo">×</button></div>}
    {error && <div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-surface px-5 py-3 text-sm text-danger">
      <span>{error}</span><button type="button" onClick={() => { setError(null); if (getToken()) { setLoading(true); void refresh().catch(handleError).finally(() => setLoading(false)) } }}>Reintentar</button>
      <button type="button" aria-label="Cerrar aviso" onClick={() => setError(null)}>×</button>
    </div>}
    {loading ? <p role="status" className="p-6">Cargando tu cuenta…</p> : children}
  </AppCtx.Provider>
}
export function useApp() { const c = useContext(AppCtx); if (!c) throw new Error('useApp fuera de AppProvider'); return c }
export const useActions = () => useApp().actions
export const useMe = () => useApp().state.users.me!
