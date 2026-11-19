import { describe, expect, it } from 'vitest'
import { addXp, initialState, reducer } from '@/api/mock/store'
import { UsernameInput } from '@/api/schemas'
import { locationViewers } from '@/lib/privacy'
import { createMockBootstrap } from '@/api/mock'

const fresh = () => initialState(createMockBootstrap())

describe('eliminar amigo', () => {
  it('pasa a "none", deja de ser cercano y corta la ubicación exacta', () => {
    let s = reducer(fresh(), { type: 'exactStart', userId: 'sofi', until: new Date(Date.now() + 3_600_000).toISOString() })
    expect(s.exactShares).toHaveLength(1)
    s = reducer(s, { type: 'removeFriend', userId: 'sofi' })
    expect(s.friendships.sofi?.status).toBe('none')
    expect(s.friendships.sofi?.close).toBe('none')
    expect(s.exactShares).toHaveLength(0)
  })
  it('no toca a quien no es amigo', () => {
    const s0 = fresh()
    expect(reducer(s0, { type: 'removeFriend', userId: 'karla' })).toBe(s0)
    expect(reducer(s0, { type: 'removeFriend', userId: 'pau' })).toBe(s0)
  })
})

describe('amigo cercano: solicitud aparte y mutua', () => {
  const op = (s: ReturnType<typeof fresh>, userId: string, o: 'request' | 'cancel' | 'accept' | 'decline' | 'remove' | 'accepted') => reducer(s, { type: 'close', userId, op: o })
  it('el seed trae cercanos mutuos, una solicitud recibida (Dani) y el resto sin relación', () => {
    const s = fresh()
    expect(['sofi', 'mau', 'nico'].every((id) => s.friendships[id]?.close === 'mutual')).toBe(true)
    expect(s.friendships.dani?.close).toBe('requested_in')
    expect(s.friendships.regina?.close).toBe('none')
  })
  it('enviar → pendiente; solo cuando la otra persona acepta son cercanos', () => {
    let s = op(fresh(), 'regina', 'request')
    expect(s.friendships.regina?.close).toBe('requested_out')
    expect(locationViewers(s)).not.toContain('regina') // pendiente: aún no ve tu ubicación
    s = op(s, 'regina', 'accepted')
    expect(s.friendships.regina?.close).toBe('mutual')
    expect(locationViewers(s)).toContain('regina')
  })
  it('se puede cancelar lo enviado; no se puede "aceptar" algo que tú enviaste', () => {
    let s = op(fresh(), 'regina', 'request')
    const same = op(s, 'regina', 'accept')
    expect(same.friendships.regina?.close).toBe('requested_out')
    s = op(s, 'regina', 'cancel')
    expect(s.friendships.regina?.close).toBe('none')
  })
  it('aceptar o rechazar una solicitud recibida', () => {
    expect(op(fresh(), 'dani', 'accept').friendships.dani?.close).toBe('mutual')
    expect(op(fresh(), 'dani', 'decline').friendships.dani?.close).toBe('none')
  })
  it('quitar a un cercano lo deja como amigo normal', () => {
    const s = op(fresh(), 'sofi', 'remove')
    expect(s.friendships.sofi?.close).toBe('none')
    expect(s.friendships.sofi?.status).toBe('friends')
  })
  it('no aplica a quien no es amigo', () => {
    const s0 = fresh()
    for (const id of ['karla', 'pau', 'nadie']) expect(op(s0, id, 'request')).toBe(s0)
  })
  it('un amigo nuevo entra sin ser cercano', () => {
    let s = reducer(fresh(), { type: 'friendStatus', userId: 'pau', status: 'friends' })
    expect(s.friendships.pau?.close).toBe('none')
    s = reducer(fresh(), { type: 'friendStatus', userId: 'nuevo', status: 'friends' })
    expect(s.friendships.nuevo?.close).toBe('none')
  })
  it('al eliminar a un cercano y volver a agregarlo ya no es cercano', () => {
    let s = reducer(fresh(), { type: 'removeFriend', userId: 'sofi' })
    s = reducer(s, { type: 'friendStatus', userId: 'sofi', status: 'friends' })
    expect(s.friendships.sofi?.close).toBe('none')
  })
  it('bloquear corta la relación cercana y la ubicación exacta', () => {
    let s = reducer(fresh(), { type: 'exactStart', userId: 'sofi', until: new Date(Date.now() + 3_600_000).toISOString() })
    s = reducer(s, { type: 'block', userId: 'sofi' })
    expect(s.friendships.sofi?.close).toBe('none')
    expect(s.exactShares).toHaveLength(0)
  })
})

