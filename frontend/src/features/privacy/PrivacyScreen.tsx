import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Search, UserPlus } from 'lucide-react'
import { Avatar, Button, IconButton, Notice, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useNow } from '@/app/hooks'
import { activeShares, shareWith, locationViewers } from '@/lib/privacy'
import { timeLabel } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useLocationLine } from './CloseControls'
import { ExactSheet } from './ExactSheet'

/**
 * `/privacidad`: amigos cercanos. Es de DOS vías: invitas, la otra persona acepta y solo entonces se ven la ubicación aproximada.
 * La ubicación exacta es aparte: la comparte quien quiera, por un rato, con cada amigo cercano (ver ExactSheet).
 */
export function PrivacyScreen() {
  const { state } = useApp()
  const { requestClose, cancelClose, acceptClose, declineClose } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const tick = useNow(15_000)
  const now = Math.max(tick, Date.now())
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState<string | null>(null)

  const friends = Object.values(state.friendships)
    .filter((f) => f.status === 'friends' && !state.blocks.includes(f.userId))
    .map((f) => ({ f, u: state.users[f.userId]! }))
    .sort((a, b) => a.u.name.localeCompare(b.u.name))
  const term = q.trim().toLowerCase().replace(/^@/, '')
  const match = ({ u }: { u: { name: string; handle: string } }) => !term || u.name.toLowerCase().includes(term) || u.handle.toLowerCase().includes(term)
  const incoming = friends.filter(({ f }) => f.close === 'requested_in').filter(match)
  const close = friends.filter(({ f }) => f.close === 'mutual').filter(match)
  const invite = friends.filter(({ f }) => f.close === 'none' || f.close === 'requested_out').filter(match)
  const closeTotal = friends.filter(({ f }) => f.close === 'mutual').length

  const viewers = locationViewers(state).map((id) => state.users[id]!.name).sort((a, b) => a.localeCompare(b))
  const sharing = activeShares(state.exactShares, now).map((x) => state.users[x.userId]?.name.split(' ')[0]).filter(Boolean) as string[]
  let summary: string
  if (viewers.length === 0) summary = 'Nadie ve tu ubicación aproximada ahora. Invita a un amigo a ser cercano para compartirla.'
  else summary = `Tu ubicación aproximada la ven ${viewers.length} ${viewers.length === 1 ? 'persona' : 'personas'}: ${viewers.join(', ')}.`

  const nothing = incoming.length + close.length + invite.length === 0

  return (
    <div className="flex flex-col gap-4 px-[22px] pt-8 pb-10 lg:max-w-[640px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver al perfil" onClick={() => nav('/perfil')}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Amigos cercanos</h1>
      </header>

      <Notice tone="privacy" icon="eye">
        Amigo cercano es de dos vías: los dos tienen que aceptar. Se ven la ubicación aproximada. Tu ubicación exacta solo la ve quien tú elijas, por un rato.
      </Notice>

      <p role="status" className={cn('rounded-lg border px-3.5 py-3 text-sm font-bold', 'border-line bg-cat-musica text-ink')}>{summary}</p>
      {sharing.length > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-line bg-accent-soft px-3.5 py-3 text-sm font-bold text-accent-text">
          <MapPin aria-hidden="true" size={18} />Compartes tu ubicación exacta con {sharing.join(', ')}.
        </p>
      )}

      {incoming.length > 0 && (
        <section aria-labelledby="sol-h" className="flex flex-col gap-2">
          <h2 id="sol-h" className="text-meta font-bold">Solicitudes ({incoming.length})</h2>
          {incoming.map(({ u }) => (
            <div key={u.id} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar userId={u.id} name={u.name} size={40} src={u.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/u/${u.id}`} className="text-[15px] font-bold">{u.name}</Link>
                  <span className="text-caption text-muted">quiere ser tu amigo cercano</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" aria-label={`Ahora no: ${u.name}`} onClick={() => declineClose(u.id)}>Ahora no</Button>
                <Button aria-label={`Aceptar a ${u.name} como amigo cercano`} onClick={async () => { if (!await acceptClose(u.id)) return; toast(`${u.name} ya es amigo cercano`) }}>Aceptar</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <label className="relative block">
        <span className="sr-only">Buscar entre tus amigos</span>
        <Search aria-hidden="true" size={18} className="absolute top-[15px] left-3.5" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca entre tus amigos" className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-[42px] text-base" />
      </label>

      {friends.length === 0 && (
        <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-2.5 text-caption text-muted">
          Aún no tienes amigos para elegir. <Link to="/amigos" className="font-bold text-primary">Busca a alguien</Link>.
        </p>
      )}
      {friends.length > 0 && nothing && <p role="status" className="text-sm text-muted">No encontramos a nadie con “{q.trim()}” entre tus amigos.</p>}

      {(close.length > 0 || (!term && friends.length > 0)) && (
        <section aria-labelledby="cer-h" className="flex flex-col gap-2">
          <h2 id="cer-h" className="text-meta font-bold">Cercanos ({closeTotal})</h2>
          {close.length === 0 && <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-2.5 text-caption text-muted">Aún no tienes amigos cercanos. Invita a alguien de la lista de abajo.</p>}
          <ul aria-label="Amigos cercanos" className="flex flex-col gap-2">
            {close.map(({ u }) => <CloseRow key={u.id} id={u.id} name={u.name} src={u.avatarUrl} now={now} onExact={() => setSheet(u.id)} />)}
          </ul>
        </section>
      )}

      {invite.length > 0 && (
        <section aria-labelledby="inv-h" className="flex flex-col gap-2">
          <h2 id="inv-h" className="text-meta font-bold">Invitar a ser cercano ({invite.length})</h2>
          <ul aria-label="Invitar a ser cercano" className="flex flex-col gap-2">
            {invite.map(({ u, f }) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-2 pl-2.5">
                <Avatar userId={u.id} name={u.name} size={40} src={u.avatarUrl} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/u/${u.id}`} className="text-[15px] font-bold">{u.name} <span className="text-caption font-semibold text-muted">{u.handle}</span></Link>
                  <span className="text-caption text-muted">{f.close === 'requested_out' ? 'Esperando a que acepte…' : 'Solo amigos: no ve tu ubicación'}</span>
                </div>
                {f.close === 'requested_out'
                  ? <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-sm" aria-label={`Cancelar solicitud a ${u.name}`} onClick={() => cancelClose(u.id)}>Cancelar</Button>
                  : <Button className="h-11 rounded-[12px] px-3 text-sm" aria-label={`Invitar a ${u.name} a ser amigo cercano`} icon={<UserPlus aria-hidden="true" size={16} />} onClick={async () => { if (!await requestClose(u.id)) return; toast(`Invitación enviada a ${u.name}`) }}>Invitar</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ExactSheet userId={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function CloseRow({ id, name, src, now, onExact }: { id: string; name: string; src?: string; now: number; onExact: () => void }) {
  const { state } = useApp()
  const line = useLocationLine(id)
  const mine = shareWith(state.exactShares, id, now)
  const theirs = shareWith(state.exactGrants, id, now)
  const pending = state.exactPending.includes(id)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <Avatar userId={id} name={name} size={40} src={src} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link to={`/u/${id}`} className="text-[15px] font-bold">{name}</Link>
          <span className="text-caption text-muted">{line}</span>
        </div>
        <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-sm" aria-label={`Ubicación exacta con ${name}`} onClick={onExact}>Exacta</Button>
      </div>
      {(mine || theirs || pending) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption font-semibold text-text">
          {mine && <span>Compartes tu exacta hasta las {timeLabel(mine.until)}</span>}
          {theirs && <span>Te comparte su exacta hasta las {timeLabel(theirs.until)}</span>}
          {pending && !theirs && <span>Esperando su ubicación exacta…</span>}
        </p>
      )}
    </li>
  )
}
