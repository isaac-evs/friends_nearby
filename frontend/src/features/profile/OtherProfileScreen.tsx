import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Activity, Hand, MoreHorizontal, Send, UserPlus } from 'lucide-react'
import { Avatar, AvatarStack, Button, ModalSheet, Notice, Pill, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { avatarColor } from '@/lib/avatar'
import { eventWhenShort } from '@/lib/format'
import { cn } from '@/lib/cn'

const REASONS = ['Spam o cuenta falsa', 'Acoso o mensajes ofensivos', 'Contenido inapropiado', 'Otro motivo']

/** Pantalla 11: Perfil de otra persona (en común, agregar amigo, saludar, bloquear / reportar). */
export function OtherProfileScreen() {
  const { id } = useParams()
  const { state } = useApp()
  const { setFriendStatus, wave, block, report, toggleRoomie, loadUser } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { let active = true; setLoaded(false); if (id) void loadUser(id).finally(() => { if (active) setLoaded(true) }); return () => { active = false } }, [id, loadUser])
  const u = id ? state.users[id] : undefined
  if (!u && !loaded) return <p role="status" className="p-6">Cargando perfil…</p>
  if (!u || u.id === 'me' || state.blocks.includes(u.id)) return <Navigate to="/amigos" replace />

  const fs = state.friendships[u.id]
  const status = fs?.status ?? 'none'
  const mutual = (fs?.mutualFriendIds ?? []).map((m) => state.users[m]).filter((x): x is NonNullable<typeof x> => !!x && !state.blocks.includes(x.id))
  const waved = state.waved.includes(u.id)
  const first = u.name.split(' ')[0]!

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg lg:min-h-0 lg:bg-transparent">
      <header className="relative h-[200px] border-b border-line px-[22px] pt-[34px] lg:rounded-card lg:border lg:px-8 lg:pt-8" style={{ background: avatarColor(u.id) }}>
        <div className="flex justify-between">
          <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></button>
          <button type="button" aria-label="Más opciones" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((v) => !v)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface"><MoreHorizontal aria-hidden="true" size={20} /></button>
        </div>
        {u.metAt && <span className="absolute right-[22px] bottom-[18px] rounded-[12px] border border-line bg-accent px-2.5 py-1 text-caption font-bold">Se conocieron en Social Run</span>}
        <Avatar userId={u.id} name={u.name} size={96} className="absolute bottom-[-46px] left-[22px] [&>span]:border-2 [&>span]:border-white [&>span]:shadow-md" />
      </header>

      {menu && (
        <div role="menu" className="absolute top-[84px] right-[22px] z-20 flex w-[200px] flex-col rounded-lg border border-line bg-surface p-1 shadow-md">
          <button type="button" role="menuitem" onClick={async () => { if (await block(u.id)) { toast(`Bloqueaste a ${first}`); nav('/amigos', { replace: true }) } }} className="h-11 rounded-[12px] px-3 text-left text-sm font-bold">Bloquear a {first}</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setReporting(true) }} className="h-11 rounded-[12px] px-3 text-left text-sm font-bold text-danger">Reportar perfil</button>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3.5 px-[22px] pt-[58px] pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-5 lg:px-2 lg:pt-16">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] leading-none font-extrabold tracking-[-0.8px]">{u.name}</h1>
          <span className="text-meta font-bold text-muted">{u.handle}{u.city ? ` · ${u.city}` : ''}</span>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="surface" className="bg-cat-comer">Nivel {u.level}</Pill>
            {u.pace && <Pill tone="surface" className="bg-cat-musica">{u.pace}</Pill>}
            {u.interests && <Pill>{u.interests}</Pill>}
          </div>
        </div>

        {(mutual.length > 0 || u.metAt) && (
          <section aria-label="En común" className="rounded-[18px] border border-line bg-surface px-3.5 py-1 shadow-md">
            {mutual.length > 0 && (
              <div className={cn('flex min-h-[54px] items-center gap-3', u.metAt && 'border-b border-surface-sunken')}>
                <AvatarStack people={mutual.slice(0, 3)} size={34} />
                <span className="flex flex-col">
                  <span className="text-sm font-bold">{mutual.length} {mutual.length === 1 ? 'amigo en común' : 'amigos en común'}</span>
                  <span className="text-caption font-medium text-muted">{mutual.map((m) => m.name).join(', ')}</span>
                </span>
              </div>
            )}
            {u.metAt && (
              <div className="flex min-h-[54px] items-center gap-3">
                <span className="flex size-[34px] flex-none items-center justify-center rounded-sm border border-line bg-accent"><Activity aria-hidden="true" size={20} strokeWidth={2.2} /></span>
                <span className="flex flex-col"><span className="text-sm font-bold">{u.metAt.eventTitle}</span><span className="text-caption font-medium text-muted">Fueron juntos · {eventWhenShort(u.metAt.whenIso).split(' · ')[0]!.toLowerCase()}</span></span>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Mini tile="bg-accent" value={`${u.streakWeeks} sem`} label="racha" />
          <Mini value={String(u.hangouts)} label="jales" />
          <Mini value={String(u.eventsCount)} label="eventos" />
        </div>

        <Notice tone="safety" icon="shield">Agregarse no comparte ubicaciones. Cada quien decide después si muestra su zona.</Notice>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface px-[22px] pt-3.5 pb-[22px] lg:rounded-xl lg:border lg:px-6 lg:pt-4 lg:pb-4 lg:shadow-lg">
        {status === 'none' && (
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <Button variant="secondary" size="lg" className={cn('text-[15px] font-bold', waved && 'bg-cat-comer')} onClick={async () => { if (await wave(u.id)) toast(`Saludaste a ${first}`) }} icon={<Hand aria-hidden="true" size={18} />}>{waved ? '¡Saludado!' : 'Saludar'}</Button>
            <Button size="lg" className="text-[15px] font-bold" onClick={() => setFriendStatus(u.id, 'requested_out')} icon={<UserPlus aria-hidden="true" size={18} />}>Agregar amigo</Button>
          </div>
        )}
        {status === 'requested_out' && (
          <div role="status" className="flex min-h-[54px] items-center gap-3">
            <span className="flex size-12 flex-none items-center justify-center rounded-full border border-line bg-cat-comer"><Send aria-hidden="true" size={22} /></span>
            <span className="flex flex-1 flex-col"><span className="text-lg font-extrabold">Solicitud enviada</span><span className="text-caption font-medium text-muted">{first} decide si te acepta</span></span>
            <Button variant="secondary" className="h-11 rounded-[12px] px-3 text-meta" onClick={() => setFriendStatus(u.id, 'none')}>Cancelar</Button>
          </div>
        )}
        {status === 'requested_in' && (
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <Button variant="secondary" size="lg" className="text-[15px] font-bold" onClick={async () => { if (await setFriendStatus(u.id, 'none')) nav('/amigos') }}>Rechazar</Button>
            <Button size="lg" className="text-[15px] font-bold" onClick={async () => { if (await setFriendStatus(u.id, 'friends')) toast(`${first} ya es tu amigo`) }}>Aceptar solicitud</Button>
          </div>
        )}
        {status === 'friends' && (
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <Pill tone="muted" className="h-[54px] justify-center rounded-lg text-sm">Ya son amigos</Pill>
            <Button size="lg" className="text-[15px] font-bold" onClick={async () => { if (await wave(u.id)) toast(`Saludaste a ${first}`) }} icon={<Hand aria-hidden="true" size={18} />}>{waved ? '¡Saludado!' : 'Saludar'}</Button>
          </div>
        )}
      </div>

      <ModalSheet open={reporting} title={`Reportar a ${first}`} onClose={() => setReporting(false)}>
        <ul className="flex flex-col">
          {REASONS.map((r) => (
            <li key={r}>
              <button type="button" className="flex min-h-12 w-full items-center border-b border-surface-sunken text-left text-[15px] font-bold" onClick={async () => { if (await report(u.id, r)) { setReporting(false); toast('Gracias, recibimos tu reporte') } }}>{r}</button>
            </li>
          ))}
        </ul>
      </ModalSheet>
      {status === 'friends' && <Button variant="secondary" className="mx-5 mb-5" onClick={() => toggleRoomie(u.id)}>{state.roomies.includes(u.id) ? 'Quitar de roomies' : 'Marcar como roomie'}</Button>}
    </div>
  )
}

function Mini({ tile, value, label }: { tile?: string; value: string; label: string }) {
  return (
    <div className={cn('flex flex-col rounded-md border border-line px-2.5 py-2', tile ?? 'bg-surface')}>
      <span className="text-xl font-extrabold">{value}</span>
      <span className="text-[11px] font-bold">{label}</span>
    </div>
  )
}