describe('ubicación exacta temporal', () => {
  const in1h = () => new Date(Date.now() + 3_600_000).toISOString()
  it('solo se comparte con un amigo cercano (mutuo) y con fin', () => {
    const s0 = fresh()
    expect(reducer(s0, { type: 'exactStart', userId: 'regina', until: in1h() })).toBe(s0) // amigo normal
    expect(reducer(s0, { type: 'exactStart', userId: 'dani', until: in1h() })).toBe(s0) // solicitud pendiente
    expect(reducer(s0, { type: 'exactStart', userId: 'karla', until: in1h() })).toBe(s0) // ni amigo
    expect(reducer(s0, { type: 'exactStart', userId: 'sofi', until: new Date(Date.now() - 1000).toISOString() })).toBe(s0) // ya vencida
    const s = reducer(s0, { type: 'exactStart', userId: 'sofi', until: in1h() })
    expect(s.exactShares.map((x) => x.userId)).toEqual(['sofi'])
  })
  it('compartir de nuevo reemplaza (no duplica) y se puede cortar', () => {
    let s = reducer(fresh(), { type: 'exactStart', userId: 'sofi', until: in1h() })
    s = reducer(s, { type: 'exactStart', userId: 'sofi', until: in1h() })
    expect(s.exactShares).toHaveLength(1)
    s = reducer(s, { type: 'exactStop', userId: 'sofi' })
    expect(s.exactShares).toHaveLength(0)
  })
  it('en modo fantasma no se puede compartir, y activarlo corta lo que compartías', () => {
    let s = reducer(fresh(), { type: 'exactStart', userId: 'sofi', until: in1h() })
    s = reducer(s, { type: 'toggleGhost' })
    expect(s.ghost).toBe(true)
    expect(s.exactShares).toHaveLength(0)
    expect(reducer(s, { type: 'exactStart', userId: 'mau', until: in1h() }).exactShares).toHaveLength(0)
  })
  it('en modo fantasma también se corta lo que te compartían y no se puede pedir', () => {
    let s = reducer(fresh(), { type: 'exactAsk', userId: 'sofi' })
    s = reducer(s, { type: 'exactGrant', userId: 'sofi', until: in1h() })
    expect(s.exactGrants).toHaveLength(1)
    s = reducer(s, { type: 'toggleGhost' })
    expect(s.exactGrants).toHaveLength(0)
    expect(s.exactPending).toHaveLength(0)
    expect(reducer(s, { type: 'exactAsk', userId: 'mau' }).exactPending).toHaveLength(0)
    expect(reducer(s, { type: 'toggleGhost' }).ghost).toBe(false)
  })
  it('en modo fantasma no te puedes unir a nada (solo ver qué hay)', () => {
    const s = reducer(fresh(), { type: 'toggleGhost' })
    const plan = s.plans.find((p) => p.id === 'plan-sofi')!
    const match = { id: 'm', planId: plan.id, friendId: 'sofi', createdAt: '', togetherAt: null, meetPoint: 'x', quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false }
    expect(reducer(s, { type: 'jalo', plan, match }).matches).toHaveLength(0)
    expect(reducer(s, { type: 'joinEvent', eventId: 'evt-run' }).attendances).toHaveLength(0)
    const off = reducer(s, { type: 'toggleGhost' })
    expect(reducer(off, { type: 'jalo', plan, match }).matches).toHaveLength(1)
  })
  it('pedir la suya: queda pendiente y solo entra si la otra persona la concede', () => {
    let s = reducer(fresh(), { type: 'exactAsk', userId: 'sofi' })
    expect(s.exactPending).toEqual(['sofi'])
    expect(s.exactGrants).toHaveLength(0)
    expect(reducer(s, { type: 'exactGrant', userId: 'mau', until: in1h() }).exactGrants).toHaveLength(0) // nunca pedido
    s = reducer(s, { type: 'exactGrant', userId: 'sofi', until: in1h() })
    expect(s.exactPending).toEqual([])
    expect(s.exactGrants.map((x) => x.userId)).toEqual(['sofi'])
    // No se puede pedir a quien no es cercano.
    const s0 = fresh()
    expect(reducer(s0, { type: 'exactAsk', userId: 'regina' })).toBe(s0)
  })
  it('cancelar el pedido lo quita', () => {
    const s = reducer(reducer(fresh(), { type: 'exactAsk', userId: 'sofi' }), { type: 'exactAskCancel', userId: 'sofi' })
    expect(s.exactPending).toEqual([])
  })
})

