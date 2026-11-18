import { useState, type ReactNode } from 'react'
import { Coffee, MapPin } from 'lucide-react'
import {
  Avatar, AvatarStack, BottomSheet, Button, CardBody, Chip, ChipLink, DateBadge, EmptyState, EventMarker, Field, FriendMarker, IconButton,
  Logo, MeMarker, Notice, Pill, ProgressBar, SegmentedControl, SwipeActions, SwipeStack, Toggle, useToast,
} from '@/design'
import { Plus } from 'lucide-react'

/** `/dev/ui`: catálogo de componentes del design system con sus estados. */
export function DevUi() {
  const toast = useToast()
  const [seg, setSeg] = useState<'a' | 'b'>('a')
  const [chip, setChip] = useState(true)
  const [tg, setTg] = useState(true)
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-10 px-5 py-8">
      <header className="flex items-center justify-between"><Logo /><h1 className="text-h1 font-extrabold">Design system</h1></header>

      <Sec title="Button">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button><Button variant="dark">Dark</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button>
          <Button variant="accent">Accent</Button><Button disabled>Disabled</Button><Button loading>Loading</Button><Button pill size="lg">Pill lg</Button>
          <IconButton label="Ícono"><Plus aria-hidden="true" size={20} /></IconButton>
        </div>
      </Sec>
      <Sec title="SegmentedControl · Chip · Pill · Toggle">
        <SegmentedControl label="Demo" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Mis amigos' }, { value: 'b', label: 'Abierto' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={chip} onClick={() => setChip((v) => !v)}>Deporte</Chip><Chip selected={false}>Social</Chip><ChipLink to="/dev/ui"><Plus aria-hidden="true" size={14} />Crear</ChipLink>
          <Pill>Aprox.</Pill><Pill tone="accent">+20 XP</Pill><Pill tone="primary">match</Pill><Pill tone="muted">Muted</Pill>
          <Toggle checked={tg} onChange={setTg} label="Demo toggle" /><Toggle checked={false} onChange={() => {}} label="Toggle apagado" />
        </div>
      </Sec>
      <Sec title="Avatar · DateBadge · ProgressBar · Field">
        <div className="flex flex-wrap items-center gap-4">
          {[34, 40, 44, 48].map((s) => <Avatar key={s} userId="sofi" name="Sofi" size={s as 34} />)}
          <Avatar userId="mau" name="Mau" online /><Avatar userId="leo" name="Leo" paused /><AvatarStack people={[{ id: 'sofi', name: 'Sofi' }, { id: 'mau', name: 'Mau' }, { id: 'dani', name: 'Dani' }]} />
          <DateBadge day="21" month="NOV" />
        </div>
        <ProgressBar value={68} label="Progreso demo" />
        <Field label="Correo" placeholder="tu@correo.com" /><Field label="Con error" defaultValue="mal" error="Revisa tu correo." />
      </Sec>
      <Sec title="Notice · EmptyState">
        <Notice tone="safety" icon="shield">Seguridad: lugar público y tú apruebas.</Notice>
        <Notice tone="privacy" icon="eye">Privacidad: gente nueva solo ve tu nombre.</Notice>
        <EmptyState icon={<MapPin aria-hidden="true" size={30} />} title="Estado vacío" text="Texto de apoyo en muted."><Button variant="dark" pill>CTA</Button></EmptyState>
      </Sec>
      <Sec title="SwipeCard (amigo y evento) + acciones">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <SwipeStack ariaLabel="Demo" onSwipe={(d) => toast(`Swipe ${d}`)}>
              <CardBody variant="friend" tileClass="bg-cat-cafe" icon={<Coffee aria-hidden="true" size={72} strokeWidth={1.5} />} category="Café" time="quedan 40 min" xp="+20 XP" person={{ id: 'sofi', name: 'Sofi' }} where="a ~800 m · Providencia" title="Por un café en Providencia, ¿alguien?" chip="2 ya jalaron" />
            </SwipeStack>
          </div>
          <div>
            <SwipeStack ariaLabel="Demo evento" onSwipe={(d) => toast(`Swipe ${d}`)}>
              <CardBody variant="event" tileClass="bg-cat-correr" icon={<Coffee aria-hidden="true" size={72} strokeWidth={1.5} />} category="Deporte · Correr" xp="+50 XP" organizer="Club de corredores" verified title="Social Run 5K en Colomos" day="21" month="NOV" when="Sábado · 7:00 am" place="Bosque Los Colomos · ~3 km" going={34} capacity={50} />
            </SwipeStack>
          </div>
        </div>
        <SwipeActions joinLabel="Jalo" onPass={() => toast('Paso')} onLater={() => toast('Luego')} onJoin={() => toast('Jalo')} />
      </Sec>
      <Sec title="MapMarker · BottomSheet">
        <div className="relative flex h-60 items-center justify-around overflow-hidden rounded-lg bg-map-land px-4">
          <span aria-hidden="true" className="absolute top-8 left-6 size-[120px] rounded-full border-2 border-dashed border-primary bg-zone-fill" />
          <FriendMarker person={{ id: 'dani', name: 'Dani' }} label="Comer" description="Dani: zona aproximada" onSelect={() => {}} />
          <FriendMarker person={{ id: 'sofi', name: 'Sofi' }} label="Café" exact selected description="Sofi: ubicación exacta por match" onSelect={() => {}} />
          <EventMarker icon={<Coffee aria-hidden="true" size={26} />} label="Social Run · 34" description="evento público" onSelect={() => {}} />
          <MeMarker />
        </div>
        <BottomSheet label="Demo sheet"><p className="text-sm font-bold">Sofi · Café</p><p className="text-meta text-muted">Av. Providencia · en vivo</p></BottomSheet>
      </Sec>
    </main>
  )
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3"><h2 className="text-h3 font-extrabold">{title}</h2>{children}</section>
}
