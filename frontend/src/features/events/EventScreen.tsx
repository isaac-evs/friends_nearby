import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Check, Clock, MapPin, Share2, Users } from 'lucide-react'
import { Avatar, AvatarStack, Button, ModalSheet, Notice, ProgressBar, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { EVENT_TYPES } from '@/lib/category'
import { eventRange, formatApproxDistance } from '@/lib/format'
import { eventDistanceM } from '@/lib/reach'
import { joinBlock } from '@/lib/commitments'
import { countdownLabel, planPhase } from '@/lib/planTime'
import { useClock } from '@/app/hooks'
import { cn } from '@/lib/cn'

/** Pantalla 10: Detalle de evento (ritmo, Me uno / Salirme, "Ver quién más va"). */
export function EventScreen() {
  const { id } = useParams()
  const { state } = useApp()
  const { joinEvent, leaveEvent, setPace, approveAttendance } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const [who, setWho] = useState(false)
  const now = useClock()
  const ev = state.events.find((e) => e.id === id)
  const att = state.attendances.find((a) => a.eventId === id)
  const [pace, setLocalPace] = useState<string | null>(null)
  if (!ev) return <Navigate to="/" replace />

  const t = EVENT_TYPES[ev.type]
  const chosenPace = att?.pace ?? pace ?? ev.paces?.[1] ?? ev.paces?.[0]
  const going = ev.going
  const friendsGoing = ev.friendsGoingIds.map((f) => state.users[f]).filter((u): u is NonNullable<typeof u> => !!u && !state.blocks.includes(u.id))
  const attendees = (state.attendees[ev.id] ?? []).map((u) => state.users[u]).filter((u): u is NonNullable<typeof u> => !!u && !state.blocks.includes(u.id))
  const names = friendsGoing.map((u) => u.name)
  const goingText = names.length === 0 ? '' : names.length === 1 ? `${names[0]} va` : `${names.slice(0, -1).join(', ')} y ${names.at(-1)} van`
  const full = going >= ev.capacity && !att
  const phase = planPhase(ev, now)
  const mine = ev.organizerId === 'me'
  // Solo un plan o evento a la vez; y si ya empezó, solo si quien organiza lo permite.
  const why = att || mine ? null : joinBlock(state, ev, `event:${ev.id}`, now)

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast('Link del evento copiado') } catch { toast('No pudimos copiar el link') }
  }
  const pickPace = (p: string) => { setLocalPace(p); if (att) setPace(ev.id, p) }

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg lg:min-h-0 lg:bg-transparent">
      <header className="relative flex h-[246px] flex-col gap-3 overflow-hidden border-b border-line bg-accent px-[22px] pt-[34px] pb-5 lg:h-[280px] lg:rounded-card lg:border lg:px-10 lg:pt-8 lg:pb-8 lg:[&>h1]:max-w-[640px] lg:[&>h1]:text-[48px]">
        <span aria-hidden="true" className="absolute top-[30px] -right-10 text-ink opacity-[0.12]">{t.icon({ size: 220, strokeWidth: 1.2 })}</span>
        <div className="relative flex justify-between">
          <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></button>
          <button type="button" aria-label="Compartir evento" onClick={share} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"><Share2 aria-hidden="true" size={20} /></button>
        </div>
        <span className="relative self-start rounded-sm border border-line bg-surface px-2.5 py-0.5 text-caption font-bold">Evento público</span>
        <h1 className="relative text-[34px] leading-none font-extrabold tracking-[-1px]">{ev.title}</h1>
        <span className="relative text-[15px] font-bold">{eventRange(ev)}{ev.audienceNote ? ` · ${ev.audienceNote}` : ''}</span>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 px-[22px] pt-4 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-5 lg:px-0 lg:pt-6">
        {ev.photoUrl && <img src={ev.photoUrl} alt="Foto del evento" className="h-44 w-full rounded-lg border border-line object-cover lg:col-span-2" />}
        {(phase === 'live' || phase === 'ended' || (phase === 'upcoming' && new Date(ev.startsAt).getTime() - now < 86_400_000)) && (
          <p role="status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-bold lg:col-span-2">{countdownLabel(ev, now)[0]!.toUpperCase() + countdownLabel(ev, now).slice(1)}{phase === 'live' ? ' · todavía puedes unirte' : ''}</p>
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
          <Row icon={<span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-white"><Check aria-hidden="true" size={14} strokeWidth={3} /></span>}>
            <span className="text-sm font-bold">{ev.organizer.alias ?? ev.organizer.name}</span>
            {/* Con alias, el nombre real SIEMPRE se muestra. */}
            <span className="text-caption font-medium text-muted">{ev.organizer.alias ? `por ${ev.organizer.name} · ` : ''}{ev.organizer.verified ? 'Organizador verificado · ' : ''}{ev.organizer.eventsCount} eventos</span>
          </Row>
        </section>

        <div className="flex items-center gap-2.5">
          {friendsGoing.length > 0 && <AvatarStack people={friendsGoing} />}
          <span className="text-meta font-bold">{goingText || `${going} personas van`}</span>
          <button type="button" onClick={() => setWho(true)} className="ml-auto min-h-11 text-meta font-bold text-primary">Ver quién más va</button>
        </div>

        {ev.paces && (
          <fieldset>
            <legend className="mb-2 text-meta font-bold">Tu ritmo</legend>
            <div className="flex flex-wrap gap-2">
              {ev.paces.map((p) => (
                <button key={p} type="button" aria-pressed={chosenPace === p} onClick={() => pickPace(p)}
                  className={cn('h-11 rounded-full border border-line px-3.5 text-meta font-bold', chosenPace === p ? 'bg-primary text-white' : 'bg-surface text-ink')}>
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Notice tone="safety" icon="shield">Tú decides: la gente nueva solo ve tu nombre. Tu ubicación no se comparte y puedes salirte cuando quieras.</Notice>
      </div>

      {mine && (state.pendingAttendees[ev.id] ?? []).length > 0 && <section aria-label="Solicitudes para el evento" className="px-5 py-4">
        <h2 className="font-bold">Solicitudes para unirse</h2>
        {(state.pendingAttendees[ev.id] ?? []).map(uid => <div key={uid} className="flex items-center gap-3 py-2"><span className="flex-1">{state.users[uid]?.name}</span><Button onClick={()=>approveAttendance(ev.id,uid,true)}>Aceptar</Button><Button variant="secondary" onClick={()=>approveAttendance(ev.id,uid,false)}>Rechazar</Button></div>)}
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
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" size="lg" className="text-[15px] font-bold" onClick={share}>Ir con un amigo</Button>
              <Button
                size="lg" className="text-[15px] font-bold" aria-disabled={full || !!why ? 'true' : undefined} aria-describedby={why ? 'join-why' : undefined}
                onClick={() => { if (full || why) { toast(why ?? 'Cupo lleno'); return } joinEvent(ev.id, chosenPace) }}
              >
                {phase === 'ended' ? 'Ya terminó' : full ? 'Cupo lleno' : ev.requiresApproval ? 'Pedir unirme' : `Me uno · +${ev.xp} XP`}
              </Button>
            </div>
          </div>
        )}
        {att?.status === 'going' && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-comer"><Check aria-hidden="true" size={24} strokeWidth={2.8} /></span>
            <span className="flex flex-1 flex-col"><span className="text-[19px] font-extrabold">¡Estás dentro!</span><span className="text-caption font-medium text-muted">{chosenPace ? `Grupo ${chosenPace} · ` : ''}consulta aquí los detalles del evento</span></span>
            <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-meta" onClick={() => leaveEvent(ev.id)}>Salirme</Button>
          </div>
        )}
        {att?.status === 'pending' && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-estudiar"><Clock aria-hidden="true" size={22} /></span>
            <span className="flex flex-1 flex-col"><span className="text-lg font-extrabold">Solicitud enviada</span><span className="text-caption font-medium text-muted">{ev.organizer.name} decide si entras</span></span>
            <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-meta" onClick={() => leaveEvent(ev.id)}>Cancelar</Button>
          </div>
        )}
      </div>

      <ModalSheet open={who} title="Quién más va" onClose={() => setWho(false)}>
        <p className="mb-3 flex items-center gap-1.5 text-caption text-muted"><Activity aria-hidden="true" size={14} />En eventos solo se ve nombre y avatar, nunca ubicación.</p>
        <ul className="flex flex-col">
          {attendees.map((u) => (
            <li key={u.id}>
              <Link to={`/u/${u.id}`} onClick={() => setWho(false)} className="flex min-h-14 items-center gap-3 border-b border-surface-sunken py-1.5">
                <Avatar userId={u.id} name={u.name} size={40} />
                <span className="flex-1 text-[15px] font-bold">{u.name}</span>
                {state.friendships[u.id]?.status === 'friends' && <span className="text-caption font-bold text-muted">Amigo</span>}
              </Link>
            </li>
          ))}
        </ul>
      </ModalSheet>
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
