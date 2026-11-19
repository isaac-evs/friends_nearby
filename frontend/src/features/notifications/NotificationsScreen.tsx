import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BellOff, CheckCheck, Settings2, Trash2 } from 'lucide-react'
import { Avatar, Button, EmptyState, IconButton, ModalSheet, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { formatAgo, minutesLabel } from '@/lib/format'
import { BUCKETS, bucketOf, namesLabel, needsAction, type NotificationGroup } from '@/lib/notifications'
import { OpenModeSheet, useOpenModeReady } from '@/features/events/OpenModeSheet'
import { useNotifications } from './useNotifications'

const card = 'flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3'

/** `/notificaciones`: todo lo que pasa a tu alrededor, agrupado Hoy · Esta semana · Antes. Lo que pide respuesta se responde aquí mismo. */
export function NotificationsScreen() {
  const { state } = useApp()
  const { respondInvite, acceptClose, declineClose, setFriendStatus, startExact, declineExactRequest } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const n = useNotifications()
  const [why, setWhy] = useState<Record<string, string>>({})
  // Borrado suave: se oculta y se puede deshacer unos segundos.
  const [undo, setUndo] = useState<string[] | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [gate, setGate] = useState(false)
  const ready = useOpenModeReady()
  const undoTimer = useRef<number | undefined>(undefined)
  const remove = (ids: string[]) => {
    n.dismiss(ids); setUndo(ids)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000)
  }
  const deletable = n.groups.filter((g) => !needsAction(g.items[0]!))
  const [now] = useState(() => Date.now())
  const name = (id: string) => state.users[id]?.name ?? 'Alguien'

  const answer = async (inviteId: string, accept: boolean) => {
    // Todos los eventos piden el modo abierto: primero se activa.
    if (accept && !ready && state.invites.find((i) => i.id === inviteId)?.kind === 'evento') { setGate(true); return }
    const r = await respondInvite(inviteId, accept)
    if (!r.ok) { setWhy((w) => ({ ...w, [inviteId]: r.reason ?? 'No se pudo.' })); return }
    if (!accept) return
    const inv = state.invites.find((i) => i.id === inviteId)
    toast('Te uniste')
    if (inv) nav(inv.kind === 'plan' ? `/plan/${inv.targetId}` : `/evento/${inv.targetId}`)
  }

  const byBucket = BUCKETS.map((b) => ({ bucket: b, rows: n.groups.filter((g) => bucketOf(g.at, now) === b) })).filter((x) => x.rows.length > 0)
  const unread = (g: NotificationGroup) => !needsAction(g.items[0]!) && new Date(g.at).getTime() > n.readAt

  const render = (g: NotificationGroup) => {
    const first = g.items[0]!
    const who = g.userIds[0] ?? ''
    const names = namesLabel(g.userIds.map(name))
    const many = g.userIds.length > 1
    const person = <Avatar userId={who} name={name(who)} size={40} src={state.users[who]?.avatarUrl} />
    const dot = unread(g) && <span role="img" aria-label="Nuevo" className="size-2.5 shrink-0 rounded-full bg-accent" />
    const del = !needsAction(first) && (
      <button type="button" aria-label="Eliminar notificación" onClick={() => remove(g.items.map((i) => i.id))} className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted"><Trash2 aria-hidden="true" size={18} /></button>
    )
    const head = (text: string, sub?: string) => (
      <div className="flex items-center gap-3">
        {g.userIds.length > 0 ? person : <span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-surface-sunken" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">{text}</span>
          {sub && <span className="text-caption text-muted">{sub}</span>}
        </div>
        {dot}
        {del}
      </div>
    )
    const link = (to: string, label: string) => <Link to={to} className="inline-flex min-h-11 items-center self-start text-sm font-bold text-primary">{label}</Link>
    const planTo = g.planId ? `/plan/${g.planId}` : undefined
    const quoted = g.title ? `"${g.title}"` : ''

    switch (g.type) {
      case 'invite': {
        const open = needsAction(first)
        const kind = first.inviteKind === 'plan' ? 'un plan' : 'un evento'
        return (
          <li key={g.key} className={card}>
            {head(`${name(who)} te invitó a ${kind}`, `${quoted} · ${formatAgo(g.at, now)}`)}
            {why[first.inviteId!] && <p role="alert" className="text-caption font-semibold text-danger">{why[first.inviteId!]}</p>}
            {open ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" aria-label={`Ahora no: invitación de ${name(who)}`} onClick={() => answer(first.inviteId!, false)}>Ahora no</Button>
                <Button aria-label={`Aceptar la invitación de ${name(who)}`} onClick={() => answer(first.inviteId!, true)}>Aceptar</Button>
              </div>
            ) : <p className="text-caption font-semibold text-muted">{first.inviteStatus === 'accepted' ? 'Dijiste que sí' : 'Dijiste que ahora no'}</p>}
          </li>
        )
      }
      case 'friend':
        return (
          <li key={g.key} className={card}>
            {head(name(who), 'quiere ser tu amigo')}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" aria-label={`Rechazar la solicitud de ${name(who)}`} onClick={() => setFriendStatus(who, 'none')}>Rechazar</Button>
              <Button aria-label={`Aceptar la solicitud de ${name(who)}`} onClick={async () => { if (!await setFriendStatus(who, 'friends')) return; toast(`${name(who)} ya es tu amigo`) }}>Aceptar</Button>
            </div>
          </li>
        )
      case 'close':
        return (
          <li key={g.key} className={card}>
            {head(name(who), 'quiere ser tu amigo cercano · se verían la ubicación aproximada')}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" aria-label={`Ahora no: ${name(who)} (amigo cercano)`} onClick={() => declineClose(who)}>Ahora no</Button>
              <Button aria-label={`Aceptar a ${name(who)} como amigo cercano`} onClick={async () => { if (!await acceptClose(who)) return; toast(`${name(who)} ya es amigo cercano`) }}>Aceptar</Button>
            </div>
          </li>
        )
      case 'exact':
        return (
          <li key={g.key} className={card}>
            {head(`${name(who)} te pide tu ubicación exacta`, 'Tú decides si la compartes y por cuánto tiempo.')}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => declineExactRequest(who)}>Ahora no</Button>
              <Button onClick={() => startExact(who, 60)}>Compartir por 1 h</Button>
            </div>
          </li>
        )
      case 'reply':
        return <li key={g.key} className={card}>{head(`${name(who)} ${first.inviteStatus === 'accepted' ? 'aceptó tu invitación a' : 'no puede ir a'} ${quoted}`, formatAgo(g.at, now))}</li>
      case 'join':
        return <li key={g.key} className={card}>{head(`${names} ${many ? 'se unieron' : 'se unió'} a tu plan`, `${quoted} · ${formatAgo(g.at, now)}`)}{planTo && link(planTo, 'Ver plan')}</li>
      case 'checkin':
        return <li key={g.key} className={card}>{head(`${names} ${many ? 'llegaron' : 'llegó'}`, `${quoted} · ${formatAgo(g.at, now)}`)}{planTo && link(planTo, 'Ver plan')}</li>
      case 'message':
        return <li key={g.key} className={card}>{head(`${name(who)}: "${first.text}"`, `${quoted} · ${formatAgo(g.at, now)}`)}{planTo && link(planTo, 'Abrir plan')}</li>
      case 'changed':
        return <li key={g.key} className={card}>{head(`${name(who)} cambió la hora o el lugar`, `${quoted} · ${formatAgo(g.at, now)}`)}{planTo && link(planTo, 'Ver cambios')}</li>
      case 'starts': {
        const plan = state.plans.find((p) => p.id === g.planId)
        const left = plan ? Math.max(1, (new Date(plan.startsAt).getTime() - now) / 60_000) : 10
        return <li key={g.key} className={card}>{head(`Tu plan empieza en ${minutesLabel(left)}`, quoted)}{planTo && link(planTo, 'Ver plan')}</li>
      }
      case 'near':
        return <li key={g.key} className={card}>{head(`${name(who)} está cerca`, formatAgo(g.at, now))}{link(`/u/${who}`, 'Ver perfil')}</li>
    }
  }

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[640px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="flex-1 text-h1 font-extrabold">Notificaciones</h1>
        <Link to="/notificaciones/preferencias" aria-label="Preferencias de notificaciones" className="flex size-11 items-center justify-center rounded-full"><Settings2 aria-hidden="true" size={20} /></Link>
      </header>

      {undo && (
        <div role="status" className="alert-motion flex items-center gap-3 rounded-xl bg-ink py-1 pr-1 pl-4 text-sm font-bold text-white shadow-md">
          <span className="flex-1">Notificación eliminada</span>
          <button type="button" onClick={() => { n.restore(undo); setUndo(null) }} className="min-h-11 rounded-full px-4 text-sm font-extrabold text-accent">Deshacer</button>
        </div>
      )}

      {n.groups.length === 0 ? (
        <EmptyState icon={<BellOff aria-hidden="true" size={30} />} title="Todo al día" text="Aquí te llegan invitaciones, solicitudes y lo que pasa en tus planes." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-muted">{n.count > 0 ? `${n.count} esperan tu respuesta` : 'Nada espera tu respuesta'}</span>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 rounded-md px-3 text-sm" onClick={n.markAllRead} disabled={!n.dot}><CheckCheck aria-hidden="true" size={16} className="mr-1.5" />Marcar leído</Button>
              <Button variant="secondary" className="h-11 rounded-md px-3 text-sm" onClick={() => setConfirmAll(true)} disabled={deletable.length === 0}><Trash2 aria-hidden="true" size={16} className="mr-1.5" />Eliminar todas</Button>
            </div>
          </div>
          {byBucket.map(({ bucket, rows }) => (
            <section key={bucket} aria-labelledby={`nb-${bucket}`} className="flex flex-col gap-2">
              <h2 id={`nb-${bucket}`} className="text-meta font-bold">{bucket}</h2>
              <ul className="flex flex-col gap-2">{rows.map(render)}</ul>
            </section>
          ))}
        </>
      )}

      <OpenModeSheet open={gate} onClose={() => setGate(false)} />
      <ModalSheet open={confirmAll} title="¿Eliminar las notificaciones?" onClose={() => setConfirmAll(false)}>
        <div className="flex flex-col gap-3.5">
          <p className="text-sm leading-normal text-text">Se eliminan {deletable.length} {deletable.length === 1 ? 'notificación' : 'notificaciones'}. Las invitaciones y solicitudes que esperan tu respuesta se quedan.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setConfirmAll(false)}>Cancelar</Button>
            <Button variant="dark" onClick={() => { remove(deletable.flatMap((g) => g.items.map((i) => i.id))); setConfirmAll(false) }}>Eliminar</Button>
          </div>
        </div>
      </ModalSheet>
    </div>
  )
}
