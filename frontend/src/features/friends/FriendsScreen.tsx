import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Link2, QrCode, Search, X } from 'lucide-react'
import { Avatar, Button, ModalSheet, Pill, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { ME_ID } from '@/api/mock'
import { PLAN_CATEGORIES } from '@/lib/category'
import { formatAgo, formatApproxDistance } from '@/lib/format'

const MY_LINK = 'https://jalas.app/u/alan' // propuesta: dominio y ruta aún sin definir

/** Pantalla 7: Amigos — buscar por @usuario, link/QR, solicitudes y cercanos. */
export function FriendsScreen() {
  const { state } = useApp()
  const { setFriendStatus } = useActions()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [qr, setQr] = useState(false)

  const visible = (id: string) => !state.blocks.includes(id)
  const requests = Object.values(state.friendships).filter((f) => f.status === 'requested_in' && visible(f.userId))
  const nearby = state.plans.filter((p) => p.authorId !== ME_ID && state.friendships[p.authorId]?.status === 'friends' && !state.friendships[p.authorId]!.locationPaused && visible(p.authorId) && new Date(p.expiresAt).getTime() > Date.now())
  const paused = Object.values(state.friendships).filter((f) => f.status === 'friends' && f.locationPaused && visible(f.userId))

  const term = q.trim().toLowerCase().replace(/^@/, '')
  const results = term.length < 2 ? [] : Object.values(state.users).filter((u) => u.id !== ME_ID && visible(u.id) && (u.handle.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)))

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(MY_LINK); toast('Link copiado') } catch { toast('No pudimos copiar el link') }
  }

  return (
    <div className="flex flex-col gap-3.5 px-[22px] pt-9 pb-[104px] lg:p-0">
      <h1 className="text-[30px] font-extrabold tracking-[-0.8px] lg:text-h1">Tu banda</h1>
      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
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
      <section aria-label="Cerca ahora" className="flex flex-col">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-meta font-bold">Cerca ahora</h2>
          <Link to="/mapa" className="flex min-h-11 items-center text-meta font-bold text-primary">Ver en el mapa</Link>
        </div>
        {nearby.length === 0 && <p className="py-2 text-sm text-muted">Ningún amigo anda compartiendo plan ahora.</p>}
        {nearby.map((p) => {
          const u = state.users[p.authorId]!
          return (
            <div key={p.id} className="flex items-center gap-3 border-b border-surface-sunken py-[7px]">
              <Avatar userId={u.id} name={u.name} size={44} online />
              <Link to={`/u/${u.id}`} className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-bold">{u.name}</span>
                <span className="text-caption text-muted">{PLAN_CATEGORIES[p.category].label} · {formatAgo(p.zoneUpdatedAt)}</span>
              </Link>
              <Pill>{formatApproxDistance(p.zone.approxDistanceM)}</Pill>
            </div>
          )
        })}
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
