import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Check, ChevronRight, Compass, Flame, Settings, Star, Sun, Users } from 'lucide-react'
import { Avatar, Button, ModalSheet, ProgressBar, ToggleRow } from '@/design'
import { useActions, useApp } from '@/app/store'
import { cn } from '@/lib/cn'

const BADGE_ICONS = { star: Star, sun: Sun, compass: Compass, users: Users, activity: Activity, flame: Flame }

/** Pantalla 8: Mi perfil. */
export function ProfileScreen() {
  const { state } = useApp()
  const { toggleGhost, toggleRanking, signOut, uploadPhoto } = useActions()
  const nav = useNavigate()
  const [settings, setSettings] = useState(false)
  const me = state.users.me!
  const jalesLeft = Math.ceil((state.xpGoal - state.xp) / 20)

  const ranking = Object.values(state.users)
    .filter((u) => (u.id === 'me' ? me.rankingOptIn : u.rankingOptIn && state.friendships[u.id]?.status === 'friends' && !state.blocks.includes(u.id)))

    .sort((a, b) => b.weeklyXp - a.weeklyXp)
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-3.5 px-[22px] pt-8 pb-[104px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:gap-y-5 lg:p-0">
      <div className="flex flex-col gap-3.5 lg:gap-5">
      <header className="flex items-center gap-3.5">
        <Avatar userId="me" name={me.name} size={58} self />
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold">{me.name}</h1><span className="text-caption text-muted">{me.handle}</span>
          <span className="self-start rounded-full border border-line bg-cat-comer px-[9px] py-px text-caption font-bold">Nivel {me.level} · {me.levelTitle ?? 'Social de barrio'}</span>
        </div>
        <button type="button" aria-label="Ajustes" onClick={() => setSettings(true)} className="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface"><Settings aria-hidden="true" size={20} /></button>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-caption font-bold"><span>{state.xp} / {state.xpGoal} XP</span><span className="text-muted">{jalesLeft} jales más para nivel {me.level + 1}</span></div>
        <ProgressBar value={(state.xp / state.xpGoal) * 100} label={`Progreso al nivel ${me.level + 1}`} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat tile="bg-accent" icon={<Flame aria-hidden="true" size={20} strokeWidth={2.2} />} value={`${me.streakWeeks} sem`} label="racha" shadow />
        <Stat tile="bg-cat-musica" icon={<Check aria-hidden="true" size={20} strokeWidth={2.2} />} value={String(me.hangouts)} label="jales confirmados" />
        <Stat tile="bg-cat-estudiar" icon={<Compass aria-hidden="true" size={20} strokeWidth={2.2} />} value={String(state.zonesCount)} label="zonas" />
      </div>

      <section aria-label="Insignias" className="flex flex-col gap-2">
        <h2 className="text-meta font-bold">Insignias</h2>
        <ul className="grid grid-cols-3 gap-2">
          {state.badges.map((b) => {
            const Icon = BADGE_ICONS[b.icon]
            return (
              <li key={b.id} className={cn('flex flex-col items-center gap-1 rounded-lg p-2 text-center', b.earned ? 'border border-line bg-surface' : 'border-[1.5px] border-dashed border-line-dashed')}>
                <span aria-hidden="true" className={cn('flex size-[38px] items-center justify-center rounded-full', b.earned ? `border border-line ${b.tile}` : 'bg-surface-sunken text-muted')}><Icon size={20} strokeWidth={2.2} /></span>
                <span className={cn('text-caption font-bold', !b.earned && 'text-muted')}>
                  {b.label}{b.progress ? ` ${b.progress.current}/${b.progress.goal}` : ''}
                  {b.earned && <span className="sr-only"> (obtenida)</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      </div>
      <div className="flex flex-col gap-3.5 lg:gap-5">
      <section aria-label="Ranking semanal" className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between"><h2 className="text-meta font-bold">Ranking de la semana</h2><span className="text-[11px] font-medium text-muted">solo amigos que lo activaron</span></div>
        {!me.rankingOptIn && <p className="rounded-md border border-dashed border-line-dashed bg-surface px-3 py-2.5 text-caption text-muted">Tú no apareces. Actívalo abajo para competir con tu banda.</p>}
        <ol className="flex flex-col gap-1.5">
          {ranking.map((u, i) => {
            const mine = u.id === 'me'
            return (
              <li key={u.id} className={cn('flex h-10 items-center gap-3 rounded-[12px] border border-line px-3', mine ? 'bg-primary text-white shadow-md' : 'bg-surface')}>
                <span aria-hidden="true" className={cn('flex size-[22px] items-center justify-center rounded-full border border-line text-[11px] font-bold', mine ? 'bg-white text-ink' : i === 0 ? 'bg-cat-comer' : 'bg-surface-sunken text-ink')}>{i + 1}</span>
                <span className="flex-1 text-sm font-bold">{mine ? 'Tú' : u.name}</span>
                <span className="text-meta font-bold">{u.weeklyXp} XP</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-label="Privacidad" className="flex flex-col rounded-lg border border-line bg-surface py-0.5 pr-2.5 pl-3.5">
        <ToggleRow title="Modo fantasma" subtitle={state.ghost ? 'Nadie te ve ahora.' : 'Desaparece de cards y mapa.'} checked={state.ghost} onChange={toggleGhost} />
        <ToggleRow title="Aparecer en el ranking" subtitle="Solo lo ven tus amigos que también lo activaron" checked={me.rankingOptIn} onChange={toggleRanking} />
        <Link to="/modo-abierto" className="flex min-h-[50px] items-center gap-3 border-t border-surface-sunken">
          <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Modo abierto <span className="text-caption font-semibold text-muted">· {state.openMode.enabled ? 'activo' : 'apagado'}</span></span><span className="text-caption font-medium text-muted">Eventos con gente nueva · tú decides</span></span>
          <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
        </Link>
      </section>

      </div>

      <ModalSheet open={settings} title="Ajustes" onClose={() => setSettings(false)}>
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-muted">Sesión: {state.session?.email}</p>
          <label className="flex min-h-11 items-center text-sm font-bold">Cambiar foto
            <input aria-label="Cambiar foto" type="file" accept="image/jpeg,image/png,image/webp" className="ml-3 min-w-0" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.target.value = '' }} />
          </label>
          <Button variant="secondary" full onClick={() => { signOut(); nav('/entrar') }}>Cerrar sesión</Button>
        </div>
      </ModalSheet>
    </div>
  )
}

function Stat({ tile, icon, value, label, shadow }: { tile: string; icon: React.ReactNode; value: string; label: string; shadow?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-lg border border-line px-3 py-2.5', tile, shadow && 'shadow-md')}>
      <span className="text-ink">{icon}</span>
      <span className="text-h2 font-extrabold">{value}</span>
      <span className="text-caption font-bold">{label}</span>
    </div>
  )
}
