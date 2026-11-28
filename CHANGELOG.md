# 5.2.2 — Candidato de seguridad

- Zod 4.6.7 exacto y adaptación de los dos esquemas de diccionario de flujo.
- Límites de complejidad JSON previos a validación y máximo 20 errores devueltos.
- Sin cambios en la base de datos. Requiere generar package-lock.json y superar auditorías y pruebas antes de desplegar.

# 5.2.1 — Corrección de arranque en Turso

- El inicializador omite comentarios SQL y respeta literales entrecomillados.
- Pruebas de regresión de ejecución individual y migración repetible con datos.
- No cambia el esquema, las credenciales ni las operaciones.

# 5.2.0 — Operaciones diarias

- Registro de lotes de pagos en `ops` con idempotencia, validación, posibles duplicados y auditoría.
- Consulta por fechas y exportación institucional PDF/Excel; ambos logos y ADN del modelo.
- Navegación 5.1.0 conservada; nuevo acceso desde Operaciones y Centro de reportes.
- Una tabla aditiva `daily_batches`, compatible con respaldos previos.

## 5.1.0 — Navegación ERP y MFA
- Menú desplegable, buscador, modo compacto y vistas específicas de administración y planillas.
- Formularios específicos y paneles de indicadores; QR local de MFA, regeneración y cuenta regresiva.
- Corrección de accesos directos heredados. Sin cambios SQL.

## 5.0.1 — Navegación institucional

- Menú agrupado, iconos, selección visible y desplazamiento vertical sin columnas accidentales.
- Auditoría y Usuarios conservan las restricciones originales; menú adaptable a pantallas estrechas.
- Sin cambios de esquema ni de API.

## 5.0.0 — candidata a validación

- Gestión administrativa: compras, obligaciones, activos, centros de costos, documentos cifrados.
- Cierre/reapertura mensual con triggers de protección y auditoría.
- Vínculos bancarios individuales y transferencias, sin duplicar movimientos.
- Permisos de ERP y Tesorería y política opcional de MFA obligatorio.
- Simulador laboral parametrizado y ficha individual confidencial PDF.
- Respaldo compatible con 4.2.2, incluye las tablas nuevas.
- Validación de API/Render/Turso y auditoría de dependencias pendientes.

# 4.2.2
- Cifrado aplicativo de nuevos documentos de tesorería, seudónimo de cuenta y lectura de legado.
- Migración controlada, rotación de clave de almacenamiento y validación de claves al iniciar.
- Respaldo lógico completo cifrado, restauración de prueba local y script de programación externa.
- Respaldo web sin texto claro, MFA reciente y auditoría de consultas de tesorería.
- Pruebas locales; verificación de servidor y dependencias pendiente.

## 4.1.1
- Conciliación reversible de fechas dentro del mismo mes, con sugerencias de coincidencias y selección manual.
- Evidencia bancaria por cuenta y fecha; conservación de fechas originales y control de vínculos obsoletos.
- Vínculos incluidos en presupuesto, flujo, comparación bancaria, exportaciones y respaldo.

## 4.1.0

- Archivo de estados bancarios y cobranza por cuenta/mes; importación automática de los cuatro formatos PDF.
- Consulta unificada por fuentes independientes, conciliación diaria/mensual, categorías y reportes PDF/XLSX.
- Incorporación reversible de Sallenet al flujo de caja y protección contra duplicados.
- Acceso restringido, auditoría y respaldo; migración aditiva.

## 3.7.2

- Nuevo módulo Resumen de operaciones: consulta anual, registro manual, edición de filas y eliminación por administrador, con trazabilidad y control de concurrencia.
- Exportación individual de resúmenes en PDF y Excel con conciliación.
- Exportaciones desde Detalle mensual y diseño institucional común para informes financieros y presupuestarios.
- Accesos directos desde Inicio, Presupuesto y el importador.
- Sin migraciones adicionales de tablas.

## 3.7.1
- Registro dedicado de SUNAT desde Inicio, Resumen y Presupuesto; sugerencias desde la referencia, fecha efectiva y periodo fiscal independiente.
- Validación de duplicados por comprobante, fecha e importe, con auditoría y actualización de los totales.

