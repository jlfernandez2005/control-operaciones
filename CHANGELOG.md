## 3.5.2 · Identidad oficial SISFIA

- Logo oficial proporcionado por el usuario, con emblema para iconos y favicon.
- Acceso y cabecera adaptables, contraste en modo oscuro e indicador de comprobación de sesión.
- Renovación de caché PWA. Se conservan módulos y migraciones de 3.5.0.

## 3.5.0 · Importación inteligente

- PDF por geometría de celdas: resumen institucional de pagos, operaciones y caja chica clásica/v2; anexos excluidos.
- XLSX/CSV por encabezados y fechas, con celdas verticales combinadas en XLSX.
- Revisión compacta, edición modal, exclusión reversible, añadir filas, carga de otro informe y estados en bloque.
- Caja chica atómica con control de número duplicado, origen, categoría original y USD de referencia.
- Cuenta/CCI y orden persistidos en operaciones; edición de gastos de caja registrados. Migraciones aditivas.
- Pruebas: seis PDF reales con totales coincidentes, regresiones de moneda/Excel/SQLite, pruebas estáticas y navegación simulada.

# Cambios

## 3.3.0
- Corrección de autenticación y acceso a datos; inicio ordenado y SQLite/Turso configurable.
- Edición, archivo y recuperación de operaciones; caja chica y filtros.
- Roles, restablecimiento de claves, protección de datos y exportaciones.
- Interfaz responsive, PWA y documentación.
- Pruebas estáticas ejecutadas; integración pendiente de dependencias.

## 3.4.0 · SISFIA
- Identidad SISFIA e iconos PWA.
- Importación de XLSX/CSV/PDF con texto, mapeo, revisión, deduplicación y trazabilidad.
- Rubros personalizables y clasificación masiva.
- Reportes filtrables, agrupaciones y exportación PDF/XLSX.
- Migración aditiva y motor de documentos integrado en Docker.
