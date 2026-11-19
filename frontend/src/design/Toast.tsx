import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

/** Aviso breve (`role="status"`) para confirmaciones: "Link copiado", "Borrador guardado". */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-5 lg:bottom-8">
        {msg && <span className="alert-motion flex max-w-[460px] items-center gap-2.5 rounded-xl bg-ink py-2.5 pr-4 pl-3 text-sm leading-snug font-bold text-white shadow-none"><span aria-hidden="true" className="size-2 flex-none rounded-full bg-accent" />{msg}</span>}
      </div>
    </ToastCtx.Provider>
  )
}
