# Paquete para Claude Code — ¿Jalas? (Nearby Friends)

## Cómo usarlo
1. Descomprime este paquete en la **raíz de tu repo**, donde ya está `infra/`. `CLAUDE.md` queda en la raíz y `docs/` a su lado.
2. Abre Claude Code en esa carpeta y entra en modo plan (Shift+Tab).
3. Pega esto:

> Lee CLAUDE.md, docs/brief-mvp.md y docs/design/design-system.md. Revisa infra/ y las pantallas en docs/design/screens/. Ejecuta el Paso 0 del brief y espera mi OK.

## Contenido
- `CLAUDE.md`: reglas que Claude Code carga en cada sesión.
- `docs/especificacion.md`: **especificación vigente** (producto, privacidad, flujos, backend propuesto, bloques y mejoras de UX/UI).
- `docs/brief-mvp.md`: brief original del MVP (histórico; donde choque, manda la especificación).
- `docs/design/design-system.md`: principios, color, tipografía, componentes y estados.
- `docs/design/tokens.json`: tokens, la fuente de verdad.
- `docs/design/theme.css`: los mismos tokens como tema de Tailwind v4.
- `docs/design/screens/`: las 13 pantallas del lienzo como referencia (`canvas.json` trae el orden y los títulos).

---

## Frontend (MVP mock) — cómo correrlo

```bash
npm install
npm run dev          # http://localhost:5173  ·  /dev/ui = catálogo del design system
npm run typecheck && npm test            # tipos + unit (Vitest)
npx playwright test                      # E2E (iPhone, Pixel, desktop) + axe
```

Cualquier correo y contraseña de 8+ caracteres entra. Todo vive en memoria (`src/app/store.tsx`); solo se persisten
sesión, permiso de ubicación, modo fantasma, modo abierto, bloqueos y radios (nunca coordenadas).

### Decisiones del mock (distintas al brief, a propósito)
- **Sin MSW / TanStack Query / React Hook Form todavía:** las pantallas y el store leen SOLO de `src/api/client.ts` (`api.bootstrap()`, `api.live`, `api.profile`, `api.places`); el mock (`src/api/mock/`) es una implementación de ese cliente, validada con Zod al arrancar. Cambiar a backend real = cambiar esa implementación.
- **Mapa:** MapLibre GL (`react-map-gl/maplibre`) con tiles vectoriales de CARTO Positron/OpenStreetMap, sin API key (`src/features/map/MapView.tsx`, carga diferida). La ubicación aproximada de un amigo cercano es un círculo de 500 m (capa GeoJSON); planes y eventos van en su lugar exacto. **Privacidad:** el proveedor de tiles ve el área que miras; para producción hay que alojar un estilo propio (p. ej. Protomaps en S3 + CloudFront de `infra/`). Sin WebGL se muestra un aviso y la vista de lista.
- **Modo abierto apagado = sin eventos** en Explorar y en el mapa (el eventos-con-gente-nueva requiere el consentimiento 18+).
- **Pau** llega como solicitud entrante (Amigos) y su perfil ofrece Aceptar/Rechazar; el flujo "Agregar amigo → Solicitud enviada" se ve con Karla o Lalo (Evento → Ver quién más va).
- **"Ya nos vimos":** XP y racha solo cuando ambos confirman (la otra persona confirma sola a los 3 s en el mock).

### Privacidad (dónde está implementada)
- Ubicación aproximada (sin zonas ni colonias): celda redondeada a 0.002° (~220 m) y círculo de 500 m → `src/lib/geo.ts`.
- Punto exacto de una persona solo si ella lo comparte con un amigo cercano, por el tiempo que elige (30 min a 4 h): `api.live.exactLocation` (mock en `src/api/mock/server.ts`).
- La ubicación del navegador se redondea de inmediato y se descarta (`PermissionScreen`); no hay analítica ni logs de ubicación.
- Pestaña oculta (`visibilitychange`) → "No compartiendo en vivo" (`features/map/LiveStatus.tsx`).

### Contratos contra `infra/` — todo es **propuesta**
`infra/` hoy solo tiene API Gateway HTTP (`$default` → una Lambda placeholder) y WebSocket (`$connect`, `$disconnect`, `$default`, `location`), Redis, DynamoDB, SQS y S3/CloudFront.
**No hay** auth (Cognito o similar), correo (SES), ni servicio de mapas/tiles. Por eso estas rutas **no existen aún**:

