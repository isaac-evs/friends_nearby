# ¿Jalas? — Especificación de producto y plan técnico

> **Documento único.** Reemplaza a `plan-fase2.md` y `nearby-friends.md` (borrados). `brief-mvp.md` queda como
> **histórico** del MVP; donde choque con este documento, **manda este**. El sistema visual sigue en
> `docs/design/` (tokens, design system y mockups `.dc.html`).
>
> Etiquetas: **[HECHO]** ya existe en el frontend · **[CAMBIA]** existe pero se rediseña · **[NUEVO]** · **[QUITAR]** ·
> **[PROPUESTA]** endpoint o tabla que `infra/` todavía no tiene (no existe hasta que backend lo construya).

---

## 0. Reglas de trabajo

1. **Sin "evidence".** No hay capturas ni carpeta `docs/evidence/`; Alan revisa la UI. Sí se mantienen las pruebas
   automáticas (Vitest, Playwright E2E en iPhone/Pixel/desktop y axe sin violaciones).
2. **Sin datos hardcodeados en las pantallas.** Toda pantalla lee de un **cliente de API** (`src/api/client.ts`,
   [NUEVO]) con la misma forma que tendrá el backend. Los mocks viven **solo** en `src/api/mock/`, detrás de ese cliente,
   marcados con `// MOCK:` y validados con Zod. Cambiar a backend real = cambiar la implementación del cliente, no las
   pantallas.
3. **El backend busca y devuelve todo**: planes, eventos, amigos, ubicaciones, lugares, notificaciones. El frontend no
   calcula quién puede ver qué; solo lo pinta (el cálculo local del mock es un espejo de la regla del servidor).
4. Cada bloque (§9) termina con pruebas en verde y **se detiene a esperar confirmación**.

### Lo que hoy está hardcodeado y se va
| Hoy | Problema | Reemplazo |
|---|---|---|
| `api/mock/geocode.ts` → `ZONE_CATALOG`, `reverseZone`, `zoneOrigin` | Zonas fijas inventadas | **[QUITAR]** Ubicación aproximada = celda redondeada que devuelve el servidor (§2.1) |
| `api/mock/places.ts` → `PUBLIC_PLACES` | Lugares de mentira | `GET /places/autocomplete` y `GET /places/{id}` [PROPUESTA] (§6.1) |
| `api/mock/seed.ts` (usuarios, planes, eventos, invitaciones, historial) | Se leen directo en el store | Siguen como datos de **mock**, pero solo accesibles vía `api/client.ts` |
| `MOCK_REPLY_MS`, `MOCK_NEVER_ANSWERS` | Simulan a otras personas | Se quedan **solo** en el mock; en real llegan por WebSocket |
| `lib/privacy.ts` → `zoneLineText`, `zoneViewers` | Texto de zona y "Te ven N" | **[QUITAR]** / se mueve a Configuración |

---

## 1. Premisa: Nearby Friends

**Ver dónde andan tus amigos cercanos, de forma privada y controlada, para convertir esa cercanía en planes reales.**

Dos atributos **independientes**:
- **Cercano (Nearby):** estoy físicamente cerca. Lo calcula el sistema con tu ubicación aproximada.
- **Disponible (Available):** tengo intención de hacer algo. Lo eliges tú.

Juan puede estar a 300 m y no querer salir; María puede estar a 2 km y buscar gente para pádel. La app nunca deduce
disponibilidad por cercanía ni al revés.

**Estados de disponibilidad** [NUEVO] (opcionales; **no** cambian permisos de ubicación):
`Disponible para planes` · `Ocupado` · `Solo explorando` · `No molestar` (sin estado = no se muestra nada).
Si la persona está en un plan en curso se muestra **qué está haciendo**: "De fiesta", "Corriendo", "En un café"… (sale
de la categoría del plan, no de su ubicación). `No molestar` silencia invitaciones y avisos de cercanía hacia esa persona.

### Las tres capas del mapa
| Capa | Se dibuja como | Ubicación | Quién la ve |
|---|---|---|---|
| **Amigos cercanos** | Avatar circular **solo con foto** (sin nombre) + puntito de disponibilidad | **Aproximada** | Solo amigos cercanos **mutuos** que comparten contigo, dentro de su radio de visibilidad |
| **Planes** | Marcador con el ícono de la actividad | **Exacta del lugar del plan** (punto de encuentro, no la casa de nadie) | Amigos de quien organiza + quien ya esté dentro del plan |
| **Eventos** | Marcador de evento (forma distinta) | **Exacta del lugar del evento** | Según audiencia; los abiertos requieren modo abierto |

---

## 2. Privacidad: quién ve qué y cuándo

| Dato | Quién | Cuándo | Precisión |
|---|---|---|---|
| Tu ubicación | Tus **amigos cercanos mutuos** | Siempre que no estés en fantasma y estén dentro de tu **radio de visibilidad** | Aproximada (celda ~300 m) y distancia en rangos ("a menos de 500 m") |
| Tu ubicación exacta temporal [HECHO] | El amigo cercano con quien la compartes | 30 min / 1 h / 2 h, se apaga sola | Exacta |
| Tu distancia al lugar de un plan | Integrantes de **ese** plan | De **10 min antes** del inicio hasta que haces check-in o el plan termina | Distancia redondeada a 50 m + "hace cuánto"; **nunca coordenadas** |
| Lugar de un plan / evento | Quien puede ver el plan / evento | Mientras no termine o se cancele | Exacta (es un lugar, no una persona) |
| Que llegaste (check-in) | Integrantes del plan | Desde que lo haces | Sí/no + hora; no se guarda el punto |
| Un amigo normal (no cercano) | — | Nunca ve tu ubicación; sí ve tus planes | — |
| Un no-amigo (invitado de un amigo) | Te ve solo **dentro del plan** (nombre, foto, distancia al lugar en los 10 min) | Solo ese plan | No aparece en tu mapa, ni tú en el suyo |

