import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Compass, Flame, Menu, Pencil, Star, Sun, Users } from 'lucide-react'
import { Avatar, IconLink } from '@/design'
import { useApp } from '@/app/store'
import { cn } from '@/lib/cn'
import { ProfileMenu } from './ProfileMenu'
import { LevelCard, ProfileStats } from './ProfileParts'

const BADGE_ICONS = { star: Star, sun: Sun, compass: Compass, users: Users, activity: Activity, flame: Flame }

/** Pantalla 8: Mi perfil. */
export function ProfileScreen() {
  const { state } = useApp()
  const [menu, setMenu] = useState(false)
  const me = state.users.me!
  const friends = Object.values(state.friendships).filter((f) => f.status === 'friends' && !state.blocks.includes(f.userId)).length
  const plans = state.history.filter((h) => h.kind === 'plan').length
  const events = state.history.filter((h) => h.kind === 'evento').length

  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 px-[22px] pt-8 pb-[104px] lg:mx-auto lg:grid lg:w-full lg:max-w-[1040px] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-x-12 lg:gap-y-6 lg:p-0',
      )}
    >
      {/* Portada grande; la foto de perfil se monta sobre su borde inferior. */}
      <div className="relative lg:col-span-2">
        <div data-testid="profile-cover" aria-hidden="true" className="h-36 overflow-hidden rounded-xl border border-line bg-primary-soft lg:h-60 lg:rounded-2xl">
          {me.coverUrl && <img src={me.coverUrl} alt="" className="size-full object-cover" />}
        </div>
        <div className="absolute top-3 right-3 flex gap-2 lg:top-5 lg:right-5">
          <IconLink label="Editar perfil" to="/perfil/editar"><Pencil aria-hidden="true" size={18} /></IconLink>
          <button type="button" aria-label="Menú" aria-haspopup="dialog" onClick={() => setMenu(true)} className="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface shadow-sm"><Menu aria-hidden="true" size={20} /></button>
        </div>
        <div data-testid="profile-avatar" className="absolute -bottom-12 left-4 lg:-bottom-14 lg:left-8">
          <Avatar userId="me" name={me.name} size={96} self src={me.avatarUrl} className="[&>span]:border-4 [&>span]:border-bg [&>span]:shadow-md lg:[&>span]:size-28 lg:[&>span]:text-[36px] lg:[&>span]:border-[5px]" />
        </div>
      </div>

      {/* Nombre, usuario, descripción, amigos y planes, e insignias. */}
      <header className="flex flex-col gap-2 pt-12 pl-4 lg:gap-2.5 lg:pt-[60px] lg:pl-8">
        <h1 className="text-[26px] leading-none font-extrabold tracking-[-0.6px] lg:text-[34px] lg:tracking-[-0.9px]">{me.name}</h1>
        <span className="text-[15px] font-semibold text-muted lg:text-base">{me.handle}</span>
        {me.bio
          ? <p className="max-w-[48ch] text-sm leading-relaxed text-text lg:text-[15px]">{me.bio}</p>
          : <Link to="/perfil/editar" className="flex min-h-11 items-center self-start text-sm font-bold text-primary">Agrega una descripción</Link>}
      </header>

      {/* Primero tus números y tu nivel; las insignias van debajo. */}
      <div className="flex flex-col gap-3.5 lg:gap-6 lg:pt-14">
        <ProfileStats friends={friends} plans={plans} events={events} />
        <LevelCard level={me.level} to="/perfil/nivel" />
        <section aria-label="Insignias" className="flex flex-col gap-2">
          <h2 className="text-meta font-bold lg:text-[15px]">Insignias</h2>
          <ul className="grid grid-cols-3 gap-2">
            {state.badges.map((b) => {
              const Icon = BADGE_ICONS[b.icon]
              return (
                <li key={b.id} className={cn('flex flex-col items-center gap-1 rounded-lg p-2 text-center lg:p-3', b.earned ? 'border border-line bg-surface' : 'border-[1.5px] border-dashed border-line-dashed')}>
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

      <ProfileMenu open={menu} onClose={() => setMenu(false)} />
    </div>
  )
}
