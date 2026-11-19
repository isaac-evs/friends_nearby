import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Clock, MapPin, Megaphone, MessageCircle, Pencil, Share2, Trash2, Users } from 'lucide-react'
import { Avatar, AvatarStack, Button, ModalSheet, ProgressBar, SearchField, Toggle, matchesName, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { api } from '@/api/client'
import { ME_ID } from '@/api/me'
import { EVENT_TYPES } from '@/lib/category'
import { eventRange, formatApproxDistance, formatAgo } from '@/lib/format'
import { eventDistanceM } from '@/lib/reach'
import { joinBlock } from '@/lib/commitments'
import { countdownLabel, planPhase } from '@/lib/planTime'
import { useClock } from '@/app/hooks'
import { cn } from '@/lib/cn'
import { ChatPanel } from '@/features/plans/ChatPanel'
import { OpenModeSheet, useOpenModeReady } from './OpenModeSheet'
import { EditEventSheet } from './EditEventSheet'

/** Detalle de evento: la foto es el hero (con cuánto falta), descripción, avisos, chat (si quien organiza lo activa) y quién organiza. */
export function EventScreen() {
  const { id } = useParams()
  const { state } = useApp()
  const { joinEvent, leaveEvent, approveAttendance, cancelEvent, postAnnouncement, deleteAnnouncement, setEventChat, eventMessage, deleteEventMessage } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const ready = useOpenModeReady()
  const now = useClock()
  const [who, setWho] = useState(false)
  const [whoQ, setWhoQ] = useState('')
  const [gate, setGate] = useState(false)
  const [edit, setEdit] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const ev = state.events.find((e) => e.id === id)
  const att = state.attendances.find((a) => a.eventId === id)
  const userId = state.session?.userId ?? ME_ID
  const [seen, setSeen] = useState(() => (id ? api.notifications.chatSeen(userId, id) : ''))
  const lastAt = ev?.timeline?.at(-1)?.at ?? ''
  useEffect(() => { if (chatOpen && id && lastAt && lastAt > seen) { api.notifications.markChatSeen(userId, id, lastAt); setSeen(lastAt) } }, [chatOpen, lastAt, seen, id, userId])
  if (!ev) return <Navigate to="/" replace />

  const t = EVENT_TYPES[ev.type]
  const mine = ev.organizerId === ME_ID
  const going = ev.going
  const friendsGoing = ev.friendsGoingIds.map((f) => state.users[f]).filter((u): u is NonNullable<typeof u> => !!u && !state.blocks.includes(u.id))
  const attendees = (state.attendees[ev.id] ?? []).map((u) => state.users[u]).filter((u): u is NonNullable<typeof u> => !!u && !state.blocks.includes(u.id))
  const names = friendsGoing.map((u) => u.name)
  const goingText = names.length === 0 ? '' : names.length === 1 ? `${names[0]} va` : `${names.slice(0, -1).join(', ')} y ${names.at(-1)} van`
  const full = going >= ev.capacity && !att
  const phase = planPhase(ev, now)
  const why = att || mine ? null : joinBlock(state, ev, `event:${ev.id}`, now)
  const hero = !!ev.photoUrl
  const left = countdownLabel(ev, now)
  const organizer = ev.organizerId ? state.users[ev.organizerId] : undefined
  const canChat = ev.chatEnabled && (mine || att?.status === 'going')
  const unread = chatOpen ? 0 : (ev.timeline ?? []).filter((m) => m.userId !== ME_ID && m.at > seen).length
  const announcements = [...(ev.announcements ?? [])].reverse()

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link del evento copiado') } catch { toast('No pudimos copiar el link') }
  }
  const join = () => {
    if (full || why) { toast(why ?? 'Cupo lleno'); return }
    if (!ready) { setGate(true); return }
    void joinEvent(ev.id)
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg lg:min-h-0 lg:bg-transparent">
      {/* Hero: la foto del evento (o el color del tipo) con el nombre, cuándo es y cuánto falta. */}
      <header className={cn('relative flex h-[260px] flex-col justify-between overflow-hidden border-b border-line px-[22px] pt-[34px] pb-5 lg:h-[300px] lg:rounded-card lg:border lg:px-10 lg:pt-8 lg:pb-8', hero ? 'bg-ink text-white' : 'bg-accent text-ink')}>
        {hero
          ? <><img src={ev.photoUrl} alt="" className="absolute inset-0 size-full object-cover" /><span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10" /></>
          : <span aria-hidden="true" className="absolute top-[30px] -right-10 text-ink opacity-[0.12]">{t.icon({ size: 220, strokeWidth: 1.2 })}</span>}
        <div className="relative flex justify-between">
          <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 items-center justify-center rounded-full text-ink"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></button>
          <div className="flex gap-2">
            {canChat && (
              <button type="button" onClick={() => setChatOpen(true)} aria-label={unread ? `Abrir chat (${unread} sin leer)` : 'Abrir chat'} className="relative flex size-11 items-center justify-center rounded-full text-ink">
                <MessageCircle aria-hidden="true" size={20} />
                {unread > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-bold text-ink">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}
            <button type="button" aria-label="Compartir evento" onClick={share} className="flex size-11 items-center justify-center rounded-full text-ink"><Share2 aria-hidden="true" size={20} /></button>
          </div>
        </div>
        <div className="relative flex flex-col gap-2">
          <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-caption font-extrabold', phase === 'live' ? 'bg-cat-musica text-success-text' : 'bg-surface text-ink')}>
            {phase === 'live' && <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-success motion-reduce:animate-none" />}
            <Clock aria-hidden="true" size={13} strokeWidth={2.6} />{left[0]!.toUpperCase() + left.slice(1)}
          </span>
          <h1 className="text-[32px] leading-none font-extrabold tracking-[-1px] lg:max-w-[640px] lg:text-[40px]">{ev.title}</h1>
          <span className="text-[15px] font-bold">{eventRange(ev)}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 px-[22px] pt-4 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-5 lg:px-0 lg:pt-6">
        {ev.description && (
          <section aria-label="Descripción" className="rounded-lg border border-line bg-surface p-3.5 lg:col-span-2">
            <p className="text-sm leading-normal whitespace-pre-wrap text-text">{ev.description}</p>
          </section>
        )}

        <section aria-label="Detalles" className="rounded-[18px] border border-line bg-surface px-3.5 py-1 shadow-md">
          <Row icon={<MapPin aria-hidden="true" size={20} />} border>
            <span className="text-sm font-bold">{ev.placeNote ?? ev.placeName}</span>
            <span className="text-caption font-medium text-muted">A {formatApproxDistance(eventDistanceM(ev, state.location.center))} de ti</span>
          </Row>
          <Row icon={<Users aria-hidden="true" size={20} />} border>
            <span className="text-sm font-bold">{going} van · cupo {ev.capacity}</span>
            <ProgressBar value={(going / ev.capacity) * 100} label="Cupo ocupado" tone="success" height="h-2.5" />
          </Row>
          {/* Quien organiza: se puede abrir su perfil. Con alias, el nombre real SIEMPRE se muestra. */}
          <Link to={mine ? '/perfil' : `/u/${ev.organizerId}`} aria-label={`Ver el perfil de ${ev.organizer.name}, quien organiza`} className="flex min-h-[60px] items-center gap-3 py-1.5">
            <Avatar userId={ev.organizerId ?? 'org'} name={ev.organizer.name} size={40} src={organizer?.avatarUrl} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-caption font-bold tracking-[0.6px] text-muted uppercase">Organiza</span>
              <span className="truncate text-sm font-extrabold">{ev.organizer.alias ?? ev.organizer.name}</span>
              <span className="truncate text-caption font-medium text-muted">{ev.organizer.alias ? `por ${ev.organizer.name} · ` : ''}{ev.organizer.eventsCount} eventos</span>
            </span>
            <ChevronRight aria-hidden="true" size={18} className="text-muted" />
          </Link>
        </section>

        <div className="flex items-center gap-2.5">
          {friendsGoing.length > 0 && <AvatarStack people={friendsGoing} />}
          <span className="text-meta font-bold">{goingText || `${going} personas van`}</span>
          <button type="button" onClick={() => setWho(true)} className="ml-auto min-h-11 text-meta font-bold text-primary">Ver quién más va</button>
        </div>

        {/* Avisos: los pone quien organiza. */}
        {(announcements.length > 0 || mine) && (
          <section aria-label="Avisos del evento" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted p-3.5 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-meta font-extrabold text-ink"><Megaphone aria-hidden="true" size={16} />Avisos del evento</h2>
            {announcements.length === 0 && <p className="text-sm text-text">Aún no publicas avisos. Aquí van los cambios y recordatorios para quienes van.</p>}
            <ul className="flex flex-col gap-2">
              {announcements.map((a) => (
                <li key={a.id} className="flex items-start gap-2 border-l-2 border-accent pl-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm leading-snug font-semibold whitespace-pre-wrap text-ink">{a.text}</span><span className="text-caption text-muted">{formatAgo(a.at, now)}</span></span>
                  {mine && <button type="button" aria-label="Borrar aviso" onClick={() => void deleteAnnouncement(ev.id, a.id)} className="-mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center text-muted"><Trash2 aria-hidden="true" size={16} /></button>}
                </li>
              ))}
            </ul>
            {mine && (
              <form onSubmit={async (e) => { e.preventDefault(); if (!notice.trim()) return; if (await postAnnouncement(ev.id, notice)) { setNotice(''); toast('Aviso publicado') } }} className="flex flex-col gap-2">
                <label><span className="sr-only">Nuevo aviso</span>
                  <textarea value={notice} onChange={(e) => setNotice(e.target.value.slice(0, 500))} rows={2} placeholder="Escribe un aviso para quienes van…" className="w-full resize-none rounded-md border border-line-input bg-surface px-3 py-2.5 text-base leading-snug placeholder:text-placeholder" />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption text-muted">{notice.length}/500</span>
                  <Button type="submit" className="h-11 rounded-full px-5 text-sm" disabled={!notice.trim()}>Publicar aviso</Button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Controles de quien organiza. */}
        {mine && (
          <section aria-label="Administrar el evento" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3.5 lg:col-span-2">
            <h2 className="text-meta font-extrabold">Administrar</h2>
            <div className="flex min-h-[56px] items-center gap-3">
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Chat del evento</span><span className="text-caption font-medium text-muted">{ev.chatEnabled ? 'Quienes van pueden escribir. Tú puedes borrar mensajes.' : 'Apagado: nadie puede escribir.'}</span></span>
              <Toggle checked={!!ev.chatEnabled} onChange={(v) => void setEventChat(ev.id, v)} label="Chat del evento" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" icon={<Pencil aria-hidden="true" size={16} />} onClick={() => setEdit(true)}>Editar</Button>
              <Button variant="ghost" className="!text-danger" icon={<Trash2 aria-hidden="true" size={16} />} onClick={() => setConfirmCancel(true)}>Cancelar evento</Button>
            </div>
          </section>
        )}
      </div>

      {mine && (state.pendingAttendees[ev.id] ?? []).length > 0 && <section aria-label="Solicitudes para el evento" className="px-5 py-4">
        <h2 className="font-bold">Solicitudes para unirse</h2>
        {(state.pendingAttendees[ev.id] ?? []).map((uid) => <div key={uid} className="flex items-center gap-3 py-2"><span className="flex-1">{state.users[uid]?.name}</span><Button onClick={() => approveAttendance(ev.id, uid, true)}>Aceptar</Button><Button variant="secondary" onClick={() => approveAttendance(ev.id, uid, false)}>Rechazar</Button></div>)}
      </section>}

      <div className="sticky bottom-0 border-t border-line bg-surface px-[22px] pt-3.5 pb-[22px] lg:rounded-xl lg:border lg:px-6 lg:pt-4 lg:pb-4 lg:shadow-lg">
        {mine && !att && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-estudiar"><Check aria-hidden="true" size={24} strokeWidth={2.8} /></span>
            <span className="flex flex-1 flex-col"><span className="text-[19px] font-extrabold">Tú organizas este evento</span><span className="text-caption font-medium text-muted">{going} van · consulta tus planes desde Mis planes</span></span>
          </div>
        )}
        {!att && !mine && (
          <div className="flex flex-col gap-2">
            {why && <p id="join-why" role="status" className="text-caption font-semibold text-danger">{why}</p>}
            <Button size="lg" full className="text-[15px] font-bold" aria-disabled={full || !!why ? 'true' : undefined} aria-describedby={why ? 'join-why' : undefined} onClick={join}>
              {phase === 'ended' ? 'Ya terminó' : full ? 'Cupo lleno' : ev.requiresApproval ? 'Pedir unirme' : `Me uno · +${ev.xp} XP`}
            </Button>
          </div>
        )}
        {att?.status === 'going' && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-comer"><Check aria-hidden="true" size={24} strokeWidth={2.8} /></span>
            <span className="flex flex-1 flex-col"><span className="text-[19px] font-extrabold">¡Estás dentro!</span><span className="text-caption font-medium text-muted">Consulta aquí los detalles y los avisos.</span></span>
            <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-meta" onClick={() => leaveEvent(ev.id)}>Salirme</Button>
          </div>
        )}
        {att?.status === 'pending' && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-estudiar"><Clock aria-hidden="true" size={22} /></span>
            <span className="flex flex-1 flex-col"><span className="text-lg font-extrabold">Solicitud enviada</span><span className="text-caption font-medium text-muted">{ev.organizer.name} decide si entras.</span></span>
            <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-meta" onClick={() => leaveEvent(ev.id)}>Cancelar</Button>
          </div>
        )}
      </div>

      <ModalSheet open={who} title="Quién más va" onClose={() => setWho(false)}>
        <p className="mb-3 text-caption text-muted">En eventos solo se ve nombre y avatar, nunca ubicación.</p>
        {attendees.length > 6 && <SearchField value={whoQ} onChange={setWhoQ} className="mb-3" />}
        {whoQ.trim() && !attendees.some((u) => matchesName(u.name, whoQ)) && <p role="status" className="py-2 text-sm text-muted">Nadie se llama así en este evento.</p>}
        <ul className="flex flex-col">
          {attendees.filter((u) => !whoQ.trim() || matchesName(u.name, whoQ)).map((u) => (
            <li key={u.id}>
              <Link to={`/u/${u.id}`} onClick={() => setWho(false)} className="flex min-h-14 items-center gap-3 border-b border-surface-sunken py-1.5">
                <Avatar userId={u.id} name={u.name} size={40} src={u.avatarUrl} />
                <span className="flex-1 text-[15px] font-bold">{u.name}</span>
                {state.friendships[u.id]?.status === 'friends' && <span className="text-caption font-bold text-muted">Amigo</span>}
              </Link>
            </li>
          ))}
        </ul>
      </ModalSheet>

      <OpenModeSheet open={gate} onClose={() => setGate(false)} />
      {mine && <EditEventSheet ev={edit ? ev : null} onClose={() => setEdit(false)} />}
      <ModalSheet open={confirmCancel} title="¿Cancelar el evento?" onClose={() => setConfirmCancel(false)}>
        <div className="flex flex-col gap-3.5">
          <p className="text-sm leading-normal text-text"><strong>{ev.title}</strong> se cancela para todos{going > 1 ? ` (${going - 1} ${going - 1 === 1 ? 'persona ya iba' : 'personas ya iban'})` : ''}. No se puede deshacer.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>Mantener</Button>
            <Button variant="dark" onClick={async () => { if (await cancelEvent(ev.id)) { toast('Evento cancelado'); setConfirmCancel(false); nav('/planes') } }}>Cancelar evento</Button>
          </div>
        </div>
      </ModalSheet>
      {chatOpen && canChat && (
        <ChatPanel
          chat={{ id: ev.id, title: ev.title, ownerId: ev.organizerId ?? '', memberIds: [ev.organizerId ?? '', ...(state.attendees[ev.id] ?? [])], timeline: ev.timeline }}
          readOnly={phase === 'ended'} onSend={(text) => eventMessage(ev.id, text)} onDelete={mine ? (m) => void deleteEventMessage(ev.id, m) : undefined} onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}

function Row({ icon, border, children }: { icon: React.ReactNode; border?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-h-[54px] items-center gap-3 py-1.5', border && 'border-b border-surface-sunken')}>
      <span className="text-ink">{icon}</span>
      <span className="flex flex-1 flex-col gap-1">{children}</span>
    </div>
  )
}
