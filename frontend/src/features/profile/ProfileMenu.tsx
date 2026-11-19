import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Globe, LogOut, ScrollText, Star, UserCheck } from 'lucide-react'
import { ModalSheet, RowIcon } from '@/design'
import { useActions, useApp } from '@/app/store'
import { closeFriendIds } from '@/lib/privacy'

const rowLink = 'flex min-h-[60px] items-center gap-3 border-b border-surface-sunken last:border-b-0'

/**
 * Menú del perfil (hamburguesa): privacidad, social y ajustes de la app. Cada fila dice su estado actual para no tener
 * que entrar a ver.
 */
export function ProfileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp()
  const { signOut } = useActions()
  const nav = useNavigate()
  const closeCount = closeFriendIds(state).length

  return (
    <>
      <ModalSheet open={open} title="Menú" onClose={onClose} variant="drawer">
        <div className="flex flex-col gap-6">
          <section aria-label="Privacidad" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Privacidad</h3>
            <Link to="/privacidad" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Star aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Amigos cercanos</span><span className="text-caption font-medium text-muted">{closeCount} {closeCount === 1 ? 'cercano' : 'cercanos'}</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
          </section>

          <section aria-label="Social" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Social</h3>
            <Link to="/modo-abierto" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Globe aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Modo abierto <span className="text-caption font-semibold text-muted">· {state.openMode.enabled ? 'activo' : 'apagado'}</span></span><span className="text-caption font-medium text-muted">Eventos con gente nueva · tú decides</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
          </section>

          <section aria-label="Aplicación" className="flex flex-col">
            <h3 className="mb-2 text-caption font-bold tracking-[0.8px] text-muted uppercase">Aplicación</h3>
            <Link to="/notificaciones/preferencias" onClick={onClose} className={rowLink}>
              <RowIcon icon={<Bell aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Notificaciones</span><span className="text-caption font-medium text-muted">Qué te avisa y cuándo · invitaciones, planes, cerca de ti</span></span>
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.2} className="mr-2 text-muted" />
            </Link>
            <Link to="/legal" onClick={onClose} className={rowLink}>
              <RowIcon icon={<ScrollText aria-hidden="true" size={20} strokeWidth={2} />} />
              <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Privacidad y legal</span><span className="text-caption font-medium text-muted">Aviso de privacidad, tu ubicación, tus derechos y términos</span></span>
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
