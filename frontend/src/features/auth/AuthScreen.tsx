import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Field, Logo, Notice, Pill } from '@/design'
import { useActions } from '@/app/store'

type Mode = 'login' | 'registro' | 'recuperar'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Pantalla 1: Entrar / Registro / Olvidé mi contraseña (mismo lenguaje visual). */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { signIn } = useActions()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  const go = (m: Mode) => { setMode(m); setErrors({}); setSent(false) }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (mode === 'registro' && name.trim().length < 2) next.name = 'Dinos cómo te llamas (mínimo 2 letras).'
    if (!EMAIL_RE.test(email)) next.email = 'Revisa tu correo: debe verse como tu@correo.com.'
    if (mode !== 'recuperar' && password.length < 8) next.password = 'Usa al menos 8 caracteres.'
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    // Mock de red. Recuperar responde igual exista o no el correo (no revela cuentas).
    window.setTimeout(() => {
      setLoading(false)
      if (mode === 'recuperar') { setSent(true); return }
      signIn(email, mode === 'registro' ? name.trim() : undefined)
      nav(from, { replace: true })
    }, 500)
  }

  const title = mode === 'login' ? ['Tus amigos cerca.', 'Tus planes, ya.'] : mode === 'registro' ? ['Crea tu cuenta.', 'Y a jalar.'] : ['¿Olvidaste', 'tu contraseña?']
  const sub = mode === 'login' ? 'Mira qué andan haciendo y únete con un swipe.' : mode === 'registro' ? 'Solo tu nombre y tu correo. Tu ubicación nunca sale de tu zona.' : 'Escribe tu correo y te mandamos un link para crear una nueva.'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-6 pt-10 pb-7 lg:grid lg:max-w-[1120px] lg:grid-cols-2 lg:items-center lg:gap-x-20 lg:px-10">
      <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {mode !== 'login' && (
          <button type="button" aria-label="Volver a entrar" onClick={() => go('login')} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface shadow-sm">
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        )}
        <Logo />
      </div>

      {mode === 'login' && <Hero />}

      <div className="flex flex-col gap-2.5">
        <h1 className="text-display font-extrabold lg:text-[56px] lg:tracking-[-1.8px]">
          {title[0]}<br /><span className="text-primary">{title[1]}</span>
        </h1>
        <p className="text-base leading-normal text-text">{sub}</p>
      </div>
      </div>

      <div className="flex flex-col gap-6 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-10 lg:shadow-card">

      {sent ? (
        <Notice tone="safety" icon="shield" role="status">
          Si ese correo tiene cuenta, te mandamos un link para recuperarla. Revisa tu bandeja (y spam).
        </Notice>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'registro' && (
            <Field label="Nombre" autoComplete="given-name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          )}
          <Field label="Correo" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          {mode !== 'recuperar' && (
            <Field
              label="Contraseña" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={errors.password}
            />
          )}
          {mode === 'login' && (
            <button type="button" onClick={() => go('recuperar')} className="min-h-11 self-end text-sm font-bold text-primary hover:text-primary-hover">
              ¿Olvidaste tu contraseña?
            </button>
          )}
          <Button type="submit" variant="dark" size="lg" pill full loading={loading}>
            {mode === 'login' ? 'Entrar' : mode === 'registro' ? 'Crear cuenta' : 'Mandar link'}
          </Button>
        </form>
      )}

      {mode === 'login' && (
        <p className="text-center text-sm text-muted">
          ¿Nuevo por aquí?{' '}
          <button type="button" onClick={() => go('registro')} className="min-h-11 font-extrabold text-primary hover:text-primary-hover">Crea tu cuenta</button>
        </p>
      )}
      {mode === 'registro' && (
        <p className="text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <button type="button" onClick={() => go('login')} className="min-h-11 font-extrabold text-primary hover:text-primary-hover">Entra</button>
        </p>
      )}
      </div>
    </div>
  )
}

/** Ilustración del hero (decorativa): card de ejemplo sobre pasteles. */
function Hero() {
  return (
    <div aria-hidden="true" className="relative h-[210px] overflow-hidden rounded-[28px] bg-primary-soft lg:h-[300px]">
      <div className="absolute -top-[30px] -right-[30px] size-40 rounded-full bg-cat-cafe" />
      <div className="absolute -bottom-10 -left-6 size-[140px] rounded-full bg-cat-musica" />
      <div className="absolute inset-x-[34px] top-[38px] flex flex-col gap-3 rounded-[20px] bg-surface p-4 shadow-lg lg:inset-x-[20%] lg:top-[56px] lg:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[38px] items-center justify-center rounded-full bg-cat-comer text-meta font-bold">SO</span>
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-bold">Sofi</span>
            <span className="text-caption font-medium text-muted">a ~800 m · Providencia</span>
          </span>
          <Pill tone="accent">+20 XP</Pill>
        </div>
        <div className="text-[18px] font-extrabold tracking-[-0.3px]">Por un café, ¿alguien?</div>
        <div className="flex gap-2">
          <span className="flex h-[34px] flex-1 items-center justify-center rounded-full bg-surface-muted text-caption font-bold text-text">Paso</span>
          <span className="flex h-[34px] flex-1 items-center justify-center rounded-full bg-primary text-caption font-bold text-white">Jalo</span>
        </div>
      </div>
    </div>
  )
}

