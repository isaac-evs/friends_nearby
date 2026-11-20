import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from './store'
import { TabBar } from './TabBar'
import { DesktopShell } from './DesktopShell'
import { UpcomingBanner } from '@/features/plans/UpcomingBanner'
import { useIsDesktop } from './hooks'
import { cn } from '@/lib/cn'

const TAB_ROUTES = ['/', '/mapa', '/publicar', '/publicar/evento', '/amigos', '/perfil']

/** Guard: sin sesión → /entrar. */
export function RequireAuth() {
  const { state } = useApp()
  const loc = useLocation()
  if (!state.session) return <Navigate to="/entrar" replace state={{ from: loc.pathname + loc.search }} />
  return <Outlet />
}

/** Guard: sin decisión de ubicación → /permiso (elegir tu ubicación a mano también cuenta como decisión). */
export function RequireLocation() {
  const { state } = useApp()
  const loc = useLocation()
  if (state.location.status === 'unknown') return <Navigate to="/permiso" replace state={{ from: loc.pathname + loc.search }} />
  return <Outlet />
}

/**
 * Móvil: contenido + TabBar flotante. Desktop (≥ 1024 px): DesktopShell con sidebar.
 * `/` y `/mapa` usan el layout ancho de Desktop.dc.html.
 */
export function AppShell() {
  const desktop = useIsDesktop()
  const { pathname } = useLocation()
  const wide = pathname === '/' || pathname === '/mapa'
  if (desktop) {
    return (
      <DesktopShell wide={wide}>
        <Outlet />
      </DesktopShell>
    )
  }
  const showTabs = TAB_ROUTES.includes(pathname) || pathname.startsWith('/plan/')
  return (
    // Entre celular y desktop todo es como en móvil (columna de 480 px), salvo el mapa, que se extiende a todo el ancho.
    <div className={cn('mx-auto flex min-h-dvh w-full flex-col', pathname !== '/mapa' && 'max-w-[480px]')}>
      <UpcomingBanner className="mx-3 mt-3" />
      <Outlet />
      {showTabs && <TabBar />}
    </div>
  )
}
