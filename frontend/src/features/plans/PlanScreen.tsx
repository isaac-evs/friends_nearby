import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, MapPin, MessageCircle, Navigation } from 'lucide-react'
import { Avatar, Button, IconButton, ModalSheet, Pill, SearchField, matchesName, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useClock, useIsDesktop } from '@/app/hooks'
import { ME_ID } from '@/api/me'
import { api } from '@/api/client'
import { PLAN_CATEGORIES } from '@/lib/category'
import { formatApproxDistance, formatFriendDistance } from '@/lib/format'
import { distanceM } from '@/lib/geo'
import { arrivalXP, arrivedLabel, dueAt, joinedInProgress, leavePenalty, lobbyPhase, sortRoster } from '@/lib/lifecycle'
import { countdownLabel, durationText, minutesUntilStart, planPhase, startLabel } from '@/lib/planTime'
import { cn } from '@/lib/cn'
import { JoinButton } from '@/features/map/JoinButton'
import { directionsHref, type MyPlan } from './useMyPlans'
import { ChatPanel } from './ChatPanel'
import { CancelSheet, EditTimeSheet, FinishSheet } from './PlansScreen'

const STATUS: Record<string, { label: string; cls: string }> = {
  upcoming: { label: 'Próximo', cls: 'bg-primary-soft' },
  live: { label: 'En curso', cls: '' },
  ended: { label: 'Terminado', cls: 'bg-surface-sunken' },
  canceled: { label: 'Cancelado', cls: 'bg-surface-sunken' },
}

/**
 * `/plan/:id` — Ver plan (G6): foto, estado, hora con cuenta regresiva, lugar exacto, quiénes van, y según el momento:
 * Jalo · Cancelar mi lugar (con lo que pierdes) · lobby desde 10 min antes con "Ya llegué" (check-in en el lugar) ·
 * "Que me confirme alguien" · mensajes rápidos.
 */
