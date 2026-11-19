import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, EyeOff, Globe, LogOut, Radar, Star, UserCheck } from 'lucide-react'
import { ModalSheet, RowIcon, ToggleRow } from '@/design'
import { useActions, useApp } from '@/app/store'
import { closeFriendIds } from '@/lib/privacy'
import { DEFAULT_VISIBILITY_RADIUS, radiusLabel, VISIBILITY_RADIUS_OPTIONS } from '@/lib/reach'
import type { Availability } from '@/api/schemas'
import { cn } from '@/lib/cn'

export const AVAILABILITY_LABEL: Record<Availability, string> = { available: 'Disponible', busy: 'Ocupado' }

const rowLink = 'flex min-h-[60px] items-center gap-3 border-b border-surface-sunken last:border-b-0'

/**
 * Menú del perfil (hamburguesa): privacidad, social y ajustes de la app. Cada fila dice su estado actual para no tener
 * que entrar a ver. La disponibilidad es opcional y NO cambia quién ve tu ubicación.
 */
export function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp()
  const { toggleGhost, setVisibilityRadius, setAvailability, signOut } = useActions()
  const nav = useNavigate()
  const closeCount = closeFriendIds(state).length
  // Sin estado guardado = Disponible (por defecto).
  const availability: Availability = state.users.me?.availability ?? 'available'

  return (
    <>
      <ModalSheet open={open} title="Menú" onClose={onClose} variant="drawer">
        <div className="flex flex-col gap-6">
          <section aria-label="Privacidad" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Privacidad</h3>
            <ToggleRow
              icon={<EyeOff aria-hidden="true" size={20} strokeWidth={2} />} title="Modo fantasma" checked={state.ghost} onChange={toggleGhost}
              subtitle={state.ghost ? 'Encendido: nadie te ve, no ves a tus cercanos y no puedes unirte a nada.' : 'Apagado. Si lo enciendes te ocultas y solo puedes ver qué hay, sin unirte.'}
            />
            <Link to="/privacidad" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Star aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Amigos cercanos</span><span className="text-caption font-medium text-muted">{closeCount} {closeCount === 1 ? 'cercano' : 'cercanos'}</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
            <div role="group" aria-labelledby="vis-radius" className="flex flex-col gap-2 border-b border-surface-sunken py-3">
              <span className="flex items-center gap-3">
                <RowIcon icon={<Radar aria-hidden="true" size={20} strokeWidth={2} />} />
                <span className="flex flex-1 flex-col"><span id="vis-radius" className="text-sm font-bold">Radio de visibilidad</span><span className="text-caption font-medium text-muted">Qué tan lejos pueden estar tus cercanos para verte · por defecto {radiusLabel(DEFAULT_VISIBILITY_RADIUS)}</span></span>
              </span>
              <span role="radiogroup" aria-label="Radio de visibilidad" className="grid grid-cols-5 gap-2">
                {VISIBILITY_RADIUS_OPTIONS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={state.visibilityRadiusM === m} onClick={() => setVisibilityRadius(m)}
                    className={cn('h-12 rounded-[12px] border text-meta font-bold', state.visibilityRadiusM === m ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>
                    {radiusLabel(m)}
                  </button>
                ))}
              </span>
            </div>
          </section>

          <section aria-label="Social" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Social</h3>
            <Link to="/modo-abierto" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Globe aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Modo abierto <span className="text-caption font-semibold text-muted">· {state.openMode.enabled ? 'activo' : 'apagado'}</span></span><span className="text-caption font-medium text-muted">Eventos con gente nueva · tú decides</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
            <div role="group" aria-labelledby="avail" className="flex flex-col gap-2 py-3">
              <span className="flex items-center gap-3">
                <RowIcon icon={<UserCheck aria-hidden="true" size={20} strokeWidth={2} />} />
                <span className="flex flex-1 flex-col"><span id="avail" className="text-sm font-bold">Disponibilidad</span><span className="text-caption font-medium text-muted">Por defecto estás disponible. No cambia quién ve tu ubicación.</span></span>
              </span>
              <span role="radiogroup" aria-label="Disponibilidad" className="grid grid-cols-2 gap-2">
                {(['available', 'busy'] as Availability[]).map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={availability === a} onClick={() => setAvailability(a === 'available' ? null : a)}
                    className={cn('min-h-12 rounded-[12px] border px-2 text-sm font-bold', availability === a ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink')}>
                    {AVAILABILITY_LABEL[a]}{a === 'available' ? ' (por defecto)' : ''}
                  </button>
                ))}
              </span>
            </div>
          </section>

          <section aria-label="Aplicación" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Aplicación</h3>
            <Link to="/notificaciones" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Bell aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Notificaciones</span><span className="text-caption font-medium text-muted">Invitaciones, solicitudes y respuestas</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
            <Link to="/perfil/editar" onClick={onClose} className={rowLink}>
              <RowIcon icon={<UserCheck aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Cuenta</span><span className="text-caption font-medium text-muted">{state.session?.email} · nombre, usuario y contraseña</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
            <button type="button" onClick={() => { onClose(); signOut(); nav('/entrar') }} className="flex min-h-[56px] w-full items-center gap-3 text-left">
              <RowIcon icon={<LogOut aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="text-sm font-bold">Cerrar sesión</span>
            </button>
          </section>
        </div>
      </ModalSheet>
    </>
  )
}
