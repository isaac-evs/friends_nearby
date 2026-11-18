# Brief — Frontend MVP de "¿Jalas?" (Nearby Friends)

## Rol
Actúa como lead de frontend con experiencia en apps sociales de ubicación. Vas a construir el **MVP del frontend**, no el producto completo, a partir de diseños ya aprobados. La prioridad es la fidelidad al diseño, que cada pantalla cubra todos sus estados y que la privacidad sea correcta.

## Fuentes (léelas antes de escribir código)
- `docs/design/design-system.md`: principios, componentes, estados y el mapa de pantallas.
- `docs/design/tokens.json` y `docs/design/theme.css`: tokens. **No inventes colores ni tamaños fuera de estos.**
- `docs/design/screens/*.dc.html`: referencia visual de cada pantalla, con copy real, layout y datos de ejemplo. Son mockups de un lienzo y **no** código para copiar. Lee el HTML para extraer estructura, textos y medidas, y reconstrúyelo con componentes React.
- La carpeta `infra/` del repo: revisa qué servicios existen (auth, correo, tiempo real, mapas). Diseña los contratos contra eso y marca como "propuesta" lo que falte.

## Stack
- React + TypeScript (strict) + Vite + Tailwind CSS v4 (usa `theme.css` como `@theme`).
- React Router, TanStack Query, Zod (contratos) y MSW (mocks mientras no haya backend).
- MapLibre GL (`react-map-gl/maplibre`) para el mapa, `lucide-react` para íconos, React Hook Form + Zod para formularios.
- Vitest + Testing Library, Playwright (viewports iPhone, Pixel y desktop) y `@axe-core/playwright`.
- **Mobile first.** Desktop (≥ 1024 px) usa el layout de `Desktop.dc.html`.

## Alcance del MVP (solo esto)
1. **Entrar / Registro / Olvidé mi contraseña:** pantalla 1. El registro y la recuperación siguen el mismo lenguaje visual. La recuperación responde igual exista o no el correo.
2. **Permiso de ubicación:** pantalla 2. Pre-permiso, opción de zona manual y manejo de `denied`.
3. **Explorar:** pantalla 3.
   - Selector *Mis amigos / Abierto*.
   - Swipe de cards con gestos y botones Paso / Luego / Jalo.
   - En Abierto: chips de tipo (Todos, Deporte, Social, Comida, Aprender) y "+ Crear".
   - Estado vacío por modo.
4. **Mapa:** pantalla 4.
   - Amigos con **zona aproximada**: círculo. La exacta solo con match, y es temporal.
   - Pins de evento, bottom sheet del seleccionado y filtros.
   - **Vista de lista equivalente** para accesibilidad.
5. **Match:** pantalla 5. Punto de encuentro, mensajes rápidos y "Ya nos vimos" (XP y racha cuando ambos confirman).
6. **Publicar:** pantallas 6 y 12. Plan rápido (categoría, línea, duración, audiencia) y **Crear evento** (tipo, nombre, día/hora, lugar público, cupo, quién puede unirse, aprobación manual, vista previa en vivo).
7. **Evento:** pantalla 10. Detalle, ritmo, Me uno / Salirme y "Ver quién más va".
8. **Amigos:** pantalla 7. Buscar por @usuario, link/QR, solicitudes (aceptar/rechazar) y lista de cercanos.
9. **Perfiles:** pantallas 8 y 11. Mi perfil (nivel, racha, insignias, ranking opt-in, modo fantasma, entrada a modo abierto). Perfil de otra persona (en común, agregar amigo con estado "Solicitud enviada", saludar, bloquear/reportar).
10. **Modo abierto:** pantalla 9. Apagado por defecto, confirmación 18+ obligatoria y preferencias de eventos grandes o planes chicos.

**Fuera del MVP:** chat completo, push notifications, círculos, 2FA, historial, i18n en inglés y panel de moderación.

## Reglas de privacidad (no negociables)
- Nunca mostrar coordenadas exactas fuera de un match activo. Redondear o usar geohash para la zona y dejar documentada la precisión elegida.
- Las personas fuera de tus amigos nunca reciben tu ubicación. En eventos solo ven tu nombre y avatar.
- "Paso" no notifica. Bloquear oculta a la persona de cards, mapa, eventos y búsqueda.
- La web no tiene ubicación en segundo plano. Muestra la antigüedad ("hace 3 min") y el estado "no compartiendo en vivo" cuando la app no está visible (`visibilitychange`).
- Nada de ubicación en analítica ni en logs.

## Modelo de datos (frontend, Zod)
`User`, `Friendship(status)`, `Plan` (card de amigo: categoría, línea, expiresAt, audiencia, zona), `Event` (tipo, título, inicio, lugar público, cupo, organizador, audiencia, requiresApproval), `Swipe`, `Match` (exactShareUntil), `Attendance`, `XpEvent`, `Badge`, `Block`, `Report`.

## Arquitectura sugerida
```
src/
  app/ (router, providers, AppShell, TabBar, DesktopShell)
  design/ (componentes del design system: Button, Chip, SegmentedControl, SwipeCard, DateBadge, Avatar, Toggle, BottomSheet, MapMarker, Notice, EmptyState)
  features/ auth, location, explore, map, match, publish, events, friends, profile, open-mode
  api/ (schemas zod, cliente, mocks msw)
  lib/ (geo: redondeo/zonas, format: distancias y fechas es-MX, hash de color de avatar)
```

## Forma de trabajo
1. **Paso 0:** revisa `infra/` y los documentos de diseño, y entrégame un plan corto con este contenido:
   - las rutas;
   - la lista de componentes del design system;
   - los contratos;
   - los supuestos;
   - una recomendación de modelo por fase según lo que tengas disponible en `/model`, por ejemplo Opus para el plan y la lógica de privacidad, Sonnet para las pantallas.

   Espera mi OK.
2. Construye primero los **componentes del design system**, cada uno con sus estados y una página `/dev/ui` que los muestre. Luego arma las pantallas en el orden del alcance.
3. Cada pantalla se considera hecha solo con:
   - captura a 390 px comparada con su `.dc.html`;
   - estados de carga, vacío y error;
   - test E2E del flujo principal;
   - cero violaciones de axe.
4. Al terminar cada bloque, muéstrame la evidencia y espera confirmación. Si algo no se puede verificar o `infra/` no lo soporta, dilo.
