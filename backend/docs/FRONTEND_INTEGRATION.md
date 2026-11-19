# Integración con el frontend G1–G4

Base: `origin/frontend`, commit de Alan Varela `e054728` (18/11/2026).
Se conservan sus pantallas, rutas, tokens y contratos de `frontend/src/api/schemas.ts`.
El cliente de producción usa HTTP y WebSocket; los datos de ejemplo y las
respuestas automáticas están aislados en `src/api/mock/` para pruebas unitarias.

## Hallazgos corregidos

1. Se incorpora el frontend G1–G4 completo y se conectan sus nuevas acciones:
   cercanos, permisos exactos temporales, invitaciones, horarios, perfil y ranking.
2. Publicar eventos exige `center` explícito del lugar público. Publicar planes
   exige `place.name` y `place.center`. Nunca se usa la ubicación personal como
   sustituto. El selector permite marcar manualmente el lugar en un mapa.
3. Los encuentros guardan una referencia al plan, sin copias que puedan
   resucitarlo. Un plan cancelado/terminado o una participación abandonada deja
   de proyectarse como encuentro activo para ambas personas.
4. El anfitrión recibe encuentros en Notificaciones y enlaces en Mis planes.
5. La presencia de cercanos se representa independientemente de que publiquen
   un plan. Unirse no otorga ubicación exacta: requiere consentimiento separado.
6. Apagar modo abierto detiene descubrimiento de eventos; conserva los que
   organizas y tus asistencias pendientes/aceptadas. Puedes consultar y salir.
7. Descubrir planes utiliza el lugar público y el centro aproximado elegido,
   incluido el manual. No exige GPS del autor ni cercanía mutua.
8. Las acciones llevan `requestId` UUID. Recibo, cambios, XP y referencias se
   confirman en la misma transacción. El cliente conserva la intención en errores
   de red y conflictos; un fallo posterior de sincronización muestra un aviso
   sin convertir la escritura confirmada en fracaso ni republicarla.

## Contrato HTTP

Todos salvo `/auth/*` requieren Bearer JWT. El actor proviene exclusivamente del
JWT; nunca de IDs, puntos, XP o confirmaciones declaradas por otro usuario.

| Ruta | Función |
|---|---|
| POST /auth/register, /auth/login | Cuenta real; email, password, username y display_name al registrar |
| POST /auth/forgot, /auth/reset | Recuperación por enlace de un uso, 30 minutos |
| GET /app/state | Proyección filtrada por permisos; `includeUsers=id1,id2` admite 20 perfiles públicos |
| GET /app/user?id=UUID o ?username=usuario | Perfil público; respeta bloqueos |
| POST /app/actions | `{type,requestId,...}` → `{result}` |
| GET /usernames/usuario | Disponibilidad y validación del identificador |
| POST /me/password | `{current,next}` → token nuevo; revoca las sesiones anteriores |
| POST /me/media/presign | `{kind,content_type,size}` → uploadUrl, publicUrl, key |
| /friends/requests, /friends/:id/accept, /friends/:id | Solicitar, aceptar y eliminar amistad |

El cliente valida la proyección con Zod y normaliza su propio UUID al alias `me`.
Errores: `{error}` con 400/403/404/409; 409 exige reintentar contra estado actual.
Recibos tienen retención solicitada de 24 horas; un mismo UUID con contenido
incompatible devuelve 409. El UUID de verificación no conserva ni deriva un hash
de la posición usada para comprobar llegada.

### Acciones

- Preferencias: setLocation, setOpenMode, setGhost, setAvailability, setRadius,
  setVisibilityRadius, saveDraft.
- Descubrimiento: swipe, resetSwipes; reset elimina solo descartes, no guardados.
- Planes: publishPlan, updatePlan (hora/duración), removePlan, leavePlan, jalo,
  invitePeople. publishPlan incluye startsAt, durationMin, joinPolicy, place,
  lateJoin, capacity opcional, photoKey e inviteIds. Capacidad: 2–100 incluido
  anfitrión; máximo 20 invitaciones por operación.
