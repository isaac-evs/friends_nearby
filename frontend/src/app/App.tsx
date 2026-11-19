import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useApp } from '@/app/store'
import { AppShell, RequireAuth, RequireLocation } from './AppShell'
import { useIsDesktop } from './hooks'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { PermissionScreen } from '@/features/location/PermissionScreen'
import { ExploreScreen } from '@/features/explore/ExploreScreen'
import { DesktopExplore } from '@/features/explore/DesktopExplore'
import { MapScreen } from '@/features/map/MapScreen'
import { PublishScreen } from '@/features/publish/PublishScreen'
import { CreateEventScreen } from '@/features/publish/CreateEventScreen'
import { EventScreen } from '@/features/events/EventScreen'
import { FriendsScreen } from '@/features/friends/FriendsScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { LegalScreen } from '@/features/legal/LegalScreen'
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen'
import { NotificationPrefsScreen } from '@/features/notifications/NotificationPrefsScreen'
import { PlanScreen } from '@/features/plans/PlanScreen'
import { PlansScreen } from '@/features/plans/PlansScreen'
import { LevelScreen } from '@/features/profile/LevelScreen'
import { PrivacyScreen } from '@/features/privacy/PrivacyScreen'
import { EditProfileScreen } from '@/features/profile/EditProfileScreen'
import { OtherProfileScreen } from '@/features/profile/OtherProfileScreen'
import { SavedScreen } from '@/features/saved/SavedScreen'
import { OpenModeScreen } from '@/features/open-mode/OpenModeScreen'
import { DevUi } from '@/features/dev/DevUi'

/** "Ya nos vimos" ya no existe (G6): el encuentro vive en la vista del plan, con lobby y check-in. */
function MatchRedirect() {
  const { id } = useParams()
  const { state } = useApp()
  const m = state.matches.find((x) => x.id === id)
  return <Navigate to={m ? `/plan/${m.planId}` : '/planes'} replace />
}
function Home() { return useIsDesktop() ? <DesktopExplore /> : <ExploreScreen /> }
function MapRoute() { return useIsDesktop() ? <DesktopExplore /> : <MapScreen /> }

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<AuthScreen />} />
      <Route path="/dev/ui" element={<DevUi />} />
      <Route element={<RequireAuth />}>
        <Route path="/permiso" element={<PermissionScreen />} />
        <Route element={<RequireLocation />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="mapa" element={<MapRoute />} />
            <Route path="publicar" element={<PublishScreen />} />
            <Route path="publicar/evento" element={<CreateEventScreen />} />
            <Route path="amigos" element={<FriendsScreen />} />
            <Route path="planes" element={<PlansScreen />} />
            <Route path="notificaciones" element={<NotificationsScreen />} />
            <Route path="notificaciones/preferencias" element={<NotificationPrefsScreen />} />
            <Route path="perfil" element={<ProfileScreen />} />
            <Route path="perfil/editar" element={<EditProfileScreen />} />
            <Route path="perfil/nivel" element={<LevelScreen />} />
            <Route path="privacidad" element={<PrivacyScreen />} />
            <Route path="legal" element={<LegalScreen />} />
            <Route path="guardados" element={<SavedScreen />} />
            <Route path="modo-abierto" element={<OpenModeScreen />} />
            <Route path="plan/:id" element={<PlanScreen />} />
            <Route path="match/:id" element={<MatchRedirect />} />
            <Route path="evento/:id" element={<EventScreen />} />
            <Route path="u/:id" element={<OtherProfileScreen />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