export function PlanScreen() {
  const { id } = useParams()
  const { state } = useApp()
  const { planMessage, deleteChatMessage, setChatTheme } = useActions()
  const nav = useNavigate()
  const now = useClock(15_000)
  const active = state.plans.find((p) => p.id === id)
  const plan = active ?? state.pastPlans.find((p) => p.id === id)
  const past = !active && !!plan

  const [chatOpen, setChatOpen] = useState(false)
  const userId = state.session?.userId ?? ME_ID
  const [seen, setSeen] = useState(() => (id ? api.notifications.chatSeen(userId, id) : ''))
  const lastAt = plan?.timeline?.at(-1)?.at ?? ''
  useEffect(() => { if (chatOpen && id && lastAt && lastAt > seen) { api.notifications.markChatSeen(userId, id, lastAt); setSeen(lastAt) } }, [chatOpen, lastAt, seen, id, userId])
  const unread = chatOpen ? 0 : (plan?.timeline ?? []).filter((m) => m.userId !== ME_ID && m.at > seen).length
  const canChat = !!plan && (plan.authorId === ME_ID || !!plan.roster?.some((r) => r.userId === ME_ID))

  const header = (
    <header className="flex items-center gap-3">
      <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
      <h1 className="flex-1 text-h1 font-extrabold">Plan</h1>
      {canChat && (
        <button type="button" onClick={() => setChatOpen(true)} aria-label={unread ? `Abrir chat (${unread} sin leer)` : 'Abrir chat'} className="relative flex size-11 items-center justify-center rounded-full text-ink">
          <MessageCircle aria-hidden="true" size={22} />
          {unread > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold text-ink">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
    </header>
  )
  if (!plan) {
    return (
      <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[640px] lg:p-0">
        {header}
        <p role="status" className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-3 text-sm text-muted">Este plan ya no está disponible: se canceló o ya no puedes verlo. <Link to="/planes" className="font-bold text-primary">Mis planes</Link></p>
      </div>
    )
  }

  const cat = PLAN_CATEGORIES[plan.category]
  const author = state.users[plan.authorId]
  const organizer = plan.authorId === ME_ID
  const roster = sortRoster(plan.roster ?? [])
  const member = organizer || roster.some((r) => r.userId === ME_ID)
  const mine = roster.find((r) => r.userId === ME_ID)
  const phase = planPhase(plan, now)
  const lobby = lobbyPhase(plan, now)
  const status = STATUS[phase]!
  const way = directionsHref({ placeCenter: plan.place.center })

  const live = phase === 'live'
  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[120px] lg:max-w-[1000px] lg:p-0">
      {header}
      {/* Desktop: dos columnas (información y acciones | quiénes van) para verlo todo sin bajar. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-4">
          {plan.photoUrl
            ? <img src={plan.photoUrl} alt={`Foto de ${plan.line}`} className="h-48 w-full rounded-lg border border-line object-cover lg:h-36" />
            : <div aria-hidden="true" className={cn('flex h-40 items-center justify-center rounded-lg border border-line lg:h-36', cat.tile)}>{cat.icon({ size: 72, strokeWidth: 1.5 })}</div>}

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {live
                ? <Pill tone="live" className="gap-1.5 py-1"><span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-success motion-reduce:animate-none" />En curso · {countdownLabel(plan, now).replace(/^en curso · /, '')}</Pill>
                : <Pill tone="muted" className={status.cls}>{status.label}</Pill>}
              <span className="text-caption font-bold text-muted">{cat.label}{author ? ` · ${organizer ? 'Lo organizas tú' : author.name}` : ''}</span>
            </div>
            <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.6px]">{plan.line}</h2>
            <p className="text-base font-bold">{startLabel(plan.startsAt, now)} · dura {durationText(plan.durationMin)}</p>
            {!live && <p className="text-sm font-bold text-accent-text">{countdownLabel(plan, now)[0]!.toUpperCase() + countdownLabel(plan, now).slice(1)}</p>}
          </section>

          <section aria-label="Lugar" className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-sm">
            <MapPin aria-hidden="true" size={20} className="flex-none text-primary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-extrabold">{plan.place.name}</span>
              <span className="truncate text-caption font-semibold text-muted">{plan.place.address ? `${plan.place.address} · ` : ''}a {formatApproxDistance(distanceM(state.location.center, plan.place.center))} de ti</span>
            </div>
            <a href={way.href} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar (abre tu app de mapas en otra pestaña)" className="flex size-11 flex-none items-center justify-center text-primary"><Navigation aria-hidden="true" size={24} strokeWidth={2.4} /></a>
          </section>

          <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">
            <Going plan={plan} roster={roster} lobbyOpen={member && lobby === 'open'} arrived={!!mine?.arrivedAt} />
          </div>

          {phase === 'ended'
            ? null
            : <Actions plan={plan} organizer={organizer} member={member} arrivedAt={mine?.arrivedAt} lobby={lobby} anyArrived={roster.some((r) => r.arrivedAt)} />}
      </div>
      {chatOpen && canChat && <ChatPanel chat={{ id: plan.id, title: plan.line, ownerId: plan.authorId, memberIds: plan.memberIds, timeline: plan.timeline, theme: plan.chatTheme }} readOnly={past || phase === 'ended'} onSend={(t) => planMessage(plan.id, t)} onDelete={(m) => void deleteChatMessage(plan.id, m)} onTheme={(k) => void setChatTheme(plan.id, k)} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

/** Desde cuántas personas aparece el buscador. */
const SEARCH_FROM = 6

type PlanT = ReturnType<typeof useApp>['state']['plans'][number]

/** Quiénes van: fotos + lista que se abre. Con el lobby abierto: quién ya llegó y a cuánto del lugar está quien aún no. */
function Going({ plan, roster, lobbyOpen, arrived }: { plan: PlanT; roster: ReturnType<typeof sortRoster>; lobbyOpen: boolean; arrived: boolean }) {
  const { state } = useApp()
  const { confirmArrival } = useActions()
  const toast = useToast()
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(lobbyOpen || desktop)
  const [q, setQ] = useState('')
  const organizerView = plan.authorId === ME_ID
  const rows = roster.length ? roster : [plan.authorId, ...(plan.memberIds ?? [])].map((userId) => ({ userId, organizer: userId === plan.authorId } as ReturnType<typeof sortRoster>[number]))
  const shown = rows.slice(0, 5)
  const arrivedN = rows.filter((r) => r.arrivedAt).length
  const detailed = roster.length > 0
  return (
    <section aria-label="Quiénes van" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 shadow-sm">
      <button type="button" aria-expanded={open} aria-controls="going-list" onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-meta font-bold">Quiénes van · {rows.length}{plan.capacity ? ` de ${plan.capacity}` : ''}{lobbyOpen && detailed ? ` · ${arrivedN} ya llegaron` : ''}</span>
          <span className="flex items-center">
            {shown.map((r, i) => {
              const u = state.users[r.userId]
              return <span key={r.userId} className={cn('rounded-full ring-2 ring-surface', i > 0 && '-ml-2')}><Avatar userId={r.userId} name={u?.name ?? '?'} size={34} src={u?.avatarUrl} /></span>
            })}
            {rows.length > shown.length && <span aria-hidden="true" className="-ml-2 flex size-9 items-center justify-center rounded-full border border-line bg-surface-sunken text-caption font-bold ring-2 ring-surface">+{rows.length - shown.length}</span>}
          </span>
        </span>
        <span className="flex items-center gap-1 text-caption font-bold text-primary">{open ? 'Ocultar' : 'Ver lista'}<ChevronDown aria-hidden="true" size={18} className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')} /></span>
      </button>

      {open && (
        <div id="going-list" className="flex flex-col gap-2">
          {rows.length > SEARCH_FROM && <SearchField value={q} onChange={setQ} />}
          {q.trim() && !rows.some((r) => matchesName(r.userId === ME_ID ? 'Tú' : (state.users[r.userId]?.name ?? ''), q)) && <p role="status" className="text-sm text-muted">Nadie se llama así en este plan.</p>}
          <ul className="flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto">
            {rows.filter((r) => !q.trim() || matchesName(r.userId === ME_ID ? 'Tú' : (state.users[r.userId]?.name ?? ''), q)).map((r) => {
              const u = state.users[r.userId]
              const you = r.userId === ME_ID
              const name = you ? 'Tú' : (u?.name ?? 'Alguien')
              let line: { text: string; cls: string } | null = null
              const dist = r.distanceM !== undefined || you ? `A ${formatFriendDistance(r.distanceM ?? distanceM(state.location.center, plan.place.center))} del lugar` : null
              if (r.arrivedAt) line = { text: `${arrivedLabel(dueAt(plan.startsAt, r.joinedAt), r.arrivedAt, you)}${r.confirmedBy ? ` · lo confirmó ${state.users[r.confirmedBy]?.name ?? 'alguien'}` : ''}`, cls: 'font-bold text-success-text' }
              else if (lobbyOpen) {
                const late = joinedInProgress(plan.startsAt, r.joinedAt) ? 0 : Math.floor((Date.now() - new Date(dueAt(plan.startsAt, r.joinedAt)).getTime()) / 60_000)
                line = { text: `No verificado${late >= 1 ? ` · va tarde (${late} min)` : ''}${dist ? ` · ${dist}` : ''}`, cls: late >= 1 ? 'font-semibold text-danger' : 'text-muted' }
              }
              return (
                <li key={r.userId} className={cn('flex min-h-14 items-center gap-3 rounded-md border px-2.5 py-1.5', r.arrivedAt ? 'border-transparent bg-cat-musica' : 'border-line bg-surface-muted')}>
                  <Avatar userId={r.userId} name={u?.name ?? '?'} size={34} src={u?.avatarUrl} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{name}{r.organizer ? ' · organiza' : ''}</span>
                    {line && <span className={cn('text-caption', line.cls)}>{r.arrivedAt && <Check aria-hidden="true" size={12} strokeWidth={3} className="mr-1 inline" />}{line.text}</span>}
                  </span>
                  {lobbyOpen && (arrived || organizerView) && !r.arrivedAt && !you && (
                    <Button variant="secondary" className="h-11 rounded-md px-3 text-caption" aria-label={`Confirmar que ${name} llegó`} onClick={async () => { if (await confirmArrival(plan.id, r.userId)) toast(`Confirmaste a ${name}`) }}><Check aria-hidden="true" size={14} strokeWidth={3} className="mr-1" />Confirmar</Button>
                  )}
                </li>
              )
            })}
          </ul>
          {lobbyOpen && (arrived || organizerView) && <p className="text-caption text-muted">Si alguien ya está ahí pero no pudo verificarse, toca Confirmar.</p>}
        </div>
      )}
    </section>
  )
}


function Actions({ plan, organizer, member, arrivedAt, lobby, anyArrived }: {
  plan: ReturnType<typeof useApp>['state']['plans'][number]; organizer: boolean; member: boolean; arrivedAt?: string; lobby: 'before' | 'open' | 'over'; anyArrived: boolean
}) {
  const { checkIn, leavePlan } = useActions()
  const myJoined = plan.roster?.find((r) => r.userId === ME_ID)?.joinedAt
  const { lastPosition, state } = useApp()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'leave' | 'cancel' | 'finish' | 'edit' | null>(null)
  const asMy: MyPlan = { key: plan.id, kind: 'plan', id: plan.id, title: plan.line, categoryLabel: '', startsAt: plan.startsAt, durationMin: plan.durationMin, placeName: plan.place.name, role: 'organizador', href: '', phase: planPhase(plan) }

  // Usa la lectura que la app ya tiene (la misma que te ubica en el mapa). Si no hay una reciente, pide una nueva: primero
  // por red/Wi-Fi y luego por GPS. Y si el dispositivo no responde, el servidor usa tu última ubicación conocida.
  const readPosition = () => new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve, reject) => {
    const live = lastPosition()
    if (live && Date.now() - live.timestamp < 120_000) { resolve({ lat: live.coords.latitude, lng: live.coords.longitude, accuracy: live.coords.accuracy }); return }
    const ok = (p: GeolocationPosition) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
    const attempt = (high: boolean) => navigator.geolocation.getCurrentPosition(ok, (e) => { if (e.code === 1) reject(e); else if (!high) attempt(true); else resolve(null) }, { enableHighAccuracy: high, maximumAge: high ? 0 : 60_000, timeout: high ? 12_000 : 8_000 })
    attempt(false)
  })
  const doCheckIn = async () => {
    setBusy(true); setHelp(null)
    try {
      const pos = navigator.geolocation ? await readPosition() : null
      if (!pos && state.location.status !== 'granted') { setHelp('Tu ubicación está en modo manual o sin permiso, así que no podemos comprobar dónde estás. Activa la ubicación del dispositivo (Ubicación en tu perfil) o pide que te confirmen.'); return }
      const err = await checkIn(plan.id, pos ? { lat: pos.lat, lng: pos.lng } : null, pos?.accuracy)
      if (typeof err === 'string') setHelp(err); else toast(err.punctuality ? `Llegaste ${err.punctuality} · +${err.xp} XP` : '¡Listo! Ya llegaste')
    } catch (e) {
      const code = (e as GeolocationPositionError).code
      setHelp(code === 1 ? 'Permite la ubicación en tu navegador para verificar que llegaste.' : 'Tu dispositivo no pudo darnos tu ubicación.')
    } finally { setBusy(false) }
  }

  if (!member) return <JoinButton plan={plan} className="h-12 rounded-md text-base" label="Jalo" />
  return (
    <section aria-label="Acciones" className="flex flex-col gap-2.5">
      {!arrivedAt && lobby === 'open' && (
          <>
            <Button size="lg" full loading={busy} onClick={doCheckIn}>{busy ? 'Verificando…' : 'Ya llegué'}</Button>
            <p className="text-caption font-semibold text-muted">{(() => { const a = arrivalXP(dueAt(plan.startsAt, myJoined)); return a.label === 'temprano' ? `Llegas temprano: +${a.xp} XP` : a.label === 'a tiempo' ? `Llegas a tiempo: +${a.xp} XP` : `Llegas tarde: solo +${a.xp} XP. Llegar antes del inicio da hasta +30.` })()}</p>
            {help && !busy && (
              <div role="alert" className="flex flex-col gap-0.5 rounded-md border border-line bg-accent-soft px-3 py-2.5 text-sm">
                <strong className="text-accent-text">Aún no estás verificado</strong>
                <span className="text-text">{help}</span>
                <span className="font-semibold text-text">{organizer ? (anyArrived ? 'Pide a alguien que ya llegó que te confirme.' : 'Intenta otra vez cuando estés en el lugar.') : `Pide a quien organiza${anyArrived ? ' o a alguien que ya llegó' : ''} que te verifique.`}</span>
              </div>
            )}
            {!help && !busy && <p className="text-caption font-semibold text-muted">Aún no has llegado.</p>}
          </>
        )}
      <div className="flex flex-wrap gap-2">
        {organizer ? (
          <>
            {planPhase(plan) === 'live'
              ? <Button variant="secondary" className="h-11 flex-1 rounded-md px-3 text-sm" onClick={() => setSheet('finish')}>Terminar ahora</Button>
              : <Button variant="secondary" className="h-11 flex-1 rounded-md px-3 text-sm" onClick={() => setSheet('edit')}>Editar fecha y hora</Button>}
            <Button variant="ghost" className="h-11 flex-1 rounded-md px-3 text-sm !text-danger" onClick={() => setSheet('cancel')}>Cancelar plan</Button>
          </>
        ) : !arrivedAt && (
          <Button variant="ghost" className="h-11 flex-1 rounded-md px-3 text-sm !text-danger" onClick={() => setSheet('leave')}>Cancelar mi lugar</Button>
        )}
      </div>

      <EditTimeSheet plan={sheet === 'edit' ? asMy : null} onClose={() => setSheet(null)} />
      <CancelSheet plan={sheet === 'cancel' ? asMy : null} onClose={() => { setSheet(null) }} />
      <FinishSheet plan={sheet === 'finish' ? asMy : null} onClose={() => setSheet(null)} />
      <ModalSheet open={sheet === 'leave'} title="¿Cancelar tu lugar?" onClose={() => setSheet(null)}>
        <LeaveBody plan={plan} onKeep={() => setSheet(null)} onLeave={async () => { if (await leavePlan(plan.id)) { toast('Cancelaste tu lugar'); setSheet(null); nav('/planes') } }} />
      </ModalSheet>
    </section>
  )
}

function LeaveBody({ plan, onKeep, onLeave }: { plan: ReturnType<typeof useApp>['state']['plans'][number]; onKeep: () => void; onLeave: () => void }) {
  const inProgress = joinedInProgress(plan.startsAt, plan.roster?.find((r) => r.userId === ME_ID)?.joinedAt)
  const pen = inProgress ? null : leavePenalty(plan)
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-sm leading-normal text-text"><strong>{plan.line}</strong> sigue en pie; solo sales tú.</p>
      {pen === null
        ? <p role="status" className="text-sm font-bold">{inProgress ? 'Te uniste con el plan ya en curso: no pierdes XP.' : 'Quien organiza cambió la hora o el lugar hace poco: no pierdes XP.'}</p>
        : <p role="status" className="text-sm font-bold text-danger">Perderás {pen.xp} XP{pen.miss ? ' y cuenta para tu confiabilidad' : ''}. {pen.miss ? 'Cancelaste muy cerca del inicio.' : `Faltan ${minutesUntilStart(plan)} min para que empiece.`}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onKeep}>Mantener</Button>
        <Button variant="dark" onClick={onLeave}>Cancelar mi lugar</Button>
      </div>
    </div>
  )
}
