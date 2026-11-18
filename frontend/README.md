# Paquete para Claude Code — ¿Jalas? (Nearby Friends)

## Cómo usarlo
1. Descomprime este paquete en la **raíz de tu repo**, donde ya está `infra/`. `CLAUDE.md` queda en la raíz y `docs/` a su lado.
2. Abre Claude Code en esa carpeta y entra en modo plan (Shift+Tab).
3. Pega esto:

> Lee CLAUDE.md, docs/brief-mvp.md y docs/design/design-system.md. Revisa infra/ y las pantallas en docs/design/screens/. Ejecuta el Paso 0 del brief y espera mi OK.

## Contenido
- `CLAUDE.md`: reglas que Claude Code carga en cada sesión.
- `docs/brief-mvp.md`: alcance del MVP, stack, privacidad y forma de trabajo.
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
sesión, zona elegida, modo fantasma, modo abierto y bloqueos (nunca coordenadas).

### Decisiones del mock (distintas al brief, a propósito)
- **Sin MSW / TanStack Query / React Hook Form todavía:** los datos salen de `src/api/mock/seed.ts`, validados con Zod al arrancar.
- **Mapa:** MapLibre GL (`react-map-gl/maplibre`) con tiles vectoriales de CARTO Positron/OpenStreetMap, sin API key (`src/features/map/MapView.tsx`, carga diferida). Las zonas son círculos de 500 m como capa GeoJSON. **Privacidad:** el proveedor de tiles ve el área que miras; para producción hay que alojar un estilo propio (p. ej. Protomaps en S3 + CloudFront de `infra/`). Sin WebGL se muestra un aviso y la vista de lista.
- **Modo abierto apagado = sin eventos** en Explorar y en el mapa (el eventos-con-gente-nueva requiere el consentimiento 18+).
- **Pau** llega como solicitud entrante (Amigos) y su perfil ofrece Aceptar/Rechazar; el flujo "Agregar amigo → Solicitud enviada" se ve con Karla o Lalo (Evento → Ver quién más va).
- **"Ya nos vimos":** XP y racha solo cuando ambos confirman (la otra persona confirma sola a los 3 s en el mock).

### Privacidad (dónde está implementada)
- Precisión de zona: centro redondeado a 0.002° (~220 m) y radio 500 m → `src/lib/geo.ts`.
- Punto exacto solo con match activo y temporal: `src/api/mock/server.ts` (`getExactLocation`) + `exactShareUntil`.
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
| WS `location` `{zone}` (solo zona redondeada) · WS push `match.exact` (con TTL) | Mapa en vivo |
| `GET/POST /friends`, `POST /friends/:id/accept` · `/block` · `/report` | Amigos y moderación |
