import { AlertCircle, MapPinOff, RotateCw, WifiOff, X, type LucideIcon } from 'lucide-react'

/** Tipo de aviso según lo que dice el mensaje: da título e ícono propios en vez de un "error" genérico. */
function kindOf(message: string): { title: string; Icon: LucideIcon } {
  if (/ubicaci|gps|se[ñn]al/i.test(message)) return { title: 'Ubicación', Icon: MapPinOff }
  if (/conect|internet|servidor|red\b|wi.?fi/i.test(message)) return { title: 'Sin conexión', Icon: WifiOff }
  return { title: 'Algo salió mal', Icon: AlertCircle }
}

/**
 * Aviso de error flotante (`role="alert"`): tarjeta con ícono en pastilla de color, título corto, mensaje claro,
 * "Reintentar" solo cuando tiene sentido (fallas de red o del servidor) y cerrar (44 px). Entra con una animación suave;
 * sin movimiento si se pide reducirlo.
 */
export function ErrorToast({ message, onRetry, onClose, raised }: { message: string; onRetry?: () => void; onClose: () => void; raised?: boolean }) {
  const { title, Icon } = kindOf(message)
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 ${raised ? 'bottom-24 lg:bottom-8' : 'bottom-6'}`}>
      <div role="alert" className="alert-motion pointer-events-auto flex w-full max-w-[480px] items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft p-3 shadow-none">
        <span aria-hidden="true" className="mt-0.5 flex flex-none items-center justify-center text-accent-text"><Icon size={22} strokeWidth={2.2} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
          <p className="text-caption font-extrabold tracking-[0.6px] text-accent-text uppercase">{title}</p>
          <p className="text-sm leading-snug font-semibold text-ink">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-1.5 flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-primary-soft px-3.5 text-sm font-extrabold text-primary">
              <RotateCw aria-hidden="true" size={15} strokeWidth={2.6} />Reintentar
            </button>
          )}
        </div>
        <button type="button" aria-label="Cerrar aviso" onClick={onClose} className="-mt-0.5 -mr-0.5 flex size-11 flex-none items-center justify-center rounded-full text-muted">
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  )
}
