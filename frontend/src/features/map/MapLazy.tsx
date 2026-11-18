import { lazy, Suspense, type ComponentProps } from 'react'
import { MapPinOff } from 'lucide-react'

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const MapView = lazy(() => import('./MapView'))
type Props = ComponentProps<typeof MapView>

/** Carga MapLibre bajo demanda. Sin WebGL mostramos aviso: la vista de lista es el equivalente. */
export function MapLazy(props: Props) {
  if (!hasWebGL()) {
    return (
      <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-map-land p-8 text-center">
        <MapPinOff aria-hidden="true" size={28} className="text-muted" />
        <p className="text-sm font-bold">Tu navegador no puede dibujar el mapa.</p>
        <p className="text-meta text-muted">Usa la vista de lista: tiene los mismos amigos y eventos.</p>
      </div>
    )
  }
  return (
    <Suspense fallback={<div aria-busy="true" className="absolute inset-0 animate-pulse bg-map-land" />}>
      <MapView {...props} />
    </Suspense>
  )
}
