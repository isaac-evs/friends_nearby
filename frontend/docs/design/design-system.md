# Design system — ¿Jalas? (Nearby Friends)

Estilo **moderno y limpio con toques divertidos**: fondo gris muy claro, tarjetas blancas con sombras suaves, un solo color de acción (índigo) y un acento cálido (naranja) para lo "social": racha, XP, eventos. La diversión viene de los pasteles por categoría, los títulos con mucho peso y el swipe, **no** de rotaciones, contornos gruesos ni emojis.

Tokens: `tokens.json` (fuente de verdad) → `theme.css` (Tailwind v4 `@theme`).
Referencia visual: `screens/*.dc.html` (abrirlas como HTML de referencia; dependen de un runtime del lienzo, **no** son código para copiar).

---

## 1. Principios

1. **Mobile first.** Se diseña a 390 px y escala a desktop (sidebar + mapa + panel).
2. **Una acción primaria por pantalla.** Índigo (`primary`) solo para la acción principal y la selección activa.
3. **Privacidad visible.** Toda ubicación aproximada se dibuja como zona (círculo punteado). La exacta solo aparece con match y con una etiqueta que lo dice.
4. **Jerarquía tipográfica clara.** 800 solo en títulos (≥ 17 px); labels en 700; texto y meta en 500.
5. **Accesible por defecto.** Contraste AA, objetivos táctiles ≥ 44 px, `aria-pressed` en chips y toggles, el mapa siempre con una lista equivalente.

## 2. Color

| Rol | Token | Uso |
|---|---|---|
| Fondo | `bg` #F6F6F8 | Fondo de app |
| Superficie | `surface` #FFF | Tarjetas, sheets, tab bar |
| Superficie hundida | `surface-sunken` #ECECF0 | Pista de segmented control |
| Texto principal | `ink` #111114 | Títulos y labels |
| Texto | `text` #34343C | Párrafos y meta importante |
| Secundario | `muted` #5B5B66 | Meta y captions (AA sobre `bg` y `surface`) |
| Primario | `primary` #3D3BD4 | CTA principal (Jalo, Publicar), selección, foco |
| Primario suave | `primary-soft` #E3DFFF | Chip seleccionado, fila activa |
| Acento | `accent` #FF7A45 | Indicadores (punto "Abierto"), pin de evento |
| Acento suave/texto | `accent-soft` / `accent-text` | Chips de racha y XP (texto `accent-text` sobre `accent-soft` o blanco) |
| Peligro | `danger` #C43D1B | "Paso", reportar |
| Éxito | `success` #2BB673 | Barra de cupo, "en línea" |

**Reglas:** el texto blanco solo va sobre `primary` o `ink`. Los pasteles de categoría siempre llevan ícono y texto `ink`. `accent` nunca se usa como color de texto pequeño (no pasa AA); para texto usa `accent-text`.

**Categorías:** café `#FFE1CF`, correr `#FFD3BF`, deporte `#D6EBFF`, estudiar/social `#E3DFFF`, comer `#FFEDB8`, música `#CDEFDF`, clase `#FFDDE8`, otro `#ECECF0`. Los avatares toman uno de `color.avatar` con un hash estable del `userId`.

## 3. Tipografía — Plus Jakarta Sans

| Estilo | Tamaño/peso | Uso |
|---|---|---|
| display | 36 / 800 / -1.2 | Hero de login |
| h1 | 28 / 800 / -0.8 | Título de pantalla |
| h2 | 22 / 800 / -0.5 | Título de card |
| h3 | 17 / 800 / -0.3 | Títulos de sección y preview |
| body | 16 / 500 | Inputs y párrafos |
| label | 14 / 700 | Botones, legends, nombres |
| meta | 13 / 500 | Cuándo, dónde, distancia |
| caption | 12 / 600 | Chips y pills |
| overline | 10 / 700 / +1.2 / MAYÚS | Mes en DateBadge |

Los inputs van a 16 px para evitar el zoom en iOS.

## 4. Forma, espacio y elevación

- Radios: `sm` 10, `md` 14 (inputs), `lg` 16 (botones cuadrados), `xl` 22 (tab bar, sheets), `card` 26 y `pill` 999 (chips y CTA de texto).
- Espaciado base de 4 px. Padding de pantalla de 20 px (móvil) y gaps de 10–14 px entre bloques.
- Sombras: `md` para elementos flotantes, `card` para la card del swipe, `lg` para la tab bar y `primary` solo en el botón Jalo.
- Bordes: 1 px `line` (rgba 8%). Los inputs usan `line-input`. Los estados vacíos usan borde punteado `line-dashed`.

## 5. Componentes

### AppShell
- **Móvil:** el contenido con padding y la **TabBar flotante** abajo (inset 12 px, alto 68, `xl`, `shadow-lg`).
- **Desktop (≥ 1024 px):** sidebar (220 px) + mapa (flex) + panel derecho (360 px). En pantallas angostas el panel y la sidebar se apilan.

### TabBar
5 items: Explorar · Mapa · **+** (Publicar, cuadrado 50 px en `ink` con ícono blanco) · Amigos · Perfil. El item activo va en `primary` peso 700 con `aria-current="page"`, los inactivos en `muted` 600.