| Propuesta | Uso |
|---|---|
| `POST /auth/login`, `/auth/register`, `/auth/forgot` (responde 202 siempre) | Pantalla 1 (requiere auth + SES) |
| `GET /plans?scope=friends`, `POST /plans`, `DELETE /plans/:id` | Explorar / Publicar |
| `GET /events?type=`, `POST /events`, `POST /events/:id/join` · `DELETE` | Modo abierto / Evento |
| `POST /swipes` `{targetId, action}` · `POST /matches` · `POST /matches/:id/confirm` | Swipe y match |
| WS `location` `{lat,lng}` (el servidor redondea a celda y descarta el punto) · WS push `location.update` / exacta con TTL | Mapa en vivo |
| `GET/POST /friends`, `POST /friends/:id/accept` · `/block` · `/report` | Amigos y moderación |
| `DELETE /friends/:id` (sin notificar a la otra persona) | Eliminar amigo (Fase 2, bloque B) |
| `POST /friends/:id/close` (solicitud de amigo cercano) · `POST /friends/:id/close/accept` · `DELETE /friends/:id/close` (rechazar/cancelar/quitar, sin notificar) · `GET /me/close-requests` — **de dos vías**: solo con aceptación mutua se ven la ubicación aproximada. `PUT /me/ghost` `{ enabled }` (fantasma oculta a todos y corta lo compartido) | Amigos cercanos (Fase 2, bloque C) |
| **Ubicación exacta temporal** entre cercanos: `PUT /me/exact-share/:id` `{ minutes: 30\|60\|120 }` · `DELETE /me/exact-share/:id` · `POST /friends/:id/exact-request` · WS `exact.location` (solo mientras dure; TTL en Redis; el servidor rechaza si no son cercanos mutuos o si quien comparte está en fantasma) | Ubicación exacta por un rato (Fase 2) |
| `POST /matches/:id/verify-together` (recibe la posición UNA vez, la compara en servidor con el punto de encuentro y responde solo `{ together }`; no devuelve ni guarda coordenadas) | Verificar que estamos juntos (Fase 2, plan) |
| `GET /usernames/:name` → `{ available }` · `PATCH /me` `{ username }` (409 si existe; 3–20, minúsculas, números, `.` y `_`) | Nombre de usuario (Fase 2) |
| `POST /plans` `{ category, line, startsAt, durationMin, audience, place?: { name, lat, lng }, photoKey? }` · `PATCH /plans/:id` `{ startsAt, durationMin }` (solo quien lo organiza) · `DELETE /plans/:id` · `GET /me/plans` (organizo + voy) · `POST/DELETE /plans/:id/join` (también mientras está en curso, según la audiencia). El **lugar exacto** es un lugar público que elige quien publica (no su ubicación) | Planes con hora, duración y lugar (Fase 2, bloque D) |
| `GET /places/search?q=` (proveedor de lugares: p. ej. Amazon Location Service; recibe solo el texto, nunca tu ubicación) | Elegir el lugar exacto de un plan o evento |
| `POST /events` con `{ durationMin, photoKey?, alias? }` (el nombre real del organizador siempre se devuelve aparte del alias) | Eventos con alias, duración y foto |
| **Recordatorios de planes** (hoy es un aviso dentro de la app): EventBridge Scheduler → SQS/SNS | Alerta de plan próximo |
| **Ranking global** solo para quien tiene el **modo abierto** activo (nadie lo ve ni aparece si lo tiene apagado) | Ranking (Fase 2) |
| **Nearby friends real:** `WS location` (ya existe la ruta) → `GEOADD` en Redis con TTL; `GEOSEARCH` por radio solo entre cercanos mutuos; el servidor devuelve la distancia **redondeada** ("~400 m"), nunca coordenadas (salvo ubicación exacta compartida) | Cerca ahora / alertas de cercanía |
| `GET /nearby?radiusM=1000..25000` (planes, eventos y amigos dentro del rango; el servidor filtra por radio y devuelve distancias redondeadas) | Rango de búsqueda (Fase 2) |
| `POST /invites` `{ kind, targetId, toIds[] }` · `POST /invites/:id/respond` `{ accept }` (aceptar te une, respetando "un plan a la vez" y "unirse en curso") · `GET /me/notifications` (invitaciones, solicitudes de amigo y de amigo cercano) | Invitaciones y Notificaciones (Fase 2) |
| `lateJoin` (¿se puede unir con el plan/evento en curso?) y `joinPolicy: 'friends' \| 'friends_and_guests'`, `capacity?` y `place` (obligatorio) en `POST /plans`; el servidor **impone** "un plan o evento a la vez" (409 si se traslapa) | Reglas de planes (Fase 2) |
| Proveedor de lugares (PREPARACIÓN, no se usa aún): `GET /places/autocomplete`, `GET /places/{placeId}` con Amazon Location; hoy el lugar se escribe y se marca en el mapa (`api.places`) | Lugar de planes y eventos |
| `GET /friends/presence` → celda aproximada de tus amigos **cercanos** sin plan (el backend filtra: solo cercanos, sin pausa, sin bloqueados; nunca coordenadas exactas) | Mapa: amigos "chilling" (Fase 2) |
| `PATCH /me` `{ bio }` (hasta 160 caracteres); el nivel (1–100) y su nombre/color/diseño los calcula el cliente desde `User.level` (`lib/levels.ts`) | Descripción y niveles (Fase 2) |
| `GET /me/history` (planes y eventos a los que fuiste: título, lugar público, fecha y asistentes; **sin coordenadas**) · la racha (semanas seguidas con ≥ 1 plan/evento, lunes–domingo) se calcula de ahí | Historial de planes y racha (Fase 2) |
| `GET /ranking?scope=global\|friends&limit=10` + tu lugar (`rank`) — Redis (ya existe en `infra/`): sorted set **de siempre** (XP total), `ZINCRBY` al sumar XP, `ZREVRANGE` top, `ZREVRANK` tu lugar. **Obligatorio**: participa todo el mundo (se ve nombre, nivel y XP; nunca ubicación) | Ranking global y de amigos (Fase 2) |

### Qué hay hoy en `infra/` (revisado) y qué falta para la Fase 2
- **Existe:** DynamoDB `users` (perfil + preferencias) y `friendships` (con índice inverso), `connections` (WebSocket, con TTL); Redis para ubicaciones y pub/sub; SQS + Lambda *worker* que guarda historial de ubicación en S3; S3 + CloudFront para fotos; API HTTP con una sola ruta `$default` y una Lambda placeholder (`api.mjs`).
- **No existe:** tablas de planes/eventos/asistencias, XP y niveles, racha, historial de planes ni ranking; tampoco autenticación ni recordatorios. Todo eso es **propuesta**.
- **Zonas visitadas** se quitaron del producto: dependen de procesar ubicación (la parte más delicada y cara). El historial de planes no necesita ubicación: guarda el lugar público como texto.
