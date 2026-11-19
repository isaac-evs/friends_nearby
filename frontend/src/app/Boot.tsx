import { useEffect, useState, type ReactNode } from 'react'
import { api, type Bootstrap } from '@/api/client'

/** Carga los datos iniciales por el cliente de API. Mientras llegan: esqueleto; si falla: reintentar. */
export function Boot({ children }: { children: (data: Bootstrap) => ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setFailed(false)
    api.bootstrap().then((d) => { if (live) setData(d) }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [attempt])

  if (data) return <>{children(data)}</>
  if (failed) {
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <p className="text-base font-bold">No pudimos cargar ¿Jalas?</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-11 rounded-md border border-line bg-surface px-4 text-sm font-bold">Reintentar</button>
      </div>
    )
  }
  return <div role="status" aria-busy="true" aria-label="Cargando" className="min-h-dvh animate-pulse bg-bg" />
}
