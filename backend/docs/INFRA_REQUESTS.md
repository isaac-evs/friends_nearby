# Infraestructura pendiente para integrar ¿Jalas?

No se modificó `infra/`. `origin/main` ya incluye runtime Go, bootstrap y
JWT_SECRET. Esta lista corresponde a la ampliación del backend para el frontend.

## Tabla DynamoDB social

Crear una tabla con partition key `pk` (String), sort key `sk` (String),
PAY_PER_REQUEST, sin GSI. Pasar el nombre a Lambda API como `SOCIAL_TABLE`.
Si se omite, el código usa `${USERS_TABLE}-social`; en AWS **no crea la tabla**.
El runner local sí la crea.

Dar al rol API GetItem, PutItem, UpdateItem, DeleteItem, Query y ConditionCheckItem sobre su ARN.
Hay transacciones entre la tabla social y users; se autorizan por las operaciones
de los items. No se necesita Scan ni acceso del worker a la tabla social.

Guarda perfiles/preferencias/progreso, planes programados, eventos/asistencias,
matches/referencias, reportes y tokens de recuperación. El atributo numérico
`version` permite escrituras condicionales. Las expiraciones se verifican en
código; no requieren TTL para proteger la vigencia. Configurar TTL sobre el atributo raíz numérico `expires_at` para limpiar recibos
de acciones (`requests#UUID`, 24 h). Las fechas de planes/eventos y permisos se
validan en código; no configurar TTL sobre campos anidados. Otros documentos
requieren una política futura de retención/limpieza. No se necesita TTL para
autorizar una operación correctamente.

## Recuperación de contraseña por SES

Variables nuevas en Lambda API:

```text
MAIL_FROM=cuentas@<dominio-verificado>
FRONTEND_URL=https://<dominio-del-frontend>
```

- Verificar identidad SES en la región de Lambda.
- Otorgar `ses:SendEmail`, limitado al ARN de esa identidad.
- Habilitar envío a destinatarios no verificados cuando corresponda; considerar
  las restricciones del sandbox de SES al probar.
- El adaptador usa SES **HTTPS Query API**, SigV4, contra
  `https://email.<region>.amazonaws.com/`. La VPC actual sin NAT necesita salida
  HTTPS hacia ese endpoint, por ejemplo NAT y su ruta. Un endpoint SMTP no sirve
  para este adaptador HTTP. El worker actual sigue dedicado al historial.
- Aplicar throttling a auth y recuperación. Hay espera de 3 minutos por correo
  en el código, pero no sustituye límites de tráfico por origen.

Los enlaces caducan en 30 minutos y se consumen una vez. El reset incrementa
`session_version` en users y revoca JWT/conexiones anteriores. Este nuevo atributo
no requiere migración de schema; las cuentas existentes usan versión 0.

## Hosting y configuración web

- Publicar `frontend/dist/` con HTTPS y fallback SPA a index.html para las rutas
  de eventos, matches, perfiles y recuperación.
- Build con VITE_API_URL/VITE_WS_URL a partir de http_api_url/websocket_url.
  Ningún secreto debe ir en VITE_*.
- CORS HTTP y S3 media deben admitir los orígenes publicados; S3, PUT con
  Content-Type. CloudFront debe servir photos/<user_id>/<archivo> desde la raíz.
- Reconstruir las Lambdas con los scripts existentes antes del despliegue.

Conservar provided.al2023, bootstrap, x86_64, JWT_SECRET estable, REDIS_HOST sin
puerto y TLS compatible, WS_MANAGEMENT_URL con HTTPS/stage y $connect sin
authorizer externo. Las rutas WS actuales bastan: nearby y ping van por $default.
No hacen falta Cognito ni índices de email/username.

No se ejecutó Terraform ni se validó AWS. SES, S3/CloudFront, API Gateway y sus
permisos requieren comprobación en ese entorno después de aplicar estos cambios.

## Contrato G1–G4 y migración

Las nuevas colecciones sociales `.v2` usan la misma tabla, sin índices nuevos.
Conservar datos de users/friendships. No migrar automáticamente planes/eventos
experimentales `.v1`: el frontend nuevo exige lugar público confirmado y horarios.
Ver el procedimiento y las restricciones en FRONTEND_INTEGRATION.md.

Redis debe admitir claves `exact:<UUID>` de TTL corto para concesiones explícitas;
no requiere recursos nuevos ni persistencia adicional. Historial SQS/S3 recibe
únicamente celdas aproximadas; no configurar un flujo de coordenadas exactas.
Los radios actuales de la aplicación se guardan en el perfil social; no requieren
cambiar esquemas de users ni nuevos GSI. El registro `ranking.v2` es una proyección
pública actualizada por transacción.
