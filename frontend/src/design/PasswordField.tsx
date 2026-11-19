import { useState, type ComponentProps } from 'react'
import { Check, Circle, Eye, EyeOff } from 'lucide-react'
import { Field } from './Field'
import { passwordRules } from '@/lib/password'
import { cn } from '@/lib/cn'

/** Campo de contraseña con botón para verla u ocultarla (`aria-pressed`, objetivo de 44 px). */
export function PasswordField(props: Omit<ComponentProps<typeof Field>, 'type' | 'trailing'>) {
  const [shown, setShown] = useState(false)
  return (
    <Field
      {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
      trailing={(
        <button
          type="button" aria-pressed={shown} aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShown((s) => !s)}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          {shown ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
        </button>
      )}
    />
  )
}

/** Requisitos de una contraseña nueva, con ✓ al cumplirse. Va asociado al campo por `id` (`aria-describedby`). */
export function PasswordChecklist({ id, value, className }: { id: string; value: string; className?: string }) {
  return (
    <ul id={id} aria-label="Requisitos de la contraseña nueva" className={cn('flex flex-col gap-1', className)}>
      {passwordRules(value).map((r) => (
        <li key={r.id} className={cn('flex items-center gap-2 text-caption font-semibold', r.ok ? 'text-ink' : 'text-muted')}>
          {r.ok ? <Check aria-hidden="true" size={14} strokeWidth={3} className="text-success" /> : <Circle aria-hidden="true" size={14} />}
          {r.label}
          <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
        </li>
      ))}
    </ul>
  )
}
