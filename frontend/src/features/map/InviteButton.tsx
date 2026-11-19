import { Button, ButtonLink, useToast } from '@/design'
import { useActions } from '@/app/store'
import { useClock } from '@/app/hooks'
import { useMyPlans } from '@/features/plans/useMyPlans'

/**
 * Invitar a un amigo a un plan. Si ya tienes un plan tuyo activo (próximo o en curso) lo invita a ese; si no, abre Publicar
 * con esa persona ya elegida.
 */
export function InviteButton({ userId, name, className }: { userId: string; name: string; className?: string }) {
  const { invitePeople } = useActions()
  const toast = useToast()
  const mine = useMyPlans(useClock(30_000)).find((p) => p.kind === 'plan' && p.role === 'organizador' && p.phase !== 'ended')
  if (!mine) return <ButtonLink to={`/publicar?invitar=${userId}`} className={className} aria-label={`Invitar a ${name} a un plan`}>Invitar</ButtonLink>
  return (
    <Button
      className={className} aria-label={`Invitar a ${name} a «${mine.title}»`}
      onClick={() => { const n = invitePeople(mine.id, [userId]); toast(n ? `Invitaste a ${name} a «${mine.title}»` : `${name} ya tiene tu invitación`) }}
    >
      Invitar
    </Button>
  )
}