Reglas duras (servidor):
- **Fantasma** oculta tu ubicación a todos (también a cercanos), corta las ubicaciones exactas compartidas y **no**
  pausa tu participación en planes (en el lobby de 10 min se muestra "Ubicación oculta" en lugar de tu distancia).
  Tú sigues viendo tu propio punto y el mapa.
- Ubicación **nunca** en analítica, logs, URLs ni notificaciones push (las push dicen "Mau está cerca", no dónde).
- Anti-triangulación: el servidor calcula distancias **desde la celda redondeada**, no desde el punto real, y limita
  consultas por usuario. Así no se puede averiguar el punto exacto moviéndose y comparando distancias.
- **Radio de visibilidad** [NUEVO] (Configuración, por defecto **3 km**; 500 m · 1 km · 3 km · 5 km · 10 km): qué tan lejos
  pueden estar tus cercanos para verte en su mapa. Es distinto del **rango de búsqueda** de Explorar (planes/eventos).

### 2.1 Ubicación aproximada (sin zonas)
- **[QUITAR] zonas y colonias** de toda la app.
- El cliente manda su coordenada solo por WebSocket; el servidor la **redondea a una celda** (geohash de 7 caracteres,
  ~150 m, publicada con un margen de ±300 m) y guarda eso con TTL. Nunca se guarda la coordenada cruda.
- En Amigos cercanos, "Tu zona" pasa a **"Tu ubicación aproximada"**: mini-mapa con un círculo difuso y el texto
  "Tus cercanos te ven en esta área (±300 m)". Sin nombre de barrio.

> **Conflicto pendiente con `CLAUDE.md`:** la regla "nunca coordenadas exactas fuera de un match activo" ya no
> describe el producto. Texto propuesto: *"Nunca coordenadas exactas de una persona salvo que ella las comparta por un
> rato con un amigo cercano; los planes y eventos sí tienen lugar exacto porque es un punto de encuentro; nadie que no
> sea tu amigo cercano ve tu ubicación; nada de ubicación en analítica/logs."* Y la línea de evidencia pasaría a
> *"captura → no; pruebas E2E y axe sí"*. **Falta tu OK para editar `CLAUDE.md`.**

---

## 3. Navegación y layout

### Mobile (390 px)
- Barra inferior: Explorar · Amigos · **+ Publicar** · Mis planes · **Perfil = círculo con tu foto** [CAMBIA]
  (con `aria-label="Perfil"` y `aria-current` en la pestaña activa).
- Notificaciones: campana **más grande** (44 × 44 de objetivo, ícono 24 px) arriba a la derecha de Explorar con badge.
- Guardados: desde Explorar (ícono marcador) y desde Mis planes.

### Desktop (≥ 1024 px)
- **Columna izquierda, más limpia** [CAMBIA]: logo · Explorar · Amigos · Notificaciones (con badge) · Guardados ·
  Mis planes · abajo **tu avatar** → Perfil. **[QUITAR]** la tarjeta "Tu plan está activo" y el banner de la izquierda.
- **Centro:** mapa / lista.
- **Panel derecho** [CAMBIA]: arriba **"Mi plan activo"** (tarjeta clicable: foto, título, hora, "3 van · 1 ya llegó");
  al abrirla, vista de organizador (§4.7). Debajo, **"¿Qué plan hoy?"** con el conteo y la lista de planes cercanos.

### Perfil
- Arriba: portada integrada a la foto, nombre, @usuario, racha 🔥, "Nivel N".
- Junto a **Editar perfil**, un **menú hamburguesa** [CAMBIA] (reemplaza "Ajustes"): Modo fantasma · Amigos cercanos ·
  Modo abierto · Radio de visibilidad · Disponibilidad · Quién te ve · Notificaciones · Historial de ubicaciones ·
  Cuenta (usuario, contraseña) · Cerrar sesión. En mobile es una hoja inferior; en desktop un menú desplegable.
- "Te ven 3 cercanos" **[QUITAR]** del mapa → vive aquí como **"Quién te ve"**.

---

## 4. Flujos

Formato por flujo: **Objetivo · Pantallas · Estados · Reglas · Datos/endpoints**. Las mejoras de UX/UI van juntas en §12.