describe('verificar que estamos juntos', () => {
  it('guarda cuándo se verificó, una sola vez', () => {
    let s = fresh()
    const plan = s.plans.find((p) => p.id === 'plan-sofi')!
    const match = { id: 'm1', planId: plan.id, friendId: 'sofi', createdAt: new Date().toISOString(), togetherAt: null, meetPoint: plan.place.name, quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false }
    s = reducer(s, { type: 'jalo', plan, match })
    expect(s.matches[0]?.togetherAt).toBeNull()
    s = reducer(s, { type: 'verifyTogether', matchId: 'm1' })
    const first = s.matches[0]!.togetherAt
    expect(first).toBeTruthy()
    expect(reducer(s, { type: 'verifyTogether', matchId: 'm1' }).matches[0]!.togetherAt).toBe(first)
  })
})

describe('nombre de usuario', () => {
  it('se guarda con @', () => {
    expect(reducer(fresh(), { type: 'setHandle', handle: 'alan.v' }).users.me?.handle).toBe('@alan.v')
  })
  it('valida el formato', () => {
    const ok = (v: string) => UsernameInput.safeParse({ username: v }).success
    expect(ok('alan')).toBe(true)
    expect(ok('  Alan.V_9 ')).toBe(true) // recorta y pasa a minúsculas
    expect(UsernameInput.parse({ username: '  Alan.V_9 ' }).username).toBe('alan.v_9')
    for (const bad of ['ab', 'x'.repeat(21), 'con espacio', 'ñandú', '.alan', 'alan.', 'a..b', 'admin', 'JALAS', '@alan']) expect(ok(bad)).toBe(false)
  })
})

describe('XP y nivel máximo', () => {
  const at = (level: number, xp: number) => {
    const s = fresh()
    return { ...s, xp, users: { ...s.users, me: { ...s.users.me!, level } } }
  }
  it('sube de nivel al llegar a la meta y conserva el sobrante', () => {
    const s = addXp(at(7, 490), 30, 'Ya nos vimos')
    expect(s.users.me?.level).toBe(8)
    expect(s.xp).toBe(20)
  })
  it('el nivel 100 es el máximo: no sube más y la barra queda llena', () => {
    const s = addXp(at(99, 490), 30, 'Ya nos vimos')
    expect(s.users.me?.level).toBe(100)
    expect(s.xp).toBe(s.xpGoal)
    const again = addXp(s, 500, 'Más XP')
    expect(again.users.me?.level).toBe(100)
    expect(again.xp).toBe(again.xpGoal)
  })
  it('restar XP nunca baja de nivel ni de 0', () => {
    const s = addXp(at(7, 10), -50, 'Cancelaste tarde')
    expect(s.users.me?.level).toBe(7)
    expect(s.xp).toBe(0)
  })
})

describe('descripción del perfil', () => {
  it('guarda y quita la descripción', () => {
    let s = reducer(fresh(), { type: 'setBio', bio: 'Hola, soy Alan.' })
    expect(s.users.me?.bio).toBe('Hola, soy Alan.')
    s = reducer(s, { type: 'setBio', bio: '' })
    expect(s.users.me?.bio).toBeUndefined()
  })
})

describe('historial y racha', () => {
  it('la racha inicial sale del historial: 4 semanas seguidas', () => {
    const s = fresh()
    expect(s.users.me?.streakWeeks).toBe(4)
    expect(s.history.length).toBeGreaterThanOrEqual(5)
  })
  it('un "Ya nos vimos" entre los dos agrega el plan al historial y suma una semana de racha', () => {
    let s = fresh()
    const plan = s.plans.find((p) => p.id === 'plan-sofi')!
    const match = { id: 'match-plan-sofi', planId: plan.id, friendId: 'sofi', createdAt: new Date().toISOString(), togetherAt: null, meetPoint: plan.place.name, quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false }
    s = reducer(s, { type: 'jalo', plan, match })
    const before = s.history.length
    s = reducer(s, { type: 'confirmMeet', matchId: match.id, who: 'me' })
    expect(s.history).toHaveLength(before) // solo con ambos
    s = reducer(s, { type: 'confirmMeet', matchId: match.id, who: 'them' })
    expect(s.history).toHaveLength(before + 1)
    expect(s.history.at(-1)).toMatchObject({ kind: 'plan', title: plan.line, attendeeIds: ['sofi'] })
    expect(s.users.me?.streakWeeks).toBe(5)
    // Confirmar de nuevo no duplica.
    const again = reducer(s, { type: 'confirmMeet', matchId: match.id, who: 'them' })
    expect(again.history).toHaveLength(before + 1)
  })
})