## 3.7.0 — Conciliación mensual y pagos directos SUNAT

- Conciliación por fecha, faltantes y excesos separados, posibles duplicados.
- SUNAT explícito en referencia: sugerencia y registro confirmado, sin duplicar el resumen ni caja chica.
- Acceso a edición de operaciones y exportaciones de conciliación.

## 3.6.6
- Directorio automático de proveedores y beneficiarios basado en operaciones y caja chica; filtros, paginación, alertas y autocompletado de nombres por identificación no ambigua. Sin migración de datos.

## 3.6.5
- Importación de resúmenes mensuales por encabezado, fechas y total. Una referencia por mes, sin duplicar operaciones. Conciliación diaria y proyección con faltante pendiente de desglose.

## 3.6.4
- Zona de arrastrar y soltar PDF, XLSX y CSV; análisis automático de un informe a la vez.
- Caja chica: total corregible y diferencias justificadas; fondo independiente, saldo disponible o por reembolsar.
- Auditoría conserva total impreso, total confirmado, fondo original, fondo revisado y diferencia. Sin migración de base de datos.

## 3.6.3
- Lectura de gastos sin número de ítem; detección informativa de liquidaciones anexas con control de orden, fondo y diferencia.
- Pruebas con pagos agrupados y anexos sin duplicar operaciones.

## 3.6.2
- Reconocimiento semántico de columnas, posiciones variables y montos PEN/USD.
- Confirmación de equivalentes en soles y almacenamiento de USD de referencia.

## 3.6.1
- Corrige la lectura de setiembre, conserva la numeración real y valida periodos y totales de caja chica.
- Prueba de regresión con el informe 011-2026 (37 gastos, S/ 1,500.00); no se incluyen documentos originales.

## 3.6.0
- Importación automática al seleccionar, estado Pendiente por defecto, guardado directo, salida visible y herramientas avanzadas plegables.
- Límite de archivo 25 MiB, procesamiento individual y timeout de 90 s.
- Presupuesto mensual/anual editable, propuesta histórica, conciliación caja y referencias de informes mensuales. Exportaciones PDF y XLSX.

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

## 3.6.7
- Clasificación por familias y rubros, reglas ampliadas a partir del catálogo observado.
- Panel anual/mensual, comparativo de resúmenes, pagos, presupuesto y cajas por conciliar.
- Diseño a todo el ancho disponible, adaptable a móvil.
- Sin migración destructiva; conserva el directorio de 3.6.6 y los datos históricos.

## 3.6.8
- Elimina el límite visual de 12 grupos en Rubros y reportes; muestra todos los rubros y agrupaciones del periodo.
- Contador de grupos visibles, incluidos resultados vacíos.
- Actualización de caché PWA; sin cambios en la base de datos.
- Pruebas de regresión de gráfico, tabla y exportaciones con 34 grupos.

## 3.6.9
- Detalle mensual navegable por indicador, búsqueda y paginación.
- Editor común de operaciones y gastos con actualización de vistas y permisos existentes.

## 4.0.0
- Flujo de caja institucional La Salle, 20 partidas, proyección histórica, ingresos y movimientos adicionales, clasificación, conciliación y exportación al formato adjunto.

## 4.2.0
- Identidad visual institucional Colegio Hermano Noé Zevallos / SISFIA.
- Planillas y personal, importación selectiva XLS/XLSX/CSV, registros auxiliares, historial cifrado, consultas y exportaciones.
- Conciliación de depósitos y propuesta para borrador de presupuesto, sin generar operaciones duplicadas.
- MFA TOTP, sesiones revocables, bloqueo por intentos, permisos independientes y respaldo cifrado.
- Migración aditiva; ver `docs/PLANILLAS-4.2.md` y `docs/AUDITORIA-SEGURIDAD-4.2.md` para instalación y limitaciones.

## 4.2.1
- Validación de saldos contables diferenciada de conceptos de pago de saldos.
- Sugerencias mejoradas para devoluciones, almuerzos, agua y liquidaciones laborales.
- Mensajes específicos de bloqueo de importación y nueva versión de caché.
- Sin cambios de esquema ni de registros históricos.
