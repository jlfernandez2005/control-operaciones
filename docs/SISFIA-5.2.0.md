# SISFIA 5.2.0 — Operaciones diarias y centro de reportes

## Actualización

La base es 5.1.0 con su menú ERP, formularios especializados y QR de MFA. El parche acumulativo se calcula contra 5.0.0: se puede aplicar a 5.0.0, 5.0.1 o 5.1.0. Conservar rutas, claves, conexión Turso y carpeta `.git`. No copiar documentos de ejemplo ni respaldos a GitHub. Probar primero en la rama `ssisfia-pruebas-v5`, con el servicio Render independiente conectado a `sisfia-sandbox-v5` (datos ficticios). Antes de producción, verificar respaldos, migración y seguridad.

## Flujo de registro

1. Operaciones financieras → Operaciones del día. Seleccionar fecha, agregar filas manuales o precargar proveedor existente. Concepto, importe y banco obligatorios; RUC/DNI opcional, 8/11 dígitos si se introduce; cuenta como texto, admite CCI o descripción. Rubro vacío se sugiere en el servidor. 100 filas máximo.
2. Pendiente es una obligación por pagar; Pagado requiere que el usuario confirme que ya se abonó externamente. No se efectúan pagos ni transferencias desde SISFIA.
3. Guardar operaciones: inserción transaccional en `ops`; `daily_batches` contiene solo metadatos, huella y referencias a operaciones, no otra fuente de egresos. El identificador de solicitud evita duplicar al reintentar el mismo lote mientras la pestaña se conserva. Coincidencias por fecha, concepto, importe, documento y beneficiario requieren confirmación explícita. No se eliminan pagos por coincidencia.
4. El borrador aún no guardado solo reside en memoria de esa pestaña; no usar el navegador como archivo. Las operaciones guardadas se editan/archivan/restauran desde el Registro de operaciones y quedan sujetas a cierre financiero.
5. Centro de reportes → Reportes diarios y por fecha. Filtros por fecha, estado, banco, rubro, tipo, beneficiario y búsqueda. Hoy, semana (lunes a domingo) y mes. Hasta 366 días entre fechas, 5000 filas en consulta, 1500 por exportación. Historial de lotes (hasta 500 por rango); los reportes muestran el estado vigente de las operaciones vinculadas, incluso si posteriormente se modifican o archivan. Para conservar un documento fijo, descargarlo y archivarlo privadamente al emitirlo; no existe versionado inmutable del PDF en esta entrega.
6. Descargar PDF o Excel o Imprimir (abre el PDF en el visor, desde allí se imprime). Formato diario A4 apaisado, ocho columnas del modelo, total azul; si se mezclan estados o fechas se incluyen fecha y estado. Se muestran los logos aportados de La Salle, SISFIA y ADN lasallista. Los archivos de ejemplo solo usan datos ficticios.

## Seguridad y conservación de registros

- Lectura autenticada y por institución. Alta solo admin/editor. Cuentas y RUC/DNI se enmascaran en la consulta y exportación nuevas, salvo admin/editor con MFA y desbloqueo reciente desde Seguridad (para el editor se necesita además acceso a planillas o administración que habilite el desbloqueo). No implica que otras rutas históricas ya enmascaren esos campos. Esta entrega no cambia la política de permisos previa de los demás módulos.
- Sin borrados ni reemplazos de tablas. Se añade `daily_batches` con `CREATE TABLE IF NOT EXISTS` y un índice. Respaldos completos actualizados para incluirla y leer respaldos anteriores de 20 y 28 tablas; respaldo JSON general incluye metadatos de lotes. La restauración de producción todavía debe probarse contra una copia independiente.
- El servidor calcula importes y filtros; no confía en los totales de la interfaz. Exportación con registro de auditoría. Excel trata las cadenas como texto literal, incluso las que empiezan por `=`. Los archivos PDF/Excel ya descargados deben protegerse fuera de SISFIA.
- El reporte por fecha consulta `ops` (manuales e importadas), no vuelve a sumar referencias mensuales ni detalles de caja chica. No sustituye los reportes especializados de bancos, planillas, caja chica o presupuesto.

## Verificación

Ejecutar `npm run test:daily`, los scripts de regresión del package y `npm test` con dependencias instaladas. El flujo GitHub Actions incluye los nuevos tests. Antes de publicar en main, ejecutar en sandbox: guardar dos pagos ficticios pendientes, imprimir PDF, verificar Excel y total, repetir la solicitud, revisar historial, probar filtros y MFA, editar desde Registro, cerrar/reabrir mes y comprobar datos históricos en copia. No se ejecutaron migraciones en Turso real ni despliegues desde esta entrega.
