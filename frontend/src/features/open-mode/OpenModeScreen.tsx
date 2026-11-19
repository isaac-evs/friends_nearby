import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, EyeOff, Flag, MapPin, ShieldCheck } from 'lucide-react'
import { Button, ToggleRow, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { cn } from '@/lib/cn'

/** Pantalla 9: Modo abierto (consentimiento). Apagado por defecto; 18+ obligatorio. */
export function OpenModeScreen() {
  const { state } = useApp()
  const { setOpenMode } = useActions()
  const toast = useToast()
  const nav = useNavigate()
  const om = state.openMode
  const [big, setBig] = useState(om.bigEvents)
  const [small, setSmall] = useState(om.smallPlans)
  const [adult, setAdult] = useState(om.adult)

  const activate = async () => {
    if (!await setOpenMode({ enabled: true, adult: true, bigEvents: big, smallPlans: small })) return
    toast('Modo abierto activado')
    nav('/')
  }

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 px-[22px] pt-[34px] pb-5 lg:min-h-0 lg:p-0">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Volver" onClick={() => nav(-1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></button>
        <div aria-hidden="true" className="flex items-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-line bg-cat-comer text-meta font-bold">SO</span>
          <span className="-ml-2.5 flex size-10 items-center justify-center rounded-full border border-line bg-cat-musica text-meta font-bold">MA</span>
          <span className="-ml-2.5 flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-line-dashed bg-surface text-lg font-extrabold">?</span>
          <span className="-ml-2.5 flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-line-dashed bg-surface text-lg font-extrabold">?</span>
          <span className="ml-2 rounded-sm border border-line bg-accent px-2 py-0.5 text-[11px] font-bold">nuevo</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 lg:grid lg:flex-none lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-start lg:gap-x-16 lg:gap-y-5">
      <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.8px]">Modo abierto: <span className="underline decoration-accent decoration-4 underline-offset-4">tú decides</span></h1>
        <p className="mt-1 text-sm leading-snug font-medium text-text">Únete a social runs, retas y eventos con gente nueva. Está apagado hasta que tú lo actives.</p>
      </div>

      <ul className="flex flex-col gap-2.5">
        <Point tile="bg-cat-estudiar" icon={<EyeOff aria-hidden="true" size={20} strokeWidth={2.2} />}>Gente nueva <strong>nunca ve tu ubicación</strong>. Solo tu nombre y foto al unirte.</Point>
        <Point tile="bg-cat-musica" icon={<MapPin aria-hidden="true" size={20} strokeWidth={2.2} />}>Solo planes en <strong>lugares públicos</strong>: runs, retas, picnics, clases.</Point>
        <Point tile="bg-cat-comer" icon={<ShieldCheck aria-hidden="true" size={20} strokeWidth={2.2} />}><strong>Organizador verificado</strong> y cupo visible antes de unirte.</Point>
        <Point tile="bg-cat-clase" icon={<Flag aria-hidden="true" size={20} strokeWidth={2.2} />}>Ve con un amigo y sal cuando quieras. <strong>Bloquea o reporta</strong> en un toque.</Point>
      </ul>

      </div>
      <div className="flex flex-1 flex-col gap-3.5 lg:flex-none lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-6 lg:shadow-sm">
      <section aria-label="Qué quieres ver" className="flex flex-col rounded-[18px] border border-line bg-surface py-0.5 pr-2.5 pl-3.5">
        <ToggleRow title="Eventos grandes" subtitle="Social runs, retas, clases · 10+ personas" checked={big} onChange={setBig} />
        <ToggleRow title="Planes chicos con gente nueva" subtitle="Grupos de 2 a 6 · tú apruebas" checked={small} onChange={setSmall} last />
      </section>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-meta font-bold">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="m-0 size-[22px] accent-primary" />
        Confirmo que tengo 18 años o más
      </label>

      <div className="mt-auto flex flex-col gap-1.5">
        <Button size="lg" full disabled={!adult} onClick={activate} className={cn(!adult && 'pointer-events-none')}>{om.enabled ? 'Guardar preferencias' : 'Activar modo abierto'}</Button>
        {om.enabled ? (
          <Button variant="ghost" full onClick={async () => { if (!await setOpenMode({ enabled: false })) return; toast('Modo abierto apagado'); nav('/perfil') }}>Apagar modo abierto</Button>
        ) : (
          <Button variant="ghost" full onClick={() => nav(-1)}>Ahora no, solo amigos</Button>
        )}
      </div>
      </div>
      </div>
    </div>
  )
}

function Point({ tile, icon, children }: { tile: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className={cn('flex size-10 flex-none items-center justify-center rounded-[12px] border border-line text-ink', tile)}>{icon}</span>
      <span className="text-meta leading-snug font-medium [&_strong]:font-bold">{children}</span>
    </li>
  )
}
