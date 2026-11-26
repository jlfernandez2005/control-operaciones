# Auditoría técnica de seguridad — SISFIA 4.2.0

**Alcance:** revisión de código de la versión 4.1.1 y cambios 4.2.0 en autenticación, autorización, entradas, documentos, reportes, auditoría, respaldo y migraciones. Entorno local aislado. No se ejecutaron ataques a producción, no se consultaron credenciales ni se modificó Turso. No constituye auditoría independiente, prueba de penetración completa ni certificación.

| Hallazgo / riesgo | Prioridad | Corrección implementada y estado |
|---|---|---|
| JWT anterior no revocado al cerrar sesión | Alta | Sesiones persistidas por hash de identificador aleatorio, revocación en logout, al cambiar/restablecer clave y al desactivar usuario. Caducidad por inactividad 30 min y absoluta 8 h. Prueba API pendiente. |
| Acceso con solo contraseña a datos laborales | Alta | MFA TOTP por usuario, secreto cifrado, rechazo de reutilización del contador; paso adicional contraseña + TOTP para Planillas, 10 min. MFA no obligatorio aún para toda la plataforma. |
| Intentos de autenticación | Alta | Límite IP existente y bloqueo persistente por empresa/usuario al octavo fallo dentro de 15 min. Paso sensible limitado por usuario. Ajustar proxy y probar en Render. |
| Acceso a planillas por roles generales | Alta | API con permisos por institución, lectura/escritura/exportación diferenciadas; administradores por diseño tienen acceso total con MFA. Usuarios no admin denegados por defecto. |
| Datos laborales en texto claro | Alta | AES-256-GCM por documento y versión, nonce aleatorio, contexto institución/periodo/tipo, clave independiente de JWT. DNI y cuenta completa no persistidos. Pruebas criptográficas locales pasaron. |
| Exposición en descargas y respaldos | Alta | Exportación explícita resumen/detalle, auditoría, respaldos cifrados con clave configurada; restauración de planillas sin sobrescribir. PDF/Excel/CSV autorizados se descargan sin cifrar; proteger dispositivo. Respaldos históricos no se modifican. |
| Cruce entre instituciones | Alta | Todas las nuevas consultas incluyen company_id; permisos y MFA incluyen usuario y empresa; contexto criptográfico vinculado a institución; restauración rechaza otra institución. Pruebas dinámicas de aislamiento en servidor pendientes. |
| Archivos hostiles / denegación de servicio | Alta | Firma de XLS/XLSX, límites de bytes, hojas, filas, columnas, ZIP, macros XLSX rechazadas, proceso sin variables de conexión y límites de tiempo/memoria/CPU. Parser XLS no ejecuta macros; no es antivirus ni sandbox de red/OS completo. |
| Fórmulas maliciosas en informes | Media | Exportación XLSX usa texto literal; CSV protege prefijos de fórmulas. Pruebas con cadenas ficticias. PDF usa escape de texto de origen. |
| CSRF y caché | Media | Controles de origen existentes reforzados para cross-site/same-site, JSON, cookies httpOnly y secure por defecto, no-store en API; service worker solo cachea estáticos, limpieza de vistas al salir. Verificación en proxy pendiente. |
| Auditoría con datos sensibles | Media | Eventos de planilla solo metadatos, auditoría de consultas, exportaciones, permisos, recuperación y cambios. Añadidos registros de exportación de tesorería/flujo/auditoría. Historial de planilla cifrado. Logs históricos financieros no migrados ni se consideran inmutables. |
| Errores y secretos | Media | Mensajes de error del worker de planillas y logs generales no imprimen valores internos. No se incluyen archivos de datos reales, claves ni .env; nuevas reglas .gitignore/.dockerignore. |
| Dependencias y cadena de suministro | Alta, pendiente | No hay lockfile npm existente. Sin red no se pudo ejecutar auditoría actual de dependencias. Se añade CI con pruebas npm, npm audit y pip-audit. Revisar resultados, actualizar dependencias y fijar lockfile en entorno autorizado antes de uso sensible. |
| Datos históricos de operaciones/tesorería en texto claro | Alta, pendiente | No se migraron columnas/tablas previas para no alterar lógica histórica. Verificar cifrado en reposo y acceso en Turso, evaluar migración gradual de datos de estudiantes y cuentas. Permisos previos preservados. |
| Recuperación y rotación de claves | Alta, pendiente | Scripts de recuperación offline y respaldo lógico, pero falta rotación de clave sin pérdida, respaldo completo automatizado externo, prueba de restauración del proveedor, gestión institucional de secretos. |
| Seguridad de infraestructura | Alta, pendiente | Verificar HTTPS, origen, proxy, tokens de Turso con privilegios mínimos, GitHub privado, MFA en GitHub/Render/Turso, políticas de backups, acceso de personal y pruebas dinámicas OWASP. No inspeccionado en vivo. |
| Retención y privacidad | Media, pendiente | Definir plazos de conservación, autorización institucional, purga controlada de archivos y versiones, respuesta a incidentes; revisar obligaciones peruanas con responsable de datos. No hay eliminación definitiva automática de planillas ni historial. |

## Condiciones previas para planillas reales

- Clave independiente configurada y respaldada offline, HTTPS verificado, MFA activado para administradores y usuarios autorizados; no compartir cuentas de administración.
- Ejecutar pruebas de API (incluidas autenticación, revocación, roles, cruce entre empresas e importación de la planilla) en una base de prueba; revisar el flujo de GitHub y corregir vulnerabilidades de dependencias. Revisar todas las rutas de edición y exportación con usuarios distintos.
- Restaurar un respaldo en entorno separado y confirmar que los totales de los módulos anteriores y los nuevos coinciden. Revisar acceso del proveedor Turso y límites de plan, sin exponer credenciales.
- Realizar pruebas de penetración autorizadas y revisión independiente antes de utilizar datos identificables de trabajadores/estudiantes. El cifrado aplicativo no impide la lectura por el propio servidor autorizado o un atacante con acceso simultáneo a servidor y claves.

## Resultado local comprobado

60 pruebas de regresión de versiones previas; 8 pruebas de seguridad y lógica de planillas; 4 pruebas de documentos con datos ficticios. Pruebas sobre una copia XLSX convertida del libro: CALCULO 26 filas, CONSOLIDADO DIC 27, CONSOLIDADA ENERO 10, PRESTAMOS 3, PRESTAMOS (2) 4, Tardanzas 61; las celdas de descuento con error no se convierten en cero. En CALCULO coinciden los tres totales impresos disponibles. Se han omitido los montos reales del documento en esta documentación para evitar su publicación accidental. En CONSOLIDADO DIC existe diferencia de S/ 0.01 por redondeo por fila respecto del total de origen, visible en control de integridad. No se incluye esa información individual ni el libro en el proyecto.
