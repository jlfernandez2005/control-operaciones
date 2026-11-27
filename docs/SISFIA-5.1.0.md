# SISFIA 5.1.0 — Arquitectura visual y acceso seguro

Actualización acumulativa de 5.0.0/5.0.1. No cambia el esquema SQL ni los cálculos financieros, y no importa, borra ni migra datos por sí misma. Los accesos secundarios conservan las rutas API y las comprobaciones de permisos originales. La navegación distingue 10 categorías y 15 destinos canónicos, con accesos específicos a vistas que reutilizan los componentes existentes.

## Instalación
1. Con GitHub Desktop en la rama `ssisfia-pruebas-v5`, copia **todo** el contenido del parche descomprimido dentro del repositorio, conservando sus rutas. Acepta sustituir los archivos. No borres `.git` ni cambies las variables de Render.
2. Commit y Push origin. En el servicio de pruebas de Render, Manual Deploy > Deploy latest commit. Confirma que la conexión sigue apuntando al sandbox vacío. No fusiones main antes de validar.
3. Recarga la aplicación. El service worker cambia su versión de caché. Si el menú anterior persiste, recarga con Ctrl+F5 y confirma la versión en el pie.

## Alcance
- Compras, obligaciones, activos, centros y documentos usan vistas filtradas y formularios con campos pertinentes, con indicadores propios. Los registros históricos y las transiciones de estado se conservan. Los informes administrativos siguen siendo integrales por periodo; se informa expresamente en pantalla. No son informes filtrados por tipo.
- Planillas: accesos a consulta, trabajadores, importación, conceptos, simulación, conciliación y respaldo. Se conservan los permisos de lectura/escritura/exportación y el bloqueo con MFA. Los accesos no constituyen nuevos registros laborales maestros.
- QR de TOTP generado localmente con ReportLab, sin servicios externos; si el motor documental está ocupado o falla, permanece la configuración manual. El QR y la clave se retiran de la interfaz al cerrar el diálogo. Cada regeneración invalida la configuración pendiente anterior. Los códigos caducados e incorrectos se distinguen; no se cambia el algoritmo TOTP ni se habilita un bypass. Si una clave de configuración fue compartida en una captura, debe regenerarse antes de activarla. No compartir QR, clave, token o contraseña.
- El flujo de recuperación sin conexión `scripts/recover-mfa.js` existente conserva su uso exclusivo por el custodio autorizado. No se agregan códigos de recuperación de autoservicio ni mecanismos de evasión de MFA. La recuperación requiere validar identidad y acceso administrativo a la base. No subir archivos con credenciales a GitHub.
- Se corrige el cierre prematuro de la función de ámbito de app.js, que dejaba varios accesos y exportaciones sin asociar.

## Pendientes
No se implementan órdenes de compra con múltiples ítems/cotizaciones, kardex, un directorio maestro independiente de trabajadores, cálculo legal laboral, boletas oficiales, reportes administrativos por tipo, permisos distintos para cada vista ERP (se conserva el permiso de Administración), códigos de recuperación de autoservicio ni una auditoría de penetración. Cifrado histórico adicional, respaldo externo y pruebas reales de Turso permanecen pendientes. La actualización no elimina ni modifica los datos originales. El despliegue de producción requiere respaldo y verificación en entorno separado.
