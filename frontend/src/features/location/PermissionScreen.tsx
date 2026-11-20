import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Clock, MapPin, Eye } from 'lucide-react'
import { Button, Notice } from '@/design'
import { useActions } from '@/app/store'
import { roundToCell, type LatLng } from '@/lib/geo'
import { MapPickerSheet } from '@/features/publish/MapPickerSheet'

/** Pantalla 2: pre-permiso, ubicación aproximada elegida en el mapa y manejo de `denied`. */
export function PermissionScreen() {
  const { setLocation } = useActions()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'
  const [phase, setPhase] = useState<'ask' | 'asking' | 'denied' | 'manual'>('ask')
  const [mapOpen, setMapOpen] = useState(false)

  const finish = async (status: 'granted' | 'manual', center: LatLng) => {
    if (await setLocation(status, center)) nav(from, { replace: true })
  }

  const ask = () => {
    if (!('geolocation' in navigator)) { setPhase('denied'); return }
    setPhase('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Privacidad: redondeamos de inmediato a una celda aproximada y descartamos el punto exacto. Nunca se registra.
        finish('granted', roundToCell({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
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
            {phase === 'denied' ? 'Sin ubicación, la eliges tú' : 'Elige tu ubicación aproximada'}
          </h1>
          <p className="text-[15px] leading-snug text-text">
            Verás planes y eventos cerca de ese punto. Se redondea a unos cientos de metros y nadie ve el punto exacto. Puedes activar la ubicación cuando quieras desde los ajustes de tu navegador.
          </p>
        </div>
        {phase === 'denied' && (
          <Notice tone="warning" icon="lock" role="alert">No pudimos acceder a tu ubicación. No pasa nada.</Notice>
        )}
        </div>
        <div className="flex flex-1 flex-col gap-6 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-card">
        <p className="text-sm leading-snug text-text">Marca en el mapa dónde estás (o cerca de dónde estás). Puedes cambiarlo cuando quieras.</p>
        <div className="mt-auto flex flex-col gap-2.5">
          <Button size="lg" full icon={<MapPin aria-hidden="true" size={18} />} onClick={() => setMapOpen(true)}>Elegir en el mapa</Button>
          {phase === 'denied' && <Button variant="ghost" full onClick={ask}>Intentar de nuevo</Button>}
        </div>
        </div>
        <MapPickerSheet open={mapOpen} onClose={() => setMapOpen(false)} onPick={(c) => finish('manual', c)} />
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
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.8px] lg:text-[44px]">Tus amigos cercanos ven dónde andas, no tu punto exacto</h1>
        <p className="text-[15px] leading-snug text-text">Necesitamos tu ubicación para mostrarte quién anda cerca.</p>
      </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-card">
      <ul className="flex flex-col gap-3.5">
        <Point tile="bg-cat-estudiar" icon={<Eye aria-hidden="true" size={20} />}>En el mapa solo se ve tu <strong className="text-ink">ubicación aproximada</strong>, y solo a tus amigos cercanos.</Point>
        <Point tile="bg-cat-comer" icon={<MapPin aria-hidden="true" size={20} />}>Tu punto exacto solo lo ve quien tú elijas, <strong className="text-ink">por el tiempo que elijas</strong>.</Point>
        <Point tile="bg-cat-musica" icon={<Clock aria-hidden="true" size={20} />}><strong className="text-ink">Sin pausa</strong>: si te desconectas, tus amigos ven tu última ubicación con “hace cuánto”.</Point>
      </ul>

      <div className="mt-auto flex flex-col gap-2.5">
        <p className="text-center text-caption text-muted">Solo usamos tu ubicación mientras la app está abierta.</p>
        <Button size="lg" full loading={phase === 'asking'} onClick={ask}>Activar ubicación</Button>
        <Button variant="ghost" full onClick={() => setPhase('manual')}>Ahora no, la elijo en el mapa</Button>
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
