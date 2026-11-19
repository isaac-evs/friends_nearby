import { useNavigate } from 'react-router-dom'
import { Button, useToast } from '@/design'
import { useActions, useApp } from '@/app/store'
import { useClock } from '@/app/hooks'
import { joinBlock } from '@/lib/commitments'
import type { Plan } from '@/api/schemas'

/** Por qué NO puedes unirte a este plan (o `null`): ya empezó sin admitir más, ya terminó o choca con otro plan tuyo. */
export function useJoinBlock(plan: Plan): string | null {
  const { state } = useApp()
  const now = useClock(30_000)
  return joinBlock(state, plan, `plan:${plan.id}`, now)
}

/** El motivo, a la vista, cuando no te puedes unir (para listas donde no cabe el botón + texto). */
export function JoinReason({ plan, joined }: { plan: Plan; joined?: boolean }) {
  const why = useJoinBlock(plan)
  return why && !joined ? <p role="status" className="text-caption font-semibold text-danger">{why}</p> : null
}

/** "Jalo". Si no se puede, queda `aria-disabled` (alcanzable con teclado) y al tocarlo dice por qué. */
export function JoinButton({ plan, className, label = 'Jalo', describedBy }: { plan: Plan; className?: string; label?: string; describedBy?: string }) {
  const { jalo } = useActions()
  const nav = useNavigate()
  const toast = useToast()
  const why = useJoinBlock(plan)
  return (
    <Button
      className={className} aria-disabled={why ? 'true' : undefined} aria-describedby={why ? describedBy : undefined}
      onClick={async () => { if (why) { toast(why); return } const id = await jalo(plan.id); if (id) nav(`/match/${id}`) }}
    >
      {label}
    </Button>
  )
}
