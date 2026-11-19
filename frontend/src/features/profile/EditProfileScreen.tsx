import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Circle } from 'lucide-react'
import { Button, Field, IconButton, ImageUpload, Notice, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { api } from '@/api/client'
import { PasswordChangeInput, ProfileBioInput, ProfileNameInput, UsernameInput } from '@/api/schemas'
import { passwordRules } from '@/lib/password'
import { cn } from '@/lib/cn'

/** `/perfil/editar`: nombre, contraseña, foto de perfil y portada. Endpoints [PROPUESTA] (ver docs/especificacion.md §7). */
export function EditProfileScreen() {
  const { state } = useApp()
  const { setProfileImage } = useActions()
  const nav = useNavigate()
  const me = state.users.me!

  return (
    <div className="flex flex-col gap-6 px-[22px] pt-8 pb-10 lg:max-w-[600px] lg:p-0">
      <header className="flex items-center gap-3">
        <IconButton label="Volver al perfil" onClick={() => nav('/perfil')}><ArrowLeft aria-hidden="true" size={20} strokeWidth={2.4} /></IconButton>
        <h1 className="text-h1 font-extrabold">Editar perfil</h1>
      </header>

      <Section title="Fotos">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-meta font-bold">Portada</h3>
          <ImageUpload
            kind="cover" label="Portada" noun="portada" hintId="photo-hint" value={me.coverUrl} userId={me.id} name={me.name}
            upload={(b) => api.profile.uploadMedia('cover', b)} onChange={(u) => setProfileImage('cover', u)} onRemove={() => setProfileImage('cover', null)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-meta font-bold">Foto de perfil</h3>
          <ImageUpload
            kind="avatar" label="Foto de perfil" noun="foto" hintId="photo-hint" value={me.avatarUrl} userId={me.id} name={me.name}
            upload={(b) => api.profile.uploadMedia('avatar', b)} onChange={(u) => setProfileImage('avatar', u)} onRemove={() => setProfileImage('avatar', null)}
          />
        </div>
        <p id="photo-hint" className="text-caption font-medium text-muted">JPG, PNG o WebP · hasta 5 MB. Quitamos los datos ocultos de la foto, como su ubicación.</p>
      </Section>

      <NameForm />
      <UsernameForm />
      <BioForm />
      <PasswordForm />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `sec-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4">
      <h2 id={id} className="text-h3 font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

function NameForm() {
  const { state } = useApp()
  const { updateName } = useActions()
  const toast = useToast()
  const current = state.users.me!.name
  const [name, setName] = useState(current)
  const [error, setError] = useState<string>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = ProfileNameInput.safeParse({ name })
    if (!r.success) { setError(r.error.issues[0]?.message); return }
    setError(undefined)
    updateName(r.data.name)
    setName(r.data.name)
    toast('Nombre actualizado')
  }

  return (
    <Section title="Tu nombre">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nombre" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={error} hint="Así te ven tus amigos." maxLength={60} />
        <Button type="submit" variant="dark" full disabled={name.trim() === current}>Guardar nombre</Button>
      </form>
    </Section>
  )
}

function UsernameForm() {
  const { state } = useApp()
  const { updateHandle } = useActions()
  const toast = useToast()
  const current = state.users.me!.handle.replace('@', '')
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = UsernameInput.safeParse({ username: value })
    if (!r.success) { setError(r.error.issues[0]?.message); return }
    setError(undefined)
    if (r.data.username === current) return
    setLoading(true)
    try {
      const others = Object.values(state.users).filter((u) => u.id !== 'me').map((u) => u.handle)
      if (!(await api.profile.isUsernameAvailable(r.data.username, others))) { setError('Ese nombre de usuario ya está en uso.'); return }
      updateHandle(r.data.username)
      setValue(r.data.username)
      toast('Usuario actualizado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Nombre de usuario">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Usuario" icon={<span className="text-base font-bold">@</span>} value={value} onChange={(e) => setValue(e.target.value)} error={error}
          hint="Así te encuentran tus amigos. Letras minúsculas, números, punto y guion bajo." maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
        />
        <Button type="submit" variant="dark" full loading={loading} disabled={value.trim().toLowerCase() === current}>Guardar usuario</Button>
      </form>
    </Section>
  )
}

const BIO_MAX = 160

function BioForm() {
  const { state } = useApp()
  const { updateBio } = useActions()
  const toast = useToast()
  const current = state.users.me!.bio ?? ''
  const [bio, setBio] = useState(current)
  const [error, setError] = useState<string>()
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = ProfileBioInput.safeParse({ bio })
    if (!r.success) { setError(r.error.issues[0]?.message); return }
    setError(undefined)
    updateBio(r.data.bio)
    setBio(r.data.bio)
    toast(r.data.bio ? 'Descripción actualizada' : 'Descripción quitada')
  }

  return (
    <Section title="Descripción">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-meta font-bold">Cuéntale a tu banda quién eres</label>
          <textarea
            id={id} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Ej. Corro en las mañanas y tomo café en las tardes."
            aria-invalid={error ? true : undefined} aria-describedby={`${id}-count`}
            className={cn('w-full resize-none rounded-md border bg-surface px-4 py-3 text-base text-ink', error ? 'border-danger' : 'border-line-input')}
          />
          <span id={`${id}-count`} role={error ? 'alert' : undefined} className={cn('text-caption font-medium', error || bio.length > BIO_MAX ? 'text-danger' : 'text-muted')}>
            {error ?? `${bio.length}/${BIO_MAX} caracteres`}
          </span>
        </div>
        <Button type="submit" variant="dark" full disabled={bio.trim() === current}>Guardar descripción</Button>
      </form>
    </Section>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [v, setV] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => { setV((p) => ({ ...p, [k]: e.target.value })); setDone(false) }
  const rules = passwordRules(v.next)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setDone(false)
    const r = PasswordChangeInput.safeParse(v)
    if (!r.success) {
      const next: typeof errors = {}
      for (const i of r.error.issues) { const k = i.path[0] as keyof typeof v; next[k] ??= i.message }
      setErrors(next)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      await api.profile.changePassword({ current: r.data.current, next: r.data.next })
      setV({ current: '', next: '', confirm: '' })
      setDone(true)
      toast('Contraseña actualizada')
    } catch (err) {
      setErrors({ current: err instanceof Error ? err.message : 'No pudimos cambiar tu contraseña. Intenta de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="Contraseña">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Contraseña actual" type="password" autoComplete="current-password" value={v.current} onChange={set('current')} error={errors.current} />
        <Field label="Contraseña nueva" type="password" autoComplete="new-password" value={v.next} onChange={set('next')} error={errors.next} aria-describedby="pw-rules" />
        <ul id="pw-rules" aria-label="Requisitos de la contraseña nueva" className="flex flex-col gap-1">
          {rules.map((r) => (
            <li key={r.id} className={cn('flex items-center gap-2 text-caption font-semibold', r.ok ? 'text-ink' : 'text-muted')}>
              {r.ok ? <Check aria-hidden="true" size={14} strokeWidth={3} className="text-success" /> : <Circle aria-hidden="true" size={14} />}
              {r.label}
              <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
        <Field label="Confirma la contraseña nueva" type="password" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} error={errors.confirm} />
        {done && <Notice tone="safety" icon="shield" role="status">Listo, tu contraseña cambió.</Notice>}
        <Button type="submit" variant="dark" full loading={loading}>Cambiar contraseña</Button>
      </form>
    </Section>
  )
}
