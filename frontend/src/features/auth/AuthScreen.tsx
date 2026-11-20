import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Field, Logo, Notice, PasswordChecklist, PasswordField } from '@/design'
import { Showcase } from './Showcase'
import { passwordRules } from '@/lib/password'
import { cn } from '@/lib/cn'
import { UsernameInput } from '@/api/schemas'
import { useActions, useApp } from '@/app/store'

type Mode = 'login' | 'registro' | 'recuperar' | 'reset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Pantalla 1: Entrar / Registro / Olvidé mi contraseña (mismo lenguaje visual). */
export function AuthScreen() {
  const resetToken = new URLSearchParams(window.location.search).get('reset')
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ name?: string; username?: string; email?: string; password?: string; confirm?: string }>({})
  const [shaking, setShaking] = useState(false)
  const { authError, clearAuthError } = useApp()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { signIn, forgotPassword, resetPassword } = useActions()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  const go = (m: Mode) => { setMode(m); setErrors({}); setSent(false); setConfirm(''); clearAuthError() }
  const edited = () => { if (authError) clearAuthError() }
  const newPw = mode === 'registro' || mode === 'reset'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (mode === 'registro' && name.trim().length < 2) next.name = 'Dinos cómo te llamas (mínimo 2 letras).'
    if (mode === 'registro' && !UsernameInput.safeParse({ username }).success) next.username = 'Usa de 3 a 20 letras minúsculas, números o guion bajo.'
    if (mode !== 'reset' && !EMAIL_RE.test(email)) next.email = 'Revisa tu correo: debe verse como tu@correo.com.'
    if (mode === 'login' && !password) next.password = 'Escribe tu contraseña.'
    if (newPw) {
      if (!passwordRules(password).every((r) => r.ok)) next.password = 'Tu contraseña aún no cumple los requisitos.'
      else if (confirm !== password) next.confirm = 'Las contraseñas no coinciden.'
    }
    setErrors(next)
    if (Object.keys(next).length) { setShaking(true); return }
    setLoading(true)
    try {
      if (mode === 'recuperar') { if (await forgotPassword(email)) setSent(true); return }
      if (mode === 'reset') {
        if (await resetPassword(resetToken!, password)) { window.history.replaceState({}, '', '/entrar'); setMode('login'); setPassword(''); setConfirm('') }
        return
      }
      if (await signIn(email, password, mode === 'registro' ? name.trim() : undefined, username)) nav(from, { replace: true })
      else setShaking(true)
    } finally { setLoading(false) }
  }

  const title = mode === 'login' ? ['Tus amigos cerca.', 'Tus planes, ya.'] : mode === 'registro' ? ['Crea tu cuenta.', 'Y a jalar.'] : mode === 'reset' ? ['Crea tu nueva', 'contraseña.'] : ['¿Olvidaste', 'tu contraseña?']
  const sub = mode === 'login' ? 'Mira qué andan haciendo y únete con un swipe.' : mode === 'registro' ? 'Elige tu usuario para que tus amigos te encuentren.' : mode === 'reset' ? 'Usa al menos 8 caracteres.' : 'Escribe tu correo y te mandamos un link para crear una nueva.'

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden lg:grid lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <Backdrop />
      <main className="mx-auto flex w-full max-w-[480px] flex-col px-6 pt-8 pb-7 md:pt-14 lg:h-dvh lg:max-w-none lg:overflow-y-auto lg:px-12 lg:py-8">
        <div className="flex w-full flex-col gap-6 lg:my-auto lg:[@media(max-height:780px)]:gap-4 lg:max-w-[420px] lg:self-center">
        <div className="flex items-center gap-3">
          {mode !== 'login' && (
            <button type="button" aria-label="Volver a entrar" onClick={() => go('login')} className="flex size-11 items-center justify-center rounded-full">
              <ArrowLeft aria-hidden="true" size={20} />
            </button>
          )}
          <Logo className="text-[40px] tracking-[-1.2px] lg:text-[52px] lg:tracking-[-1.8px] lg:[@media(max-height:780px)]:text-[40px]" />
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-display font-extrabold lg:text-[44px] lg:tracking-[-1.4px] lg:[@media(max-height:780px)]:text-[34px]">
            {title[0]}<br /><span className="text-primary">{title[1]}</span>
          </h1>
          <p className="text-base leading-normal text-text">{sub}</p>
        </div>

        <div className="flex w-full flex-col gap-6">

      {sent ? (
        <Notice tone="safety" icon="shield" role="status">
          Si ese correo tiene cuenta, te mandamos un link. Revisa tu bandeja y spam.
        </Notice>
      ) : (
        <form noValidate onSubmit={submit} onAnimationEnd={() => setShaking(false)} className={cn('flex flex-col gap-3', shaking && 'shake-motion')}>
          {mode === 'registro' && (
            <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Nombre" autoComplete="given-name" placeholder="Tu nombre" value={name} onChange={(e) => { setName(e.target.value); edited() }} error={errors.name} />
          <Field label="Usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="tu_usuario" value={username} onChange={e => { setUsername(e.target.value.toLowerCase()); edited() }} error={errors.username} />
            </div>
          )}
          {mode !== 'reset' && <Field label="Correo" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => { setEmail(e.target.value); edited() }} error={errors.email} />}
          {mode !== 'recuperar' && (
            <div className={cn('grid gap-3', newPw && 'lg:grid-cols-2')}>
              <PasswordField
                label="Contraseña" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); edited() }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={errors.password} aria-describedby={newPw ? 'auth-pw-rules' : undefined}
              />
              {newPw && <PasswordField label="Confirma tu contraseña" placeholder="••••••••" value={confirm} onChange={(e) => { setConfirm(e.target.value); edited() }} autoComplete="new-password" error={errors.confirm} />}
            </div>
          )}
          {newPw && <PasswordChecklist id="auth-pw-rules" value={password} className="lg:flex-row lg:flex-wrap lg:gap-x-4" />}
          {mode === 'login' && (
            <button type="button" onClick={() => go('recuperar')} className="min-h-11 self-end text-sm font-bold text-primary hover:text-primary-hover">
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {authError && (
            <Notice key={authError} tone="warning" icon="lock" role="alert" className="alert-motion">
              <span>{authError}</span>
            </Notice>
          )}
          <Button type="submit" variant="dark" size="lg" pill full loading={loading}>
            {mode === 'login' ? 'Entrar' : mode === 'registro' ? 'Crear cuenta' : mode === 'reset' ? 'Guardar contraseña' : 'Mandar link'}
          </Button>
        </form>
      )}

      {mode === 'login' && (
        <section aria-label="Crear cuenta" className="mt-2 flex flex-col gap-4 border-t border-line pt-7">
          <p className="text-center text-sm font-semibold text-muted">¿Nuevo por aquí?</p>
          <Button variant="secondary" size="lg" pill full onClick={() => go('registro')}>Crea tu cuenta</Button>
        </section>
      )}
      {mode === 'registro' && (
        <p className="text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <button type="button" onClick={() => go('login')} className="min-h-11 font-extrabold text-primary hover:text-primary-hover">Entra</button>
        </p>
      )}
        </div>
        </div>
      </main>
      <Showcase className="hidden lg:sticky lg:top-0 lg:order-first lg:block lg:h-dvh" />
    </div>
  )
}

/** Adorno de fondo para móvil y tablet (decorativo): manchas pastel que se mueven despacio. Quieto con `prefers-reduced-motion`. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden lg:hidden">
      <div className="drift-motion absolute -top-24 -left-20 size-72 rounded-full bg-primary-soft opacity-70" />
      <div style={{ animationDelay: '-5s' }} className="drift-motion absolute top-1/3 -right-24 size-64 rounded-full bg-cat-cafe opacity-60" />
      <div style={{ animationDelay: '-9s' }} className="drift-motion absolute -bottom-24 left-1/4 size-72 rounded-full bg-cat-musica opacity-60" />
    </div>
  )
}
