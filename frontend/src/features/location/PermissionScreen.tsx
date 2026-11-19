import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EyeOff, MapPin, Eye } from 'lucide-react'
import { Button, Chip, Notice } from '@/design'
import { useActions, useApp } from '@/app/store'
import { ZONES, zoneCenter } from '@/api/constants'
import { roundToZone, type LatLng } from '@/lib/geo'

/** Pantalla 2: pre-permiso, zona manual y manejo de `denied`. */
export function PermissionScreen() {
  const { state } = useApp()
  const { setLocation } = useActions()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'
  const [phase, setPhase] = useState<'ask' | 'asking' | 'denied' | 'manual'>('ask')
  const [zone, setZone] = useState<string>(state.location.zoneName)

  const finish = async (status: 'granted' | 'manual', zoneName: string, center?: LatLng) => {
    if (await setLocation(status, zoneName, center ?? zoneCenter(zoneName))) nav(from, { replace: true })
  }

  const ask = () => {
    if (!('geolocation' in navigator)) { setPhase('denied'); return }
    setPhase('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Privacidad: redondeamos de inmediato a zona y descartamos el punto exacto. Nunca se registra.
        const center = roundToZone({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        void finish('granted', 'Mi zona', center)
      },
      () => setPhase('denied'),
      { maximumAge: 60_000, timeout: 10_000 },
    )
  }

  if (phase === 'manual' || phase === 'denied') {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.8px] lg:text-[44px]">
            {phase === 'denied' ? 'Sin ubicación, tú eliges tu zona' : 'Elige tu zona'}
          </h1>
          <p className="text-[15px] leading-snug text-text">
            Verás planes y eventos cerca de esa zona. Puedes activar la ubicación cuando quieras desde los ajustes de tu navegador.
          </p>
        </div>
        {phase === 'denied' && (
          <Notice tone="warning" icon="lock" role="alert">No pudimos acceder a tu ubicación (permiso denegado o no disponible). No pasa nada.</Notice>
        )}
        </div>
        <div className="flex flex-1 flex-col gap-6 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-card">
        <div role="group" aria-label="Zonas disponibles" className="flex flex-wrap gap-2">
          {ZONES.map((z) => (
            <Chip key={z} selected={zone === z} onClick={() => setZone(z)} className="h-11">{z}</Chip>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2.5">
          <Button size="lg" full onClick={() => finish('manual', zone)}>Usar {zone}</Button>
          {phase === 'denied' && <Button variant="ghost" full onClick={ask}>Intentar de nuevo</Button>}
        </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="relative flex h-[210px] items-center justify-center lg:h-[260px]">
        <div className="flex size-[200px] items-center justify-center rounded-full border border-line bg-surface shadow-md">
          <div className="flex size-[130px] flex-col items-center justify-center gap-1 rounded-full border-[2.5px] border-dashed border-primary bg-primary-soft">
            <MapPin size={34} />
            <span className="text-caption font-bold">~1 km</span>
          </div>
        </div>
        <span className="absolute top-[26px] left-[52px] flex size-11 items-center justify-center rounded-full border border-line bg-cat-comer text-meta font-bold">SO</span>
        <span className="absolute right-[50px] bottom-5 flex size-11 items-center justify-center rounded-full border border-line bg-cat-musica text-meta font-bold">DA</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.8px] lg:text-[44px]">Tus amigos ven tu zona, no tu punto exacto</h1>
        <p className="text-[15px] leading-snug text-text">Necesitamos tu ubicación para mostrarte quién anda cerca.</p>
      </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-card">
      <ul className="flex flex-col gap-3.5">
        <Point tile="bg-cat-estudiar" icon={<Eye aria-hidden="true" size={20} />}>En cards y mapa solo se ve tu <strong className="text-ink">zona aproximada</strong>.</Point>
        <Point tile="bg-cat-comer" icon={<MapPin aria-hidden="true" size={20} />}>Tu punto exacto solo lo ve <strong className="text-ink">tu match</strong>, mientras dura el plan.</Point>
        <Point tile="bg-cat-musica" icon={<EyeOff aria-hidden="true" size={20} />}><strong className="text-ink">Modo fantasma</strong>: desapareces de todo en un toque.</Point>
      </ul>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="text-center text-caption text-muted">Solo usamos tu ubicación mientras la app está abierta.</p>
        <Button size="lg" full loading={phase === 'asking'} onClick={ask}>Activar ubicación</Button>
        <Button variant="ghost" full onClick={() => setPhase('manual')}>Ahora no, elijo mi zona a mano</Button>
      </div>
      </div>
    </Layout>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-6 pt-11 pb-7 lg:grid lg:max-w-[1040px] lg:grid-cols-2 lg:content-center lg:items-center lg:gap-x-20 lg:px-10">{children}</div>
}

function Point({ tile, icon, children }: { tile: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className={`flex size-[42px] flex-none items-center justify-center rounded-[13px] border border-line text-ink ${tile}`}>{icon}</span>
      <p className="text-sm leading-snug text-text">{children}</p>
    </li>
  )
}