### Button
| Variante | Estilo |
|---|---|
| primary | `bg-primary text-white`, pill o `lg`, alto 50–54 |
| dark | `bg-ink text-white` (Entrar, Crear) |
| secondary | `bg-surface border-line-input text-ink` |
| ghost/link | texto `primary` 700 |
| icon | círculo de 44 px, `surface`, `shadow-sm` |

Estados: hover (`primary-hover`), foco (anillo `primary` de 2 px), disabled (`surface-sunken` + `muted`), loading (spinner, mantiene el ancho).

### SegmentedControl
Pista `surface-sunken` con padding de 4 y radio 14. La opción activa es `surface` + `shadow-xs` + `ink`; las inactivas, transparentes + `muted`. Se usa en Amigos/Abierto, Plan/Evento y Quién puede unirse.

### Chip / FilterChip
Alto 34, pill, 13/600. Inactivo: `surface` + borde `line`. Activo: `primary-soft` + borde `primary` + texto `primary-hover`. El chip "Crear" usa la variante `dark`.

### SwipeCard
- Contenedor de 410 de alto, radio `card`, `shadow-card`, con dos capas detrás (`#EEEEF2` y `#E6E6EC`) desplazadas 7 y 14 px.
- **Variante amigo:** tile de 170 px en color de categoría, pills de categoría y tiempo restante, XP abajo a la derecha. En el cuerpo van el avatar, el nombre, la zona aproximada, el título h2 y un chip de "N ya jalaron".
- **Variante evento:** tile de 150 px con **DateBadge** abajo a la izquierda. En el cuerpo van "Organizador · verificado" (con insignia), el título h2 y 3 filas de meta con ícono (cuándo, dónde, cupo con barra `success`).
- **Acciones:** Paso (60 px, `danger`), Luego (48 px, `primary`) y Jalo / Me uno (72 px, `primary` + `shadow-primary`).
- **Gestos:** → jalar, ← pasar (no notifica), ↑ guardar. Teclado: ← → ↓. Respeta `prefers-reduced-motion`.

### DateBadge
54×58, `surface`, radio 14, `shadow-sm`. Día en 22/800 y mes en overline `accent-text`.

### Avatar
Círculo de 34, 40, 44 o 48 px con iniciales 700 sobre el color de avatar. El indicador "en línea" es un punto `success` de 12 px.

### Toggle (switch)
50×30 con perilla blanca. Encendido en `primary`, apagado en `#D5D5DD`. Lleva `role="switch"`, `aria-checked` y un área táctil de 56×44.

### BottomSheet
`surface`, radio `xl`, `shadow-lg`. En el mapa flota sobre la tab bar y muestra la persona o el evento seleccionado con dos acciones.

### MapMarker
- **Amigo con zona aproximada:** avatar de 48 px con anillo blanco de 3 px y un círculo de zona (`zone-fill` + borde punteado `primary`).
- **Amigo con match:** sin círculo de zona y con la pill `primary` "Categoría · match".
- **Evento:** cuadrado de 52 px en `accent` con ícono y la pill "Nombre · N".
- **Tú:** punto `primary` de 20 px con borde blanco y halo.
- **Seleccionado:** el anillo cambia de blanco a `primary`.

### Notice (banner informativo)
Fondo pastel (mint para seguridad, lila para privacidad), radio 14, ícono de 20 px + texto 12–13/500.

### EmptyState
Tarjeta `surface` con borde punteado, ícono en un cuadro `primary-soft`, h2, texto `muted` y un CTA `dark`.

## 6. Iconografía
Íconos de línea con trazo de 2 px y esquinas redondeadas (estilo Lucide). En React se recomienda `lucide-react`; los paths de las pantallas son equivalentes. Nunca usar emojis como íconos.

## 7. Contenido y tono
- Cercano y mexicano, sin exagerar: "¿Quién jala hoy?", "Jalo", "¡Se armó!", "Tu banda".
- La privacidad siempre en positivo y concreta: "Gente nueva solo ve tu nombre, nunca tu ubicación."
- Distancias siempre aproximadas ("a ~800 m") salvo con match.

## 8. Mapa de pantallas → archivo de referencia

| # | Pantalla | Archivo |
|---|---|---|
| 1 | Entrar | `screens/Main.dc.html` |
| 2 | Permiso de ubicación | `screens/Permiso.dc.html` |
| 3 | Explorar (amigos / abierto + filtros) | `screens/Feed.dc.html` |
| 4 | Mapa de amigos y eventos | `screens/Mapa.dc.html` |
| 5 | ¡Se armó! (match) | `screens/Match.dc.html` |
| 6 | Publicar plan rápido | `screens/Publicar.dc.html` |
| 7 | Amigos | `screens/Amigos.dc.html` |
| 8 | Mi perfil | `screens/Perfil.dc.html` |
| 9 | Modo abierto (consentimiento) | `screens/Abierto.dc.html` |
| 10 | Detalle de evento | `screens/Evento.dc.html` |
| 11 | Perfil de otra persona | `screens/PerfilOtro.dc.html` |
| 12 | Crear evento | `screens/CrearEvento.dc.html` |
| D | Desktop: explorar + mapa | `screens/Desktop.dc.html` |
