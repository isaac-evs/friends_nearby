import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BellOff } from 'lucide-react'
import { Avatar, Button, EmptyState, IconButton, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { formatAgo } from '@/lib/format'
import { useNotifications } from './useNotifications'

/** `/notificaciones`: invitaciones a planes y eventos, solicitudes de amigo cercano y de amistad. Aquí las aceptas o rechazas. */
export function NotificationsScreen() {
  const { state } = useApp()
  const { respondInvite, acceptClose, declineClose, setFriendStatus } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const n = useNotifications()
  const [why, setWhy] = useState<Record<string, string>>({})
  const name = (id: string) => state.users[id]?.name ?? 'Alguien'

  const answer = (id: string, accept: boolean) => {
    const r = respondInvite(id, accept)
    if (!r.ok) { setWhy((w) => ({ ...w, [id]: r.reason ?? 'No se pudo.' })); return }
    if (!accept) return
    const inv = state.invites.find((i) => i.id === id)!
    toast('Te uniste')
    nav(r.matchId ? `/match/${r.matchId}` : `/evento/${inv.targetId}`)
  }

  const empty = n.count === 0 && n.replies.length === 0

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-[104px] lg:max-w-[640px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver" onClick={() => nav(-1)}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Notificaciones</h1>
      </header>

      {empty && <EmptyState icon={<BellOff aria-hidden="true" size={30} />} title="Todo al día" text="Aquí te llegan las invitaciones a planes y eventos y las solicitudes de tus amigos." />}

      {n.invites.length > 0 && (
        <section aria-labelledby="inv-h" className="flex flex-col gap-2">
          <h2 id="inv-h" className="text-meta font-bold">Invitaciones ({n.invites.length})</h2>
          {n.invites.map((i) => (
            <div key={i.id} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar userId={i.fromId} name={name(i.fromId)} size={40} src={state.users[i.fromId]?.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-bold">{name(i.fromId)} te invitó a {i.kind === 'plan' ? 'un plan' : 'un evento'}</span>
                  <span className="text-caption text-muted">«{i.title}» · {formatAgo(i.at)}</span>
                </div>
              </div>
              {why[i.id] && <p role="alert" className="text-caption font-semibold text-danger">{why[i.id]}</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" aria-label={`Ahora no: invitación de ${name(i.fromId)}`} onClick={() => answer(i.id, false)}>Ahora no</Button>
                <Button aria-label={`Aceptar la invitación de ${name(i.fromId)}`} onClick={() => answer(i.id, true)}>Aceptar</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {n.closeReq.length > 0 && (
        <section aria-labelledby="cc-h" className="flex flex-col gap-2">
          <h2 id="cc-h" className="text-meta font-bold">Amigo cercano ({n.closeReq.length})</h2>
          {n.closeReq.map((f) => (
            <div key={f.userId} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar userId={f.userId} name={name(f.userId)} size={40} src={state.users[f.userId]?.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/u/${f.userId}`} className="text-[15px] font-bold">{name(f.userId)}</Link>
                  <span className="text-caption text-muted">quiere ser tu amigo cercano · se verían la ubicación aproximada</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" aria-label={`Ahora no: ${name(f.userId)} (amigo cercano)`} onClick={() => declineClose(f.userId)}>Ahora no</Button>
                <Button aria-label={`Aceptar a ${name(f.userId)} como amigo cercano`} onClick={() => { acceptClose(f.userId); toast(`${name(f.userId)} ya es amigo cercano`) }}>Aceptar</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {n.friendReq.length > 0 && (
        <section aria-labelledby="fr-h" className="flex flex-col gap-2">
          <h2 id="fr-h" className="text-meta font-bold">Solicitudes de amistad ({n.friendReq.length})</h2>
          {n.friendReq.map((f) => (
            <div key={f.userId} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar userId={f.userId} name={name(f.userId)} size={40} src={state.users[f.userId]?.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/u/${f.userId}`} className="text-[15px] font-bold">{name(f.userId)}</Link>
                  <span className="text-caption text-muted">quiere ser tu amigo</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" aria-label={`Rechazar la solicitud de ${name(f.userId)}`} onClick={() => setFriendStatus(f.userId, 'none')}>Rechazar</Button>
                <Button aria-label={`Aceptar la solicitud de ${name(f.userId)}`} onClick={() => { setFriendStatus(f.userId, 'friends'); toast(`${name(f.userId)} ya es tu amigo`) }}>Aceptar</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {n.replies.length > 0 && (
        <section aria-labelledby="rep-h" className="flex flex-col gap-2">
          <h2 id="rep-h" className="text-meta font-bold">Respuestas a tus invitaciones</h2>
          <ul className="flex flex-col gap-2">
            {n.replies.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <Avatar userId={i.toId} name={name(i.toId)} size={34} src={state.users[i.toId]?.avatarUrl} />
                <span className="text-sm font-semibold">{name(i.toId)} {i.status === 'accepted' ? 'aceptó' : 'no puede ir a'} {i.status === 'accepted' ? 'tu invitación a' : ''} «{i.title}»</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
