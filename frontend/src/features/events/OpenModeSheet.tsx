import { useNavigate } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { Button, ModalSheet } from '@/design'
import { useApp } from '@/app/store'

/** ¿Puedes usar eventos? Todos los eventos piden el modo abierto activo (y ser adulto). */
export function useOpenModeReady(): boolean {
  const { state } = useApp()
  return state.openMode.enabled && state.openMode.adult
}

/** Aviso cuando intentas entrar a un evento sin modo abierto: lo activas primero (te lleva a la pantalla para hacerlo). */
export function OpenModeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  return (
    <ModalSheet open={open} title="Activa el modo abierto" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <span aria-hidden="true" className="flex items-center justify-center text-primary"><Globe size={24} /></span>
        <p className="text-sm leading-normal text-text">Los eventos son públicos: para unirte o crear uno necesitas el <strong>modo abierto</strong> (solo personas adultas). Tú decides qué ven los demás y puedes apagarlo cuando quieras.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onClose}>Ahora no</Button>
          <Button onClick={() => { onClose(); nav('/modo-abierto') }}>Activarlo</Button>
        </div>
      </div>
    </ModalSheet>
  )
}
