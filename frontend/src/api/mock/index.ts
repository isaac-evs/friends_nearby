import { Event, Friendship, Plan, User } from '../schemas'
import { SEED_EVENTS, SEED_FRIENDSHIPS, SEED_PLANS, SEED_USERS } from './seed'
import { z } from 'zod'

/** Valida el seed contra los contratos: si el mock se desvía, falla al arrancar. */
export const users = z.array(User).parse(SEED_USERS)
export const friendships = z.array(Friendship).parse(SEED_FRIENDSHIPS)
export const plans = z.array(Plan).parse(SEED_PLANS)
export const events = z.array(Event).parse(SEED_EVENTS)
export { SEED_ATTENDEES, SEED_BADGES, ZONES, ME_ID } from './seed'
