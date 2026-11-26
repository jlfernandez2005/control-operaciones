# Migración 3.3 → SISFIA 3.4

La migración ejecutada al iniciar agrega `category`, `provider_name`, `import_batch`, `source_file`, `source_ref` a `ops` y crea `import_batches` e índices. No elimina ni reemplaza las cuentas, hashes de contraseña, empresas, operaciones, proveedores ni cajas. Las operaciones existentes empiezan en Sin clasificar; se pueden clasificar por lotes. Las categorías de caja chica existentes se conservan. Si ya existen columnas, no se vuelven a agregar.

Para volver al código 3.3, redepliega el commit anterior, dejando la estructura nueva en la base. No borres columnas: las clasificaciones e historial nuevo dejarían de estar accesibles desde el código antiguo. Haz respaldo de Turso antes de la migración y prueba primero con datos no críticos. En Render se detiene el arranque si faltan las credenciales de Turso, para no terminar utilizando accidentalmente una base efímera.

Las reglas de deduplicación son conservadoras y no representan una conciliación bancaria. Se ignoran coincidencias con el mismo RUC, comprobante, fecha e importe cuando ambos identificadores están presentes; si no están, se utiliza además el concepto. No se garantiza detectar comprobantes que cambian de fecha, formato o denominación. No importes datos agregados ni documentos redundantes sin reconciliar. Revisa los omitidos.