### 4.1 Mapa y capas
- **Objetivo:** de un vistazo, quién de tus cercanos anda cerca y qué planes/eventos hay.
- **Pantallas:** Explorar › Mapa (mobile y centro en desktop), hoja de selección, panel de grupo.
- **Estados:** cargando (esqueleto del mapa + chips deshabilitados) · sin permiso de ubicación (mapa centrado en tu
  ciudad + botón "Activar ubicación"; los planes se siguen viendo por distancia al último punto aproximado) · sin
  WebGL (aviso + vista lista) · vacío ("Nadie cerca por ahora · Publica un plan") · error (banner "No pudimos
  actualizar · Reintentar", conserva lo último) · éxito.
- **Reglas:**
  - Amigos: solo cercanos mutuos que comparten y no están en fantasma. **Solo foto**, sin nombre; nombre en la tarjeta.
    Quien no comparte sigue en tu lista de amigos, no en el mapa. Los invitados no-amigos **nunca** salen.
  - Planes: marcador en el lugar exacto. **Próximo** (borde normal + hora "19:30") vs **en curso** (relleno + pulso
    suave + "En curso"). Terminados y cancelados **desaparecen**.
  - Eventos: marcador propio con hora de inicio–fin.
  - **Tocar un espacio vacío quita la selección** [NUEVO] (cierra la hoja y limpia `?sel`).
  - **Anti-saturación** [NUEVO]:
    1. *Clustering* de avatares: uno solo = su foto; varios juntos = pila de 2–3 fotos + "+N"; tocar → panel pequeño con
       las personas; al acercar el zoom se separan.
    2. *Por establecimiento*: varios planes/eventos en el mismo `placeId` = un marcador con contador; al tocarlo se
       listan.
    3. *Por zoom*: lejos → solo grupos con número · ciudad → individuales y grupos · calle → todo individual.
  - **Filtros (chips):** Todos · Amigos · Planes · Eventos (`aria-pressed`). Eventos solo aparece con modo abierto.
  - **Lista equivalente** siempre disponible (accesibilidad): mismo filtro y orden por distancia.
- **Tarjeta de amigo** (al tocar su avatar): foto, nombre, "Amigo cercano", distancia en rango ("a menos de 500 m"),
  "actualizado hace 12 min" si tiene > 5 min, disponibilidad, qué hace si está en un plan. Acciones:
  **[Invitar a plan]** (primaria si está *Disponible* y no tiene plan) · [Ver perfil] · [Unirme] si está en un plan
  en curso que admite gente.
- **Datos:** `GET /map?bbox&zoom&filters` [PROPUESTA] devuelve ya agrupado
  `{ friends:[{userId, avatarUrl, cell, distanceBucket, updatedAt, availability, activity?}], plans:[...], events:[...], clusters:[...] }`;
  actualizaciones en vivo por WS `location.update` / `plan.update`. Clustering en servidor para zoom bajo
  (Redis `GEOSEARCH` + agrupación por geohash) y en cliente (supercluster de MapLibre) para zoom alto.

### 4.2 Explorar — "¿Qué plan hoy?"
- **Objetivo:** responder en 2 segundos "¿hay algo que hacer hoy cerca de mí?".
- **Pantalla (encabezado)** [CAMBIA]:
  - Título **"¿Qué plan hoy?"** y subtítulo con conteos reales: **"4 amigos quieren hacer algo · 2 eventos hoy"**
    (planes = personas distintas con plan; eventos = solo de hoy). **[QUITAR]** el texto de zona.
  - **Selector de día:** Hoy · Mañana · fechas de los próximos 7 días (chips con scroll horizontal) → cambia los conteos.
  - Filtros Todos · Amigos · Planes · Eventos + conmutador **Mapa / Lista** (`aria-pressed`).
  - **Rango como slider** [CAMBIA] (1–25 km, pasos 1·3·5·10·25 con imán; `aria-valuetext="5 km"`); muestra
    "12 planes dentro de 5 km · 3 más lejos".
  - **Ojito de visibilidad** [CAMBIA]: activo = verde + "En vivo" (punto que late); inactivo = ojo tachado + "No te
    ven" y tu avatar apagado (gris). En ambos casos **tú ves tu ubicación y el mapa**. Tocarlo abre una hoja corta:
    estado, radio de visibilidad y "Ir a configuración".
  - Cartas (deck) [HECHO] siguen como modo de descubrimiento rápido debajo / en la pestaña Cartas.
- **Estados:** cargando (conteos con esqueleto, no "0") · vacío del día ("Hoy no hay planes cerca. Mañana hay 3 →") ·
  fuera de rango ("Hay 3 a más de 5 km · Ampliar a 10 km") · error.
- **Reglas:** el día filtra por `startsAt` (planes) o por solape del intervalo (eventos de varios días); "hoy" incluye
  lo en curso.
- **Datos:** `GET /feed?date=YYYY-MM-DD&radiusM&filter` → `{counts:{friendsWithPlans, plans, eventsToday}, items}`
  [PROPUESTA].

### 4.3 Visibilidad y disponibilidad
- **Objetivo:** que la persona sepa siempre si la están viendo y lo cambie en un toque.
- **Pantallas:** ojito (Explorar), menú del perfil › Modo fantasma / Radio de visibilidad / Disponibilidad / Quién te ve.
- **Estados:** en vivo · fantasma · pestaña oculta ("Pausado: la app no está abierta") · sin permiso del navegador.
- **Reglas:** fantasma no cambia disponibilidad ni planes; disponibilidad caduca sola a medianoche (opción "Hasta que
  lo cambie").
- **Datos:** `PUT /me/visibility {ghost, radiusM}`, `PUT /me/availability {status, until?}`, `GET /me/viewers`
  [PROPUESTA].

### 4.4 Crear plan
- **Objetivo:** publicar un plan real en < 30 s.
- **Pantalla (orden):**
  1. **Tipo** (obligatorio): café · comer · correr · gym · estudiar · chill · juegos · **fiesta** [CAMBIA: `antro` → `fiesta`].
  2. Qué (una línea, opcional; placeholder según el tipo).
  3. **Cuándo:** Ahora / hora de inicio + duración (los planes sí conservan duración; los eventos usan hora de fin).
  4. **Dónde (obligatorio)** [CAMBIA]: buscador de lugares reales (autocompletado) → resultado con nombre, dirección y
     mini-mapa. Si no existe: **"No lo encuentro"** → escribe el nombre y **coloca el pin en el mapa** [HECHO: picker].
     **[QUITAR]** zonas/colonias y "Tus 3 cercanos lo verán a 800 m".
  5. Foto del plan [HECHO].
  6. **Invitar amigos** [CAMBIA]: lista ordenada por cercanía con **"a 400 m · hace 3 min"** o **"hace 2 h"** si está
     desactualizado; disponibilidad visible; buscador.
  7. **Quién se puede unir** [CAMBIA, sustituye "Quién lo ve"]: *Tus amigos* (por defecto) · *Tus amigos y a quien
     inviten*. **[QUITAR]** la audiencia "amigos de amigos".
  8. ¿Se pueden unir ya empezado? (switch) [HECHO].
- **Estados:** validación en línea (lugar obligatorio con mensaje "Elige dónde es"), publicando (botón con spinner,
  no doble envío), choque con otro compromiso [HECHO], error de red (conserva el borrador), éxito → Mi plan activo.
- **Reglas:** **solo amigos lo ven** en Explorar/mapa. Un plan a la vez [HECHO]. Lugar = `placeId` + coordenada exacta
  del lugar; si es pin manual, `placeId=null` + nombre libre + moderación ligera (sin direcciones de casa: aviso
  "Elige un lugar público").
- **Datos:** `POST /plans` (§7.2), `GET /places/autocomplete?q&near`, `GET /places/{placeId}` [PROPUESTA].

### 4.5 Invitados de invitados
- Si el plan permite *"Tus amigos y a quien inviten"*, cualquier integrante puede invitar a **sus** amigos aunque no
  sean amigos de quien organiza (sin límite fijo; propuesta: tope de cupo del plan).
- El invitado **ve el plan solo por la invitación** (no le aparece en Explorar), entra con nombre y foto, y dentro del
  plan sale como "Invitado de Sofi".
- **No aparece en ningún mapa** y no ve ubicaciones de nadie fuera del lobby de 10 min (donde ve distancias al lugar,
  como todos).
- Quien organiza puede quitar a un invitado (sin penalización para el invitado).

### 4.6 Ver plan
- **Objetivo:** que se vea apetecible y deje claro dónde, cuándo y con quién.
- **Pantalla** [CAMBIA]: foto grande (o ilustración del tipo), título, chip de estado (**Próximo · En curso ·
  Terminado · Cancelado**), hora "Hoy 19:30–21:00" + cuenta regresiva, **lugar explicado**: nombre, dirección, mini-mapa
  con el pin y "a 900 m de ti · 12 min caminando", botón **Cómo llegar** (abre Maps). **Quiénes van** con avatares en
  fila (5 + "+N"), "Invitado de…" si aplica, y "ya llegó" con palomita. Acción primaria según estado: Jalo / Ya llegué /
  Cancelar mi lugar.
- **Estados:** cargando, no disponible (cancelado / ya no puedes verlo), lleno, ya empezó sin unión tardía [HECHO].

### 4.7 Ciclo de vida del plan
```
publicado ──(T-10 min)──► lobby ──(inicio)──► en curso ──(fin)──► terminado
     │                     │                     │
     └── cancelado (por quien organiza) ◄────────┘
```
- **T-10 min — Lobby** [NUEVO]: lista de integrantes con **distancia al lugar** ("a 1.2 km", "a 150 m", "Llegó ✓",
  "Ubicación oculta") y **"hace cuánto"** si no se ha actualizado en > 2 min; orden: llegaron → más cerca → más lejos.
  Se avisa a todos ("Tu plan empieza en 10 min"). La ubicación se usa solo para esta distancia y se deja de compartir al
  hacer check-in o al terminar.
- **Check-in "Ya llegué"** [NUEVO, reemplaza "Ya nos vimos"]: disponible desde T-10 hasta el fin. El servidor
  verifica que estés a ≤ **150 m** del lugar (más el margen de precisión, tope 100 m). Si el GPS falla: "Que me confirme
  alguien" → otro integrante que ya hizo check-in te confirma. Se ve "Llegó 19:32".
- **XP, racha e historial** se otorgan con el check-in (no al publicar ni al unirse).
- **Mensajes rápidos** [NUEVO] (sin chat libre): "Ya voy" · "Llego en 5" · "Llego en 10" · "Voy tarde" · "Ya estoy
  aquí" · "¿Dónde están?". Aparecen en el plan como línea de tiempo y como notificación. Límite: 1 cada 30 s.
- **Unirse a un plan en curso** desde el mapa o la tarjeta del amigo, si quien organiza lo permitió [HECHO].
- **Vista de organizador ("Mi plan activo")** [NUEVO]: Empezar ahora (adelanta el inicio si ya están todos), quién
  jaló, lobby con distancias, editar hora/lugar (avisa a todos y libera de penalización a quien cancele en las 2 h
  siguientes), cancelar plan.

### 4.8 Confiabilidad y penalizaciones (antes "Bloque E")
Valores **propuestos** (ajustables en una tabla de configuración del servidor):

| Situación | Penalización |
|---|---|
| Cancelar > 90 min antes | −10 XP |
| Cancelar entre 90 y 15 min antes | −25 a −50 XP (sube conforme se acerca el inicio) |
| Cancelar < 15 min antes o ya empezado (**cancelación tardía**) | −60 XP · cuenta para confiabilidad |
| Confirmaste y **no hiciste check-in** (no-show) | −80 XP · cuenta para confiabilidad |
| Quien organiza cancela | Nadie de los demás pierde; quien organiza pierde según la misma tabla si había gente confirmada |
| Cambio de hora/lugar por quien organiza | Cancelar en las 2 h siguientes no penaliza |

- **Confiabilidad** [NUEVO]: de tus últimos 20 compromisos, cuántos cumpliste. Se muestra como **"Cumple 18 de 20"** en
  tu perfil y en la lista de quiénes van (solo a amigos). Debajo de 60 %: aviso privado y no puedes publicar planes
  con más de 4 lugares por una semana (propuesta).
- **Cómo se muestra:** antes de confirmar la cancelación, hoja con "Perderás 25 XP" y la regla en una línea; después,
  en Historial "−25 XP · Cancelaste 40 min antes". Nada de castigos sorpresa.
- XP nunca baja de 0 ni te baja de nivel (propuesta para no frustrar; la confiabilidad es la que pesa).

### 4.9 Guardados
- **Objetivo:** recordar planes/eventos que te interesan.
- **Pantalla** [CAMBIA]: lista principal = próximos y en curso. Sección **"Ya pasaron"** (colapsada) con lo terminado o
  cancelado; cada fila con **Quitar** y un "Quitar todos".
- **Estados:** vacío ("Guarda planes con el marcador para verlos aquí").
- **Datos:** `GET /me/saved`, `PUT/DELETE /me/saved/{kind}/{id}` [PROPUESTA].

### 4.10 Eventos
- **Crear** [CAMBIA]: tipo de evento · nombre · alias del organizador [HECHO] · **fecha** · **hora de inicio** ·
  **hora de fin** ([QUITAR] duración; si fin < inicio se entiende al día siguiente y se dice "termina mañana 02:00") ·
  **lugar** (mismo buscador + pin que planes) · foto · cupo · switch "¿Se pueden unir ya empezado?" · invitar amigos ·
  **Verificación de asistentes:** *Con QR* o *Sin verificación*.
- **Ver evento:** hora y lugar **arriba y grandes** ("Sáb 22 nov · 18:00–21:00", nombre del lugar, dirección,
  mini-mapa, Cómo llegar), organizador (alias + nombre real), cupo, quiénes van.
- **QR** [NUEVO]: al registrarte recibes un **boleto** con QR (token firmado; se regenera cada 30 s mientras la pantalla
  está abierta para que una captura no sirva). Quien organiza abre **"Escanear asistentes"** (cámara) y ve ✓ nombre +
  foto o ✗ "Boleto no válido / ya usado". El escaneo cuenta como check-in del evento. *Sin verificación*: el check-in es
  por geocerca como en planes.
- **Datos:** `POST /events`, `POST /events/{id}/register` → ticket, `GET /tickets/{id}/qr` (token rotativo),
  `POST /events/{id}/scan {token}` [PROPUESTA].

### 4.11 Notificaciones
- **Eventos que notifican** [CAMBIA, "de todo"]: te invitaron · alguien se unió a tu plan/evento (a quien organiza) ·
  alguien canceló (a quien organiza y a integrantes) · tu plan empieza en 10 min · alguien hizo check-in · mensaje
  rápido · el plan cambió de hora/lugar · el plan se canceló · solicitud de amistad / de amigo cercano · un cercano
  *Disponible* está a < 500 m (máx. 1 por persona al día; no en No molestar).
- **Pantalla:** campana grande con badge; centro de notificaciones (columna izquierda en desktop) agrupado
  **Hoy · Esta semana · Antes**; acciones en línea (Aceptar / Ver plan); agrupación ("Mau y 2 más se unieron").
- **Preferencias** en el menú del perfil por tipo (in-app siempre; push opcional).
- **Datos:** `GET /notifications?cursor`, `POST /notifications/read`, push in-app por WS `notification.new`; Web Push
  (VAPID) para app cerrada (en iOS solo si se instala como PWA). [PROPUESTA]

### 4.12 Amigos y amigos cercanos
- Amigos [HECHO]: lista, solicitudes, buscar, eliminar, ranking (pestaña).
- **[QUITAR] "Cerca ahora"** → se reemplaza por **"Ahora"**: (1) cercanos *Disponibles* cerca con [Invitar], (2) planes
  en curso de amigos a los que te puedes unir, (3) quién está en un plan y qué hace. Es la misma información del mapa,
  en lista.
- Amigos cercanos (menú del perfil) [CAMBIA]: solicitud aparte y mutua [HECHO], buscador tipo Instagram [HECHO],
  "Tu ubicación aproximada" (§2.1), radio de visibilidad.

### 4.13 Historial de ubicaciones (ideas)
No hay "rastro" de nadie. Propuestas, todas **opt-in**, privadas y borrables:
1. **Tus lugares de planes**: mapa de calor *de los lugares de tus planes* (no de tu GPS): "Fuiste 6 veces a Café
   Benito". Sale del historial de check-ins, así que no requiere guardar ubicación personal.
2. **Con quién coincidiste**: resumen semanal "Esta semana coincidiste con Sofi 3 veces, con Mau 1". Basado en planes
   con check-in, no en cercanía pasiva.
3. **Momentos cerca**: "Ayer Nico y tú estuvieron a < 500 m a las 18:00 y no se vieron" → botón "Proponer algo la
   próxima". Se calcula en el momento y se guarda solo el hecho (persona + día), no el punto. Retención 7 días.
4. **Tus horas y lugares favoritos** para sugerir al publicar ("Sueles ir al gym a las 7 am").
5. **Controles:** retención configurable (apagado · 7 días · 30 días), "Borrar todo" en un toque, exportar.
6. Todo vinculado a planes: cada entrada abre el plan, quién fue y el XP.

---

## 5. Lo que cambia en el frontend (lista de trabajo)

**Quitar**
- `docs/evidence/`, `docs/plan-fase2.md`, `docs/nearby-friends.md` ✅ (hecho con este documento).
- Zonas: `api/mock/geocode.ts` (`ZONE_CATALOG`, `reverseZone`, `zoneOrigin`), `Plan.zone`, `zoneLineText`, textos
  "tu zona", "Te ven N cercanos" en mapa, "Tus 3 cercanos lo verán a 800 m".
- `Audience 'amigos+'`, `isFriendOfFriend` como visibilidad, `planVisibility` de amigos de amigos.
- "Cerca ahora" en Amigos; "Ajustes" junto a Editar perfil; tarjeta/banner del plan en la columna izquierda de desktop.
- `Event.durationMin` (→ `endsAt`), categoría `antro` (→ `fiesta`), "Ya nos vimos" (→ check-in).

**Cambiar**
- `RangeControl` → slider. `LiveStatus` → ojito En vivo / No te ven. `MapMarker` amigos → solo foto + puntito.
- `MapView`: deseleccionar al tocar vacío, clustering, agrupar por lugar, estilos próximo/en curso.
- `PlanDetailSheet` / `MatchScreen` → nueva vista de plan + lobby + check-in + mensajes rápidos.
- `PublishScreen` / `CreateEventScreen` → lugar obligatorio con buscador real, "Quién se puede unir", hora de fin,
  verificación QR/sin verificación, invitaciones con distancia y frescura.
- `AppShell` (avatar en tab), `DesktopShell` (nav nueva + panel derecho "Mi plan activo"), `ProfileScreen` (menú).
- Guardados con "Ya pasaron". Notificaciones con todos los tipos y agrupación.

**Nuevo**
- `src/api/client.ts` (interfaz única) + `src/api/mock/` como implementación.
- Disponibilidad, confiabilidad, lobby, check-in, mensajes rápidos, invitados de invitados, boleto QR + escáner,
  selector de día, conteos "¿Qué plan hoy?", vista "Ahora", historial opt-in.
- **Tokens nuevos** en `tokens.json` (no colores sueltos): `availability.available/busy`,
  `plan.upcoming/live`, `presence.off` (avatar apagado). Revisar contraste AA.

---

## 6. Integraciones externas

### 6.1 Lugares reales (buscador)
Siempre **a través del backend** (la llave nunca va al navegador; el backend añade `near` con la celda aproximada, no
con tu punto exacto, y cachea).

| Opción | Pro | Contra |
|---|---|---|
| **Google Places API (New)** — Autocomplete + Place Details | La mejor cobertura de negocios en México | Sus términos **restringen mostrar contenido de Google sobre mapas que no son de Google** y cachear resultados: habría que cambiar el mapa base a Google Maps JS (hoy es MapLibre + CARTO). Costo por sesión. **Verificar términos vigentes antes de decidir.** |
| **Amazon Location Service** (Places: Autocomplete / SearchText / GetPlace) | Ya estamos en AWS (`infra/`), IAM sin llaves en cliente, permite guardar resultados ("storage"), sirve con MapLibre | Cobertura de negocios pequeños algo menor |

**Recomendación:** Amazon Location (encaja con `infra/` y con MapLibre); si la cobertura no alcanza, Google con su
mapa. El pin manual queda como respaldo siempre.

### 6.2 Mapa base
MapLibre [HECHO]. Para producción, estilo propio (Protomaps en S3 + CloudFront) o Amazon Location Maps, para no filtrar
el área que mira cada persona a un tercero.

---

## 7. Backend: qué hay y qué falta

`infra/` hoy: API Gateway HTTP (`$default` → Lambda placeholder) y WebSocket (`$connect`, `$disconnect`, `$default`,
`location`), Redis (ElastiCache), DynamoDB (`users`, `friendships`, `connections`), SQS + Lambda worker → S3,
S3 + CloudFront. **No hay** auth, planes, eventos, notificaciones, lugares ni XP. Todo lo de abajo es **[PROPUESTA]**.

### 7.1 Modelo de datos

**DynamoDB**
| Tabla | PK / SK | Campos clave | GSI |
|---|---|---|---|
| `users` (existe) | `userId` | name, handle, avatarUrl, coverUrl, bio, totalXp, level, reliability {kept, total}, availability {status, until}, ghost, visibilityRadiusM, openMode | `handle` |
| `friendships` (existe) | `userId` / `friendId` | status, **close** (none/requested_out/requested_in/mutual), since | — |
| `plans` | `planId` | ownerId, category, title, startsAt, durationMin, endsAt, place {placeId?, name, address?, lat, lng, geohash}, photoUrl, joinPolicy (`friends`/`friends_and_guests`), lateJoin, capacity?, status (scheduled/live/ended/cancelled) | `ownerId#startsAt`, `geohash5#startsAt` |
| `events` | `eventId` | como plans + type, organizerAlias, startsAt, **endsAt**, verification (`qr`/`none`), audience | `geohash5#startsAt` |
| `attendances` | `targetId` / `userId` | kind, status (going/cancelled/arrived/no_show/removed), invitedBy, joinedAt, arrivedAt, cancelledAt, penaltyXp | `userId#startsAt` |
| `invites` | `toId` / `inviteId` | targetId, kind, fromId, status, at | `targetId` |
| `notifications` | `userId` / `at#id` | type, actorIds[], targetId, read, TTL 90 d | — |
| `quick_messages` | `targetId` / `at#userId` | preset (enum, no texto libre), TTL = fin + 24 h | — |
| `tickets` | `ticketId` | eventId, userId, secret, usedAt | `eventId#userId` |
| `saved` | `userId` / `kind#id` | savedAt | — |
| `xp_ledger` | `userId` / `at#id` | delta, reason, targetId | — |
| `location_history` (opt-in) | `userId` / `day#type` | solo hechos (placeId visitado, persona con quien coincidiste), TTL según retención | — |

**Redis**
- `geo:live` — `GEOADD` con la **celda** de cada usuario visible; `loc:{userId}` hash {cell, accuracy, updatedAt} con
  TTL 15 min. `GEOSEARCH` por radio y luego filtro por cercanos mutuos.
- `lobby:{planId}` — hash `userId → {distanceM (redondeado 50 m), updatedAt}`; existe de T-10 al fin; aquí sí entra el
  punto real del integrante **solo para calcular la distancia** y se descarta.
- `rank:alltime` (sorted set), `ratelimit:*`.

**Programados (EventBridge Scheduler → SQS → worker):** abrir lobby en T-10, marcar `live` al inicio, cerrar al fin y
convertir `going` sin check-in en `no_show` (con penalización), expirar disponibilidad y ubicaciones exactas.

### 7.2 Endpoints REST (HTTP API)
```
Auth          POST /auth/login · POST /auth/refresh                     (Cognito)
Yo            GET/PATCH /me · PUT /me/visibility · PUT /me/availability · GET /me/viewers
              GET /me/reliability · GET /me/xp-ledger · GET/DELETE /me/location-history
Amigos        GET /friends · POST /friends/requests · POST /friends/{id}/accept · DELETE /friends/{id}
              POST /friends/{id}/close (pedir) · POST /friends/{id}/close/accept · DELETE /friends/{id}/close
              POST /friends/{id}/exact-share {minutes} · DELETE /friends/{id}/exact-share
Mapa/feed     GET /map?bbox&zoom&filter · GET /feed?date&radiusM&filter
Lugares       GET /places/autocomplete?q&session · GET /places/{placeId}
Planes        POST /plans · GET /plans/{id} · PATCH /plans/{id} · POST /plans/{id}/cancel · POST /plans/{id}/start
              POST /plans/{id}/join · POST /plans/{id}/leave (calcula y devuelve penaltyXp antes con ?dryRun=1)
              POST /plans/{id}/invites {userIds} · DELETE /plans/{id}/members/{userId}
              GET /plans/{id}/lobby · POST /plans/{id}/checkin {lat,lng,accuracy} · POST /plans/{id}/checkin/{userId}/vouch
              POST /plans/{id}/messages {preset}
Eventos       POST /events · GET /events/{id} · PATCH · POST /events/{id}/cancel · POST /events/{id}/register
              GET /tickets/{id}/qr · POST /events/{id}/scan {token} · POST /events/{id}/checkin
Invitaciones  GET /invites · POST /invites/{id}/accept · POST /invites/{id}/decline
Notificaciones GET /notifications?cursor · POST /notifications/read · PUT /me/notification-prefs · POST /push/subscribe
Guardados     GET /me/saved · PUT /me/saved/{kind}/{id} · DELETE /me/saved/{kind}/{id}
Ranking       GET /ranking?scope=friends|global
Medios        POST /uploads (URL firmada a S3; el servidor re-codifica y quita EXIF)
```

### 7.3 WebSocket (rutas)
| Ruta / mensaje | Dirección | Contenido |
|---|---|---|
| `location` (existe) | cliente → servidor | `{lat, lng, accuracy}` cada 30–60 s con la app abierta; el servidor redondea y descarta |
| `location.update` | servidor → cercanos | `{userId, cell, distanceBucket, updatedAt}` (o `hidden`) |
| `lobby.update` | servidor → integrantes | `{planId, userId, distanceM, updatedAt, arrived}` |
| `plan.update` / `event.update` | servidor → interesados | cambios de estado, miembros, hora o lugar |
| `notification.new` | servidor → usuario | notificación ya armada |
| `message.new` | servidor → integrantes | mensaje rápido |

### 7.4 QR
Token = `base64url(ticketId.exp)` + firma HMAC-SHA256 con el `secret` del ticket; `exp` = ahora + 45 s.
`/scan` verifica firma, caducidad, que el ticket sea de ese evento y que no esté usado; marca `usedAt` y check-in.
Escáner en el navegador con `BarcodeDetector` (si existe) o una librería (p. ej. `jsQR`) como respaldo.

---

## 8. Accesibilidad y calidad (no negociable)
- Contraste AA, objetivos ≥ 44 px, `aria-pressed` (chips, ojito, vista), `aria-checked` (switches), `aria-current`
  (navegación), slider con `aria-valuetext`.
- **El mapa siempre con lista equivalente**; los clusters y marcadores de establecimiento se pueden recorrer con
  teclado y anuncian "3 amigos aquí".
- Avatares sin nombre en el mapa llevan `aria-label` con el nombre (el nombre no se *dibuja*, pero lector de pantalla sí
  lo anuncia: es accesibilidad, no exposición nueva, porque solo los ves si ya eres su cercano).
- Respeta `prefers-reduced-motion` (sin pulsos ni latidos).
- Cada bloque: unit + E2E (iPhone, Pixel, desktop) + axe en verde. Sin capturas.

---

## 9. Plan de ejecución (bloques)

| # | Bloque | Contenido | Hecho cuando |
|---|---|---|---|
| **G1** | Base de datos y limpieza | `api/client.ts`; quitar zonas, `amigos+`, `antro`→`fiesta`, `Event.endsAt`; "Tu ubicación aproximada"; disponibilidad en el modelo | Ninguna pantalla importa `seed.ts` ni `geocode.ts`; pruebas en verde |
| **G2** | Navegación y layout | Avatar en tab; nav desktop nueva; panel derecho "Mi plan activo"; menú hamburguesa del perfil con configuración; "Quién te ve" y radio de visibilidad ahí | E2E de navegación en 3 dispositivos |
| **G3** | Mapa | Avatares solo foto + puntito; planes próximo/en curso; eventos con hora; deseleccionar al tocar vacío; clustering y agrupación por lugar; filtros; tarjeta de amigo con Invitar | E2E de selección/deselección y lista equivalente |
| **G4** | Explorar "¿Qué plan hoy?" | Conteos, selector de día, slider de rango, ojito En vivo/No te ven, vista "Ahora" en Amigos | E2E de conteos por día y rango |
| **G5** | Crear plan y evento | Lugar obligatorio con buscador (mock con la misma forma que la API real) + pin; invitaciones con distancia y frescura; "Quién se puede unir"; evento con hora de fin y verificación | E2E de publicar con y sin lugar encontrado |
| **G6** | Ver plan + ciclo de vida (+ antiguo E) | Vista nueva; lobby T-10; check-in con geocerca y "que me confirme alguien"; mensajes rápidos; invitados de invitados; penalizaciones y confiabilidad | Unit de reglas de penalización/no-show; E2E del ciclo completo con reloj simulado |
| **G7** | Notificaciones y Guardados | Todos los tipos, agrupación, preferencias; "Ya pasaron" con quitar | E2E |
| **G8** | Eventos con QR | Boleto rotativo, escáner del organizador, sin verificación | Unit de firma/caducidad; E2E con token simulado |
| **G9** | Historial (opt-in) | Lugares de tus planes, con quién coincidiste, retención y borrar | E2E de activar/borrar |
| **F** | Insignias de admin | Pendiente desde Fase 2 | — |

Orden recomendado: G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9 → F. G1 primero porque los demás dependen del cliente
de API y del modelo sin zonas.

---

## 10. Decisiones confirmadas (2026-11-18)
1. **Radio de visibilidad de amigos cercanos: 3 km por defecto, modificable** en Configuración (500 m · 1 · 3 · 5 · 10 km). El slider de Explorar (1–25 km) sigue para planes/eventos.
2. **Lugares:** Amazon Location **solo como preparación**: se define la interfaz `PlacesProvider` en `api/client.ts` pero hoy no se usa; el usuario escribe el nombre y **decide la ubicación en el mapa**.
3. **Penalizaciones** (§4.8) aprobadas tal cual.
4. **Check-in:** 150 m aprobado.
5. **Invitados de invitados:** sin límite; **además todo plan (también el normal) tiene límite de personas opcional** (`capacity`).
6. **`CLAUDE.md` actualizado** con la regla de privacidad y la de pruebas nuevas.
7. **Ubicación exacta temporal se queda** y quien comparte **elige cuánto tiempo** (30 min · 1 h · 2 h · 4 h).

## 11. Estado previo (para no perderlo)
Hecho en Fase 2: perfil editable (A), amigos y eliminar (B), amigos cercanos mutuos + exacta temporal (C), planes con
hora/duración/lugar/foto, Mis planes, unión tardía, invitaciones, un compromiso a la vez, picker de mapa, eventos con
fecha (D); niveles 1–100, racha semanal, historial de planes, ranking (global solo con modo abierto).

---

## 12. Mejoras de UX/UI por flujo

**Mapa**
- El mapa es la pantalla; todo lo demás son hojas encima (no navegar fuera). Hoja con 3 alturas (peek 30 % · media ·
  completa) y arrastre.
- Jerarquía visual: amigos = círculos, planes = gota con ícono, eventos = cuadrado redondeado. Forma + color + ícono,
  nunca solo color.
- Botón "centrar en mí" y "ver todo lo de hoy" (encuadra resultados). Animar la cámara al seleccionar (respetando
  reduced-motion).
- Estados "en curso" con un pulso lento (1 cada 2 s), no parpadeo.

**Explorar**
- El conteo es el gancho: frase humana ("4 amigos quieren hacer algo hoy") y tocarla filtra a esos planes.
- Selector de día con fechas cortas ("Vie 21") y un punto bajo los días que tienen planes.
- Slider con imán y la cifra resultante en vivo ("12 planes"). Ojito siempre a la vista con texto, no solo ícono.
- Vacíos con salida: cada estado vacío ofrece una acción (ampliar rango, ver mañana, publicar).

**Crear plan**
- Una sola pantalla con secciones plegadas y resumen ("Café · Hoy 19:30 · Café Benito · 3 invitados"); el botón
  Publicar se habilita al tener tipo + lugar.
- Lugar: recientes y favoritos primero, luego resultados; "No lo encuentro" siempre visible al final.
- Invitar: los *Disponibles* y más cercanos arriba, con chip de disponibilidad; selección múltiple con avatares en la
  barra inferior.
- Borrador autoguardado; al publicar, transición a la vista de "Mi plan activo".

**Ver plan**
- Portada con foto y degradado, título encima; datos clave en 3 filas con ícono (cuándo, dónde, quiénes).
- Mini-mapa tocable que abre el mapa centrado en el lugar; tiempo caminando además de distancia.
- Acción primaria fija abajo y una sola por estado; destructivas (cancelar) como texto secundario con confirmación que
  dice la penalización.

**Ciclo de vida**
- Lobby como "carrera" visual: barra horizontal con avatares acercándose al pin del lugar; cada uno con "150 m".
- Check-in que se ofrece solo cuando ya estás cerca ("Parece que ya llegaste · Ya llegué"), con vibración ligera.
- Mensajes rápidos como chips encima de la acción principal; se ven como burbujas pequeñas en la línea de tiempo.
- Celebración discreta al terminar (+XP, racha) y pedir nada más.

**Eventos**
- Hora y lugar en el encabezado, antes de la descripción. "Termina mañana 02:00" cuando cruza medianoche.
- Boleto a pantalla completa con brillo máximo sugerido y nombre + foto (para que el organizador compare).
- Escáner con feedback inmediato (verde/rojo + sonido opcional) y contador "34 de 50 registrados".

**Notificaciones**
- Agrupar por plan y por tiempo; acción en línea; marcar todo como leído.
- Badge numérico solo para lo que requiere acción (invitaciones); lo demás, punto.
- Push con texto útil sin ubicación: "Mau se unió a tu café de las 19:30".

**Historial**
- Presentarlo como "tu semana" (recuerdos), no como registro; siempre con el control de privacidad a un toque.

**Perfil y configuración**
- Menú agrupado: *Privacidad* (fantasma, cercanos, radio, quién te ve) · *Social* (modo abierto, disponibilidad) ·
  *App* (notificaciones, historial) · *Cuenta*. Cada opción con una línea que explica el efecto.
- Mostrar el estado actual en la propia fila ("Modo fantasma · Apagado"), para no tener que entrar.
- Confiabilidad visible pero amable ("Cumples 18 de 20 · ¡Bien!").

**Transversal**
- Microcopy en tú, corto y concreto; números siempre con unidad y redondeo humano ("~1 km", "hace 3 min").
- Esqueletos en vez de spinners; optimistic UI en Jalo/Guardar con deshacer de 5 s.
- Mismos componentes en mobile y desktop: la hoja inferior de mobile = panel derecho en desktop.
