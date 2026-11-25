# Actualización y migración

## De 3.2 a 3.3
Detén el servicio para actualizar el código, conserva el mismo DB_PATH o URL de Turso y realiza un respaldo completo primero. El inicio crea de forma aditiva la columna `ops.deleted_at` si no existe; no borra operaciones antiguas. Cambia JWT_SECRET para invalidar sesiones anteriores. Cambia las contraseñas antiguas, especialmente si se utilizó la clave predeterminada de versiones anteriores. Revisa los roles y saldos antes de volver a operar. No borres el volumen ni la base de datos.

## Desde v2 (JSON)
Usa una base de ensayo vacía. El script `scripts/migrate-v2-to-v3.js` fue recuperado de un archivo de pruebas mal ubicado. Exporta v2, guarda `respaldo-v2.json`, inicia v3.3, cambia la contraseña temporal y configura `MIGRATION_PASSWORD` en el entorno. Ejecuta `npm run migrate:v2 -- --file respaldo-v2.json --user admin`. El script no es idempotente para operaciones/cajas; no lo ejecutes dos veces sobre la misma base. Los datos no conformes con nuevas validaciones se reportan como fallidos; revisa y concilia cantidades y totales. No se ha probado con un respaldo v2 real.
