import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Link2, QrCode, Search, X } from 'lucide-react'
import { Avatar, Button, ModalSheet, Pill, SegmentedControl, Tabs, panelId, tabId, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { ME_ID } from '@/api/me'
import { PLAN_CATEGORIES } from '@/lib/category'
import { formatAgo, formatNearby } from '@/lib/format'
import { planPhase } from '@/lib/planTime'
import { InviteButton } from '@/features/map/InviteButton'
import { JoinButton, JoinReason } from '@/features/map/JoinButton'
import { cn } from '@/lib/cn'
import { useRanking, type RankRow, type RankScope } from './useRanking'
import { useMapItems } from '@/features/map/useMapData'
import { RangeControl } from '@/features/range/RangeControl'
import { startLabel } from '@/lib/planTime'

/** [propuesta] dominio y ruta aún sin definir. */
const linkFor = (handle: string) => `https://jalas.app/u/${handle.replace('@', '')}`

type Tab = 'amigos' | 'ranking'

/** Pantalla 7: Amigos — dos pestañas: Amigos (buscar, link/QR, solicitudes, cercanos) y Ranking de la semana. */
export function FriendsScreen() {
  const { state } = useApp()
  const { setFriendStatus, acceptClose, declineClose } = useActions()
  // El ranking global solo existe si activaste el modo abierto; si no, solo el de amigos.
  const globalOn = state.openMode.enabled
  const [picked, setScope] = useState<RankScope>('global')
  const scope: RankScope = globalOn ? picked : 'amigos'
  const rows = useRanking(scope)
  // Global: el top 10 y, si estás fuera, tu lugar abajo. Amigos: todos.
  const TOP = 10
  const shown = scope === 'global' ? rows.slice(0, TOP) : rows
  const outside = scope === 'global' ? rows.find((r) => r.mine && r.rank > TOP) : undefined
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'ranking' ? 'ranking' : 'amigos'
  const setTab = (t: Tab) => setParams(t === 'ranking' ? { tab: 'ranking' } : {}, { replace: true })
  const toast = useToast()
  const MY_LINK = linkFor(state.users[ME_ID]!.handle)
  const [q, setQ] = useState('')
  const [qr, setQr] = useState(false)

  const visible = (id: string) => !state.blocks.includes(id)
  const requests = Object.values(state.friendships).filter((f) => f.status === 'requested_in' && visible(f.userId))
  // "Ahora": lo que pasa en este momento entre tus amigos (misma regla de privacidad del mapa; sin día elegido).
  const mapItems = useMapItems('todos', '', { ignoreDay: true })
  const idle = mapItems.flatMap((it) => (it.kind === 'person' && !it.plan && it.availability === 'available' ? [it] : [])).sort((a, b) => a.distanceM - b.distanceM)
  const liveNow = mapItems.flatMap((it) => (it.kind === 'plan' && planPhase(it.plan) === 'live' ? [it] : [])).sort((a, b) => a.distanceM - b.distanceM)
  const doing = mapItems.flatMap((it) => (it.kind === 'person' && it.plan ? [it] : [])).sort((a, b) => a.distanceM - b.distanceM)
  const closeReq = Object.values(state.friendships).filter((f) => f.status === 'friends' && f.close === 'requested_in' && visible(f.userId))
  const paused = Object.values(state.friendships).filter((f) => f.status === 'friends' && f.locationPaused && visible(f.userId))

  const term = q.trim().toLowerCase().replace(/^@/, '')
  const results = term.length < 2 ? [] : Object.values(state.users).filter((u) => u.id !== ME_ID && visible(u.id) && (u.handle.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)))

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(MY_LINK); toast('Link copiado') } catch { toast('No pudimos copiar el link') }
  }

  return (
    <div className="flex flex-col gap-3.5 px-[22px] pt-9 pb-[104px] lg:p-0">
      <h1 className="text-[30px] font-extrabold tracking-[-0.8px] lg:text-h1">Tu banda</h1>
      <Tabs<Tab> base="banda" label="Tu banda" value={tab} onChange={setTab} tabs={[{ value: 'amigos', label: 'Amigos' }, { value: 'ranking', label: 'Ranking' }]} />

      {tab === 'ranking' && (
        <div role="tabpanel" id={panelId('banda', 'ranking')} aria-labelledby={tabId('banda', 'ranking')} className="flex flex-col gap-3.5 lg:max-w-[640px]">
          {globalOn ? (
            <SegmentedControl<RankScope>
              label="Alcance del ranking" value={scope} onChange={setScope}
              options={[{ value: 'global', label: 'Global' }, { value: 'amigos', label: 'Amigos' }]}
            />
          ) : (
            <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-2.5 text-caption text-muted">
              El ranking global aparece cuando activas el modo abierto desde <Link to="/perfil" className="font-bold text-primary">tu perfil</Link>. Mientras tanto ves el de tus amigos.
            </p>
          )}
          <section aria-label="Ranking semanal" className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between"><h2 className="text-meta font-bold">Ranking de siempre</h2><span className="text-[11px] font-medium text-muted">{scope === 'global' ? 'XP total · toda la gente' : 'XP total · tus amigos'}</span></div>
            {rows.length === 0 && <p className="py-1 text-sm text-muted">Aún no hay nadie en el ranking.</p>}
            <ol className="flex flex-col gap-1.5">
              {shown.map((u) => <RankItem key={u.id} u={u} />)}
              {outside && (
                <>
                  <li aria-hidden="true" className="text-center text-muted">···</li>
                  <RankItem u={outside} />
                </>
              )}
            </ol>
            {scope === 'global' && <p className="text-caption text-muted">En el global participa quien tiene el modo abierto activo: se ve el nombre, el nivel y el XP, nunca la ubicación. Toca a alguien para ver su perfil.</p>}
          </section>
        </div>
      )}

      {tab === 'amigos' && (
      <div role="tabpanel" id={panelId('banda', 'amigos')} aria-labelledby={tabId('banda', 'amigos')} className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-3.5">

      <label className="relative block">
        <span className="sr-only">Buscar por usuario</span>
        <Search aria-hidden="true" size={18} className="absolute top-[15px] left-3.5" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por @usuario" className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-[42px] text-base" />
      </label>

      {term.length >= 2 && (
        <section aria-label="Resultados de búsqueda" className="flex flex-col gap-2">
          {results.length === 0 && <p role="status" className="text-sm text-muted">No encontramos a nadie con “{q.trim()}”.</p>}
          {results.map((u) => {
            const st = state.friendships[u.id]?.status ?? 'none'
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-2 pl-2.5">
                <Avatar userId={u.id} name={u.name} size={40} />
                <Link to={`/u/${u.id}`} className="flex min-w-0 flex-1 flex-col"><span className="text-[15px] font-bold">{u.name}</span><span className="text-caption text-muted">{u.handle}</span></Link>
                {st === 'friends' && <Pill tone="muted">Amigos</Pill>}
                {st === 'requested_out' && <Pill tone="muted">Solicitud enviada</Pill>}
                {st === 'requested_in' && <Button className="h-11 rounded-[12px] px-3.5 text-sm" onClick={() => setFriendStatus(u.id, 'friends')}>Aceptar</Button>}
                {st === 'none' && <Button className="h-11 rounded-[12px] px-3.5 text-sm" onClick={() => { setFriendStatus(u.id, 'requested_out'); toast(`Solicitud enviada a ${u.name}`) }}>Agregar</Button>}
              </div>
            )
          })}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={copyLink} className="flex h-[46px] items-center justify-center gap-2 rounded-md border border-line bg-cat-comer text-sm font-bold text-ink shadow-md"><Link2 aria-hidden="true" size={18} strokeWidth={2.2} />Mi link</button>
        <button type="button" onClick={() => setQr(true)} className="flex h-[46px] items-center justify-center gap-2 rounded-md border border-line bg-cat-musica text-sm font-bold text-ink shadow-md"><QrCode aria-hidden="true" size={18} strokeWidth={2.2} />Mi QR</button>
      </div>

      {closeReq.length > 0 && (
        <section aria-label="Solicitudes de amigo cercano" className="flex flex-col gap-2">
          <h2 className="text-meta font-bold">Amigo cercano ({closeReq.length})</h2>
          {closeReq.map((r) => {
            const u = state.users[r.userId]!
            return (
              <div key={u.id} className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center gap-3">
                  <Avatar userId={u.id} name={u.name} size={40} src={u.avatarUrl} />
                  <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <Link to={`/u/${u.id}`} className="text-[15px] font-bold">{u.name}</Link>
                    <span className="text-caption text-muted">quiere ser tu amigo cercano · se verían la ubicación aproximada</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" aria-label={`Ahora no: ${u.name} (amigo cercano)`} onClick={() => declineClose(u.id)}>Ahora no</Button>
                  <Button aria-label={`Aceptar a ${u.name} como amigo cercano`} onClick={() => { acceptClose(u.id); toast(`${u.name} ya es amigo cercano`) }}>Aceptar</Button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {requests.length > 0 && (
        <section aria-label="Solicitudes" className="flex flex-col gap-2">
          <h2 className="text-meta font-bold">Solicitudes ({requests.length})</h2>
          {requests.map((r) => {
            const u = state.users[r.userId]!
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface py-[7px] pr-[7px] pl-2.5">
                <Avatar userId={u.id} name={u.name} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <Link to={`/u/${u.id}`} className="text-[15px] font-bold">{u.name}</Link>
                  <span className="text-caption text-muted">{u.handle} · {r.mutualFriendIds.length} {r.mutualFriendIds.length === 1 ? 'amigo' : 'amigos'} en común</span>
                </div>
                <button type="button" aria-label={`Rechazar a ${u.name}`} onClick={() => setFriendStatus(u.id, 'none')} className="flex size-11 flex-none items-center justify-center rounded-[12px] border border-line bg-surface"><X aria-hidden="true" size={18} strokeWidth={2.4} /></button>
                <button type="button" aria-label={`Aceptar a ${u.name}`} onClick={() => { setFriendStatus(u.id, 'friends'); toast(`${u.name} ya es tu amigo`) }} className="flex h-11 flex-none items-center gap-1 rounded-[12px] bg-primary px-3.5 text-sm font-bold text-white"><Check aria-hidden="true" size={16} strokeWidth={2.6} />Aceptar</button>
              </div>
            )
          })}
        </section>
      )}

      </div>
      <div className="flex flex-col gap-3.5 lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-5 lg:shadow-sm">
      <section aria-label="Ahora" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-extrabold">Ahora</h2>
          <Link to="/mapa" className="flex min-h-11 items-center text-meta font-bold text-primary">Ver en el mapa</Link>
        </div>
        <RangeControl className="self-start" />
        {state.ghost && <p role="status" className="rounded-md bg-ink px-3 py-2.5 text-sm font-bold text-white">Modo fantasma: no ves dónde andan tus cercanos ni te puedes unir. Apágalo desde tu perfil.</p>}

        <div aria-label="Disponibles cerca" role="group" className="flex flex-col">
          <h3 className="mb-1 text-meta font-bold">Disponibles cerca</h3>
          {idle.length === 0 && <p className="py-1.5 text-sm text-muted">Nadie disponible cerca dentro de tu rango. Puedes ampliarlo.</p>}
          {idle.map((n) => (
            <div key={n.id} className="flex items-center gap-3 border-b border-surface-sunken py-[7px]">
              <Avatar userId={n.user.id} name={n.user.name} size={44} online src={n.user.avatarUrl} />
              <Link to={`/u/${n.user.id}`} className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-bold">{n.user.name}</span>
                <span className="text-caption text-muted">Sin plan · {formatNearby(n.distanceM)} · {formatAgo(n.updatedAt)}</span>
              </Link>
              <InviteButton userId={n.user.id} name={n.user.name} className="h-11 rounded-md px-3.5 text-sm" />
            </div>
          ))}
        </div>

        <div aria-label="Planes en curso" role="group" className="flex flex-col">
          <h3 className="mb-1 text-meta font-bold">Planes en curso</h3>
          {liveNow.length === 0 && <p className="py-1.5 text-sm text-muted">Ningún amigo tiene un plan en curso dentro de tu rango.</p>}
          {liveNow.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5 border-b border-surface-sunken py-[9px]">
              <div className="flex items-center gap-3">
                <Avatar userId={p.user.id} name={p.user.name} size={44} src={p.user.avatarUrl} />
                <Link to={`/mapa?sel=${p.id}`} className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-[15px] font-bold">{p.plan.line}</span>
                  <span className="text-caption text-muted">{p.user.name} · {PLAN_CATEGORIES[p.plan.category].label} · {p.place.name} · {formatNearby(p.distanceM)}</span>
                </Link>
                {!p.joined && <JoinButton plan={p.plan} className="h-11 rounded-md px-3.5 text-sm" />}
              </div>
              <JoinReason plan={p.plan} joined={p.joined} />
            </div>
          ))}
        </div>

        <div aria-label="Qué hacen tus cercanos" role="group" className="flex flex-col">
          <h3 className="mb-1 text-meta font-bold">Qué hacen tus cercanos</h3>
          {doing.length === 0 && <p className="py-1.5 text-sm text-muted">Ninguno de tus amigos cercanos tiene plan por ahora.</p>}
          {doing.map((n) => (
            <div key={n.id} className="flex items-center gap-3 border-b border-surface-sunken py-[7px]">
              <Avatar userId={n.user.id} name={n.user.name} size={44} src={n.user.avatarUrl} />
              <Link to={`/u/${n.user.id}`} className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-bold">{n.user.name} · {PLAN_CATEGORIES[n.plan!.category].label}</span>
                <span className="text-caption text-muted">{n.plan!.line} · {startLabel(n.plan!.startsAt)}</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {paused.length > 0 && (
        <section aria-label="En pausa" className="flex flex-col">
          <h2 className="mb-1 text-meta font-bold">En pausa</h2>
          {paused.map((f) => {
            const u = state.users[f.userId]!
            return (
              <div key={u.id} className="flex items-center gap-3 py-[7px]">
                <Avatar userId={u.id} name={u.name} size={44} paused />
                <span className="flex flex-1 flex-col gap-px"><span className="text-[15px] font-bold">{u.name}</span><span className="text-caption text-muted">Ubicación en pausa</span></span>
              </div>
            )
          })}
        </section>
      )}

      </div>
      </div>
      )}

      <ModalSheet open={qr} title="Mi QR" onClose={() => setQr(false)}>
        <div className="flex flex-col items-center gap-3 py-2">
          <div aria-hidden="true" className="grid size-48 grid-cols-9 gap-px rounded-md border border-line bg-white p-3">
            {Array.from({ length: 81 }, (_, i) => <span key={i} className={((i * 7 + (i % 9) * 3) % 5 < 2) ? 'bg-ink' : 'bg-transparent'} />)}
          </div>
          <p className="text-center text-caption text-muted">Vista previa (mock): el QR real se genera con el link <strong className="text-ink">{MY_LINK}</strong> cuando haya backend.</p>
        </div>
      </ModalSheet>
    </div>
  )
}

function RankItem({ u }: { u: RankRow }) {
  return (
    <li aria-current={u.mine ? 'true' : undefined}>
      <Link to={u.mine ? '/perfil' : `/u/${u.id}`} className={cn('flex h-12 items-center gap-3 rounded-[12px] border border-line px-3', u.mine ? 'bg-primary text-white shadow-md' : 'bg-surface')}>
        <span aria-hidden="true" className={cn('flex size-6 items-center justify-center rounded-full border border-line text-[11px] font-bold', u.mine ? 'bg-white text-ink' : u.rank === 1 ? 'bg-cat-comer text-ink' : 'bg-surface-sunken text-ink')}>{u.rank}</span>
        <Avatar userId={u.id} name={u.name} size={34} self={u.mine} src={u.avatarUrl} />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-bold">{u.mine ? 'Tú' : u.name}<span className="sr-only"> (lugar {u.rank})</span></span>
          <span className={cn('text-[11px] font-medium', u.mine ? 'text-white' : 'text-muted')}>Nivel {u.level}</span>
        </span>
        <span className="text-meta font-bold">{u.totalXp.toLocaleString('es-MX')} XP</span>
      </Link>
    </li>
  )
}
