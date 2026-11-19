import { lazy, Suspense, type ComponentProps } from 'react'
import { MapPinOff } from 'lucide-react'

let webgl: boolean | undefined
/** ¿Hay WebGL? Se prueba UNA vez: cada `getContext` abre un contexto y el navegador solo permite unos 16. */
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl = !!gl
  } catch {
    webgl = false
  }
  return webgl
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