describe('rango, un plan a la vez, invitaciones y unirse en curso', () => {
  const jaloAction = (s: ReturnType<typeof fresh>, planId: string) => {
    const plan = s.plans.find((p) => p.id === planId)!
    const match = { id: `m-${planId}`, planId, friendId: plan.authorId, createdAt: new Date().toISOString(), togetherAt: null, meetPoint: plan.place.name, quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false }
    return reducer(s, { type: 'jalo', plan, match })
  }
  it('el rango por defecto es 5 km y se puede cambiar', () => {
    expect(fresh().radiusM).toBe(5000)
    expect(reducer(fresh(), { type: 'setRadius', radiusM: 25000 }).radiusM).toBe(25000)
  })
  it('un plan EN CURSO que no admite más gente no se puede jalar (el de Dani); uno que sí, sí', () => {
    const s = fresh()
    expect(s.plans.find((p) => p.id === 'plan-dani')?.lateJoin).toBe(false)
    expect(jaloAction(s, 'plan-dani').matches).toHaveLength(0)
    expect(jaloAction(s, 'plan-sofi').matches).toHaveLength(1)
  })
  it('solo un plan a la vez: no puedes jalar uno que se traslapa con otro al que ya vas', () => {
    let s = jaloAction(fresh(), 'plan-sofi') // en curso (-20 a +40 min)
    s = jaloAction(s, 'plan-karla') // +20 a +80 min: se traslapa
    expect(s.matches.map((m) => m.planId)).toEqual(['plan-sofi'])
    s = jaloAction(s, 'plan-mau') // +60 a +180: ya no se traslapa
    expect(s.matches.map((m) => m.planId)).toEqual(['plan-sofi', 'plan-mau'])
  })
  it('no puedes añadir un plan tuyo que se traslape con uno al que vas', () => {
    const s = jaloAction(fresh(), 'plan-sofi')
    const now = Date.now()
    const mine = { ...s.plans[0]!, id: 'mio', authorId: 'me', startsAt: new Date(now).toISOString(), durationMin: 60, expiresAt: new Date(now + 3_600_000).toISOString() }
    expect(reducer(s, { type: 'addPlan', plan: mine }).plans.some((p) => p.id === 'mio')).toBe(false)
  })
  it('editar la hora de tu plan no puede chocar con otro compromiso', () => {
    let s = fresh()
    const now = Date.now()
    const at = (m: number) => new Date(now + m * 60_000).toISOString()
    const base = { ...s.plans[0]!, authorId: 'me', durationMin: 30 }
    s = reducer(s, { type: 'addPlan', plan: { ...base, id: 'a', startsAt: at(300), expiresAt: at(330) } })
    s = reducer(s, { type: 'addPlan', plan: { ...base, id: 'b', startsAt: at(400), expiresAt: at(430) } })
    expect(s.plans.filter((p) => p.authorId === 'me').map((p) => p.id).sort()).toEqual(['a', 'b'])
    expect(reducer(s, { type: 'updatePlan', id: 'b', startsAt: at(310), durationMin: 30 }).plans.find((p) => p.id === 'b')?.startsAt).toBe(at(400)) // choca con "a": no cambia
    expect(reducer(s, { type: 'updatePlan', id: 'b', startsAt: at(500), durationMin: 30 }).plans.find((p) => p.id === 'b')?.startsAt).toBe(at(500))
  })
  it('un evento que no admite gente en curso y un plan terminado no se pueden unir', () => {
    const s = fresh()
    const ended = { ...s.plans.find((p) => p.id === 'plan-sofi')!, id: 'viejo', startsAt: new Date(Date.now() - 7_200_000).toISOString(), durationMin: 30, expiresAt: new Date(Date.now() - 5_400_000).toISOString() }
    const s2 = { ...s, plans: [ended, ...s.plans] }
    expect(jaloAction(s2, 'viejo').matches).toHaveLength(0)
  })
  it('invitaciones: las del seed son 3 pendientes para mí; si alguien acepta la mía, suma a quienes van', () => {
    const s = fresh()
    expect(s.invites.filter((i) => i.toId === 'me' && i.status === 'pending')).toHaveLength(3)
    const mine = { id: 'inv-x', kind: 'plan' as const, targetId: 'plan-sofi', title: 'x', fromId: 'me', toId: 'nico', status: 'pending' as const, at: new Date().toISOString() }
    let s2 = reducer(s, { type: 'invites', list: [mine] })
    const before = s2.plans.find((p) => p.id === 'plan-sofi')!.joinedCount
    s2 = reducer(s2, { type: 'inviteStatus', id: 'inv-x', status: 'accepted' })
    expect(s2.plans.find((p) => p.id === 'plan-sofi')!.joinedCount).toBe(before + 1)
    // Una respuesta ya dada no se repite (no suma dos veces).
    expect(reducer(s2, { type: 'inviteStatus', id: 'inv-x', status: 'accepted' })).toBe(s2)
  })
  it('si rechazan mi invitación, no suman; y responder una recibida no suma a mi plan', () => {
    const s = fresh()
    const before = s.plans.find((p) => p.id === 'plan-mau')!.joinedCount
    const declined = reducer(s, { type: 'inviteStatus', id: 'inv-mau', status: 'declined' })
    expect(declined.invites.find((i) => i.id === 'inv-mau')?.status).toBe('declined')
    expect(declined.plans.find((p) => p.id === 'plan-mau')!.joinedCount).toBe(before)
  })
})