- Eventos: publishEvent, joinEvent, leaveEvent, setPace, approveAttendance,
  rejectAttendance. Incluyen horario, lugar público, alias y organizador real,
  cupo 2–200, lateJoin y requiresApproval. Las solicitudes pendientes no reservan
  horario; la aprobación revalida horario/cupo y adjudica XP una sola vez.
- Invitaciones: respondInvite, aceptada únicamente por su destinatario real.
- Encuentros: quickMessage, verifyTogether, confirmMeet. Verificación individual
  dentro de 100 m del lugar público, desde 30 minutos antes del comienzo hasta
  el fin. No se guardan las coordenadas ni se confirma por la otra persona.
- Cercanos: requestClose, cancelClose, acceptClose, declineClose, removeClose.
- Exacta: startExact (30/60/120/240 min), stopExact, askExact, cancelAskExact,
  declineExactRequest. Pedir no equivale a conceder.
- Perfil: updateName, updateHandle, updateBio, setProfileImage; block, report.

## Privacidad y persistencia

Amistad normal permite ver planes, no la posición personal. Presencia aproximada
requiere cercanía aceptada por ambas personas, ausencia de bloqueos y de modo
fantasma, TTL vigente y ambos radios. La celda se redondea en servidor a 0.002°
antes de Redis normal y antes de la cola/historial. Los mensajes de distancia se
redondean a 50 m. Las coordenadas exactas solo viven en una clave Redis separada
con TTL corto y audiencia explícita vigente. Nunca van a DynamoDB, SQS, historial
ni almacenamiento del navegador. El punto público de un lugar sí puede guardarse.
El modo fantasma revoca concesiones salientes e invalida entrantes por generación,
para que no reaparezcan al desactivarlo. Quitar cercanía, amistad o bloquear
invalida permisos. Las sesiones revocadas tampoco reciben nuevas notificaciones.

DynamoDB social usa `pk/sk`, `data` JSON y versión condicional. Las colecciones
actuales son `plans.v2`, `events.v2`, `matches.v2`, `invites.v2`, `ranking.v2`,
`user#UUID` y `requests#UUID`. Cambios de nombre/usuario/fantasma se confirman en
la misma transacción que perfil, ranking y recibo. Los documentos leídos para
validar horarios, cupos y consentimiento tienen condiciones de versión.

Las cuentas previas se conservan; el consentimiento cercano ausente deniega
ubicación. Los planes/eventos experimentales v1 no se promocionan automáticamente:
carecen del lugar público/horario requerido y podrían contener un centro privado.
Si existe un despliegue con esos datos, necesita inventario y migración explícita
con lugar público confirmado por el organizador antes de activar este contrato.
No se eliminan esos registros.

## Validación y límites

`go test ./...` usa DynamoDB Local y Redis reales (deben estar encendidos;
`testenv` omite pruebas si faltan). Cubre permisos, cancelación, descubrimiento
manual, check-in, XP, asistencia, recibos, edición de perfil, invitaciones,
conflictos de horario y versiones concurrentes. `go run ./scripts/smoke` recorre
HTTP/WebSocket reales. El frontend tiene 130 pruebas unitarias y una suite real
`e2e/integration` para iPhone, Pixel y escritorio; incluye un fallo inducido del
refresco después de una escritura confirmada. Los E2E históricos del mock quedan
como referencia fuera de la suite ejecutable de integración.

No se despliega ni modifica Terraform. SES, carga/lectura real S3/CloudFront,
IAM y API Gateway requieren validar en AWS tras aplicar INFRA_REQUESTS.md.
El mapa base externo CARTO necesita red; las pruebas pueden validar marcadores
sin descargar sus tiles. No hay recordatorios programados. No se implementa
edición/cancelación de eventos porque el frontend recibido no ofrece esas acciones.
Hay un límite de 40 compromisos próximos por usuario y de 100 registros por
transacción DynamoDB; reprogramar grupos grandes puede superar ese límite y se
rechaza sin cambios parciales. El catálogo consulta particiones completas: antes
de volumen alto deberá paginarse/indexarse por zona y fecha.
