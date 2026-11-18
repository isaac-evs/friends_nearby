import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from './store'
import { TabBar } from './TabBar'
import { DesktopShell } from './DesktopShell'
import { useIsDesktop } from './hooks'

const TAB_ROUTES = ['/', '/mapa', '/publicar', '/amigos', '/perfil']

/** Guard: sin sesión → /entrar. */
export function RequireAuth() {
  const { state } = useApp()
  const loc = useLocation()
  if (!state.session) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

/** Guard: sin decisión de ubicación → /permiso (la zona manual también cuenta como decisión). */
export function RequireLocation() {
  const { state } = useApp()
  if (state.location.status === 'unknown') return <Navigate to="/permiso" replace />
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
  const showTabs = TAB_ROUTES.includes(pathname)
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Outlet />
      {showTabs && <TabBar />}
    </div>
  )
}