describe('G1: ubicación aproximada, disponibilidad y radio de visibilidad', () => {
  it('mi ubicación es una celda redondeada y elegirla en el mapa la redondea', () => {
    const s = fresh()
    expect(s.location.center.lat).toBeCloseTo(Math.round(s.location.center.lat / 0.002) * 0.002, 4)
    const next = reducer(s, { type: 'setLocation', status: 'manual', center: { lat: 20.67513, lng: -103.36487 } })
    expect(next.location.status).toBe('manual')
    expect(Math.abs(next.location.center.lat / 0.002 - Math.round(next.location.center.lat / 0.002))).toBeLessThan(1e-6)
  })
  it('sin centro nuevo se conserva el anterior', () => {
    const s = fresh()
    expect(reducer(s, { type: 'setLocation', status: 'denied' }).location.center).toEqual(s.location.center)
  })
  it('la disponibilidad es opcional y no cambia quién ve tu ubicación', () => {
    const s = fresh()
    expect(s.users.me?.availability).toBeUndefined()
    const busy = reducer(s, { type: 'setAvailability', availability: 'busy' })
    expect(busy.users.me?.availability).toBe('busy')
    expect(locationViewers(busy)).toEqual(locationViewers(s))
    expect(reducer(busy, { type: 'setAvailability', availability: null }).users.me?.availability).toBeUndefined()
  })
  it('el radio de visibilidad de cercanos es de 3 km y se puede cambiar', () => {
    expect(fresh().visibilityRadiusM).toBe(3000)
    expect(reducer(fresh(), { type: 'setVisibilityRadius', radiusM: 1000 }).visibilityRadiusM).toBe(1000)
  })
})

describe('G1: planes sin zonas', () => {
  it('todo plan del seed tiene lugar exacto y ninguno trae zona', () => {
    for (const p of fresh().plans) {
      expect(p.place.name.length).toBeGreaterThan(0)
      expect(Object.keys(p)).not.toContain('zone')
    }
  })
  it('Karla no es amiga: su plan solo llega por la invitación de un amigo (invitado, fuera del mapa)', () => {
    const s = fresh()
    expect(s.friendships.karla?.status).toBe('none')
    const inv = s.invites.find((i) => i.targetId === 'plan-karla')
    expect(inv).toMatchObject({ fromId: 'mau', toId: 'me', status: 'pending' })
    expect(s.plans.find((p) => p.id === 'plan-karla')?.joinPolicy).toBe('friends_and_guests')
  })
  it('un plan lleno no admite a nadie más', () => {
    const s = fresh()
    const dani = s.plans.find((p) => p.id === 'plan-dani')!
    expect(dani.capacity).toBe(4)
    const lleno = { ...s, plans: s.plans.map((p) => (p.id === 'plan-sofi' ? { ...p, capacity: 2, joinedCount: 2 } : p)) }
    const match = { id: 'm', planId: 'plan-sofi', friendId: 'sofi', createdAt: '', togetherAt: null, meetPoint: 'x', quickMessage: null, myConfirmed: false, theirConfirmed: false, rewarded: false }
    expect(reducer(lleno, { type: 'jalo', plan: lleno.plans.find((p) => p.id === 'plan-sofi')!, match }).matches).toHaveLength(0)
  })
})
