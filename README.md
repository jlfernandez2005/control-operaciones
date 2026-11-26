# SISFIA 4.1.1 — Tesorería y cobranza

Nuevo módulo **Bancos e ingresos**: [guía de uso y actualización](docs/TESORERIA-4.1.md). Se mantienen los módulos de 4.0.0 y anteriores.

# SISFIA · Gestión financiera institucional

**Versión 3.7.0** — actualización de SISFIA 3.4 para La Salle Lima. Mantiene Express, Node 22, Turso/libSQL, las cuentas existentes y los módulos anteriores.

## Actualización del servicio Docker en Render (recomendado)

1. Antes de subir el código, realiza un respaldo de la base de datos Turso y conserva una copia de la versión anterior del repositorio. La exportación JSON del administrador es complementaria, no una copia completa de usuarios y auditoría.
2. Extrae el ZIP y reemplaza el contenido del repositorio GitHub existente, en la raíz (no subas el ZIP ni una carpeta contenedora). Asegúrate de subir `Dockerfile`, `package.json`, `server/`, `public/`, `scripts/` y las demás carpetas. Nunca subas `.env`, contraseñas ni tokens. El Dockerfile instala el motor Python de documentos y Poppler automáticamente.
3. En Render, utiliza el servicio Docker existente `control-operaciones-1`, no crees otro. Mantén `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV=production`, `TRUST_PROXY=1` y `COOKIE_SECURE=true`. No regeneres JWT ni la contraseña. Retira `ADMIN_PASS` si ya cambiaste la contraseña de inicio; el sistema no lo necesita para una cuenta existente.
4. Deja que Auto-Deploy publique el commit, o utiliza Manual Deploy → Deploy latest commit una sola vez. Verifica el estado y Logs; el inicio aplica una migración aditiva. No cambies de Docker a Node, porque se requieren dependencias de sistema.
5. Comprueba que puedes ingresar con tu misma cuenta, que están las operaciones y que aparecen los nuevos módulos. Importa un documento pequeño y coteja sus montos con el original antes de cargar todo el año. El dominio de Render no cambia por renombrar la aplicación.

## Importación inteligente de informes (3.5)

- Selecciona PDF con texto, XLSX o CSV y pulsa **Analizar automáticamente**. Reconoce los modelos institucionales de pagos/operaciones y liquidaciones de caja chica (formatos clásico y v2). Los PDF reconocidos se leen por geometría de la tabla de la primera página; se excluyen anexos, recibos, planillas y comprobantes. Si existen otros resúmenes en páginas posteriores, sepáralos en documentos independientes. Los PDF sin formato conocido conservan el modo manual; los escaneados requieren OCR externo. El XLSX reconoce encabezados, celdas combinadas verticales y fechas de título o columna; selecciona las hojas reconocidas de una en una. Otros formatos pueden necesitar asignación manual. No se aceptan XLS antiguos.
- Se conserva la fecha del encabezado del informe, no necesariamente la fecha real de pago; el sistema alerta si no coincide con el nombre del archivo. Confirma el estado de los pagos individualmente o en bloque. No se da por pagado un total a pagar.
- Revisa la tabla compacta, el total del documento y el total a importar. Editar abre un formulario con todos los campos; Excluir y Restaurar actúan en la revisión, no en la base. Puedes añadir filas, aplicar rubros en bloque y cargar otro documento. La diferencia con el total impreso se muestra y se advierte antes de confirmar. No se guardan cambios hasta confirmar.
- Caja chica: detecta número, responsable, fondo, transferencia, fechas y área cuando están presentes. Conserva categorías originales y las normaliza a rubros cuando la correspondencia es clara. Los importes USD son referencia, nunca se agregan al total en soles. El formato antiguo no contiene un área ni un RUC separado; los proveedores se sugieren a partir del texto del comprobante cuando se pueden reconocer. La caja y sus gastos se guardan juntos de forma atómica; una caja con el mismo número de la empresa se rechaza íntegramente, incluso si el PDF tiene otro nombre o anexos distintos. No sobreescribe cajas existentes. Puede corregirse un gasto ya guardado en Caja chica; eliminar gastos requiere administrador.
- Operaciones: conserva cuenta/CCI y número de orden. Los duplicados exactos o coincidentes de fecha, importe, comprobante/RUC/concepto se omiten, incluso si están archivados. Revisa los casos legítimamente idénticos de forma manual. No se almacena el PDF original; conserva sus anexos fuera del sistema. Se registra archivo, referencia e historial. El original no se incluye en este proyecto.
- Límites: 25 MiB, 100 páginas PDF, 3000 filas, 40 columnas, 20 hojas XLSX, 500 filas por lote. Las cajas se importan completas (hasta 500 gastos); excluye filas erróneas antes de guardar. Excel requiere valores calculados previamente. Los archivos XLSX con más de 20 MiB descomprimidos se rechazan para proteger la memoria. Montos PEN positivos, dos decimales. No se convierte moneda. El Dockerfile usa Node 22 en Debian slim para facilitar las dependencias PDF; no hay que cambiar el tipo de servicio Docker en Render.

## Rubros y reportes

Sugerencias por reglas de palabras clave, editables; no se utiliza IA externa ni se envían documentos a un proveedor externo de IA. Los casos ambiguos quedan sin clasificar. Puedes asignar categorías nuevas, corregir operaciones anteriores y clasificar grupos de hasta 500 registros. Los roles administrador/editor pueden importar y clasificar; lector consulta y exporta reportes de su empresa. Los reportes separan operaciones y caja chica para evitar doble conteo; no suman fondos asignados como gasto. Distinguen importes pagados de pendientes. Agrupaciones por rubro, rubro y mes/año, periodo, proveedor, estado, banco, tipo, origen y área/caja (según origen). Filtros de fecha, rubro, estado y búsqueda. PDF: agrupación elegida y detalle (máximo 2000 registros); Excel XLSX: resumen, pestañas por todas las agrupaciones aplicables y detalle (máximo 10000 registros por consulta). Exportaciones se recalculan con los filtros seleccionados; si se modificaron registros después de abrir la vista, el resultado podría diferir de la vista anterior.

## Desarrollo local

Instala Node.js 22, Python 3 y Poppler (`pdftotext`, `pdfinfo`) y ejecuta:

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-finance.txt
export FINANCE_PYTHON="$PWD/.venv/bin/python"
npm install
# Copia .env.example a .env y configura tus secretos de prueba.
npm run db:seed
npm start
```

En Windows usa `.venv\Scripts\python.exe` como FINANCE_PYTHON y agrega Poppler al PATH. Para una base nueva, ADMIN_PASS temporal de 12 caracteres como mínimo (máximo 72 bytes). Para una existente, no cambies sus contraseñas. La migración agrega columnas de clasificación y origen y una tabla de importaciones sin borrar las tablas anteriores.

## Verificaciones

`npm run test:static`, `npm run test:documents` (con las dependencias de Python en el intérprete activo), `npm test`, `npm run test:e2e`. Se ejecutaron pruebas estáticas de Node, pruebas reales del motor PDF/XLSX/CSV con archivos sintéticos, migración y deduplicación SQLite y flujo de navegador con API simulada. En 3.5 se probaron los seis PDF aportados, un Excel sintético con celdas combinadas, duplicidad de caja mediante SQLite, edición y exclusión con Chromium y API simulada. No se ejecutaron pruebas completas del servidor ni despliegue real en Docker/Turso. No se realizó una auditoría nueva de dependencias. Verificar `npm audit` antes de producción, sin forzar cambios de versiones. La versión 3.3 reportó una vulnerabilidad alta sin identificar en los logs previos; esta entrega no certifica su resolución.

## Presupuesto e importación simplificada (3.6.0)
Al seleccionar el archivo se analiza automáticamente. Las filas válidas se seleccionan de inicio, hasta 500; las operaciones sin estado comprobable quedan Pendiente. Guardar registra las filas seleccionadas, solicitando confirmación adicional solo si el total impreso difiere. Salir al inicio descarta una revisión no guardada tras confirmar. Los informes mensuales ya incluidos pueden guardarse como referencia sin crear operaciones. Los títulos que contienen resumen/consolidado mensual o anual bloquean la importación como operación por precaución; para referencias anuales usa los totales de cada mes por separado.

El nuevo módulo Presupuesto crea metas mensuales por rubro y consolida el año, con un promedio histórico configurable por meses elegidos y ajuste porcentual. Los meses históricos pueden ser incompletos: el usuario debe elegirlos y validar la propuesta. El plan no se guarda automáticamente. Los gastos registrados se toman de operaciones activas, pagadas y pendientes, no de una suma de operaciones + caja. La caja chica vinculada a una transferencia por orden y fondo exactos (o vínculo manual) redistribuye la operación por sus rubros, en el mes de la transferencia; las cajas sin vínculo o con exceso no se suman y aparecen en conciliación. Los informes mensuales acumulados se guardan solo como referencia, una por mes, y muestran diferencia contra operaciones. Las tablas de presupuesto se agregan sin modificar registros previos. La detección de duplicados no puede identificar todos los solapamientos de informes con fechas o conceptos diferentes. No importar resúmenes acumulados como movimientos.

El límite de archivo sube a 25 MiB (se conserva el máximo de 100 páginas PDF, 3000 filas, 500 filas por lote y 20 MiB XLSX descomprimido). Se procesa una tarea de documentos a la vez, con máximo 90 segundos; no se garantiza que cualquier PDF de 25 MiB pueda procesarse con la memoria disponible de Render. Los PDF escaneados o de varias tablas resumen requieren preparación previa.

### Corrección 3.6.1
Reconoce setiembre y septiembre; conserva ítems numerados con fechas inválidas para revisión, usa la numeración original, advierte discrepancias del periodo y bloquea el guardado de caja si la suma no coincide con el total impreso informado. Si ya existe una caja parcial, revisa y corrige esa caja; no se sobreescribe al reimportar. No requiere migración adicional respecto a 3.6.0.

### 3.6.2: lectura adaptable
Reconocimiento por encabezados de operaciones PDF con tablas, Excel y CSV. Las columnas pueden cambiar de orden y las opcionales pueden faltar. Se admite USD como referencia original: antes de guardar, confirma el monto equivalente en PEN en cada fila con USD. No se realiza conversión automática ni se mezclan monedas en los presupuestos. La base recibe una columna aditiva `ops.usd_reference`. Los PDF con formatos no tabulares o sin texto todavía requieren revisión o conversión. Se interpreta la tabla resumen de la primera página, no los anexos.

### 3.6.3: informes de pagos con liquidaciones anexas
- Reconoce gastos con fecha, concepto e importe aunque falte el número de ítem.
- En PDF de pagos, revisa hasta las primeras 20 páginas para localizar liquidaciones anexas. Muestra el detalle en modo de consulta, con conciliación por orden y fondo. No lo importa como gasto adicional ni modifica el presupuesto.
- Si una liquidación requiere vinculación, comprueba su identificador y los importes antes de cargarla por separado.

### 3.6.4: carga directa y corrección de caja chica
Arrastra un archivo a la zona de carga o selecciónalo. Si la suma no coincide con el total impreso, verifica cada gasto y usa **Usar suma de gastos** o introduce el total corregido; el motivo se conserva en auditoría. El total corregido debe ser igual a la suma del detalle. El fondo es editable e independiente. Si los gastos exceden el fondo, el presupuesto mantiene su control de conciliación y no suma ese exceso automáticamente. No requiere migración.

### 3.6.5: resumen mensual de operaciones
Arrastra un PDF de resumen mensual (por ejemplo RESUMEN DE OPERACIONES - ENERO 2026) o su versión Excel/CSV. El encabezado identifica mes y año; se reconocen las columnas concepto, fecha y monto. Revisa las filas editables y pulsa Guardar resumen mensual. El sistema guarda una referencia por empresa y mes; una nueva carga del mismo mes la reemplaza tras confirmación. Presupuesto muestra el consolidado, la suma registrada y sus diferencias por día y por mes. La proyección histórica utiliza el detalle existente y el faltante del resumen como rubro pendiente de desglose; no crea gastos ni acredita pagos. La conciliación por fecha es una comparación de importes, no una confirmación bancaria.
La migración agrega dos columnas a budget_month_refs de forma idempotente. Respalda la base antes de desplegar.

### 3.6.6: directorio automático
El directorio se deriva en cada consulta de las operaciones activas, gastos de caja y fichas manuales de la empresa. No requiere migración ni duplica gastos. Agrupa RUC/DNI por formato, conserva nombres alternativos, separa nombres sin identificación y distingue beneficiarios de proveedores consignados. Las cuentas históricas son solo referencias; nunca se utilizan para autocompletar pagos. El sistema no verifica identidad fiscal ni titularidad bancaria. Las fichas manuales existentes se conservan.

### 3.6.7: panel anual y familias de gasto
- Ancho completo con márgenes funcionales, navegación adaptable y panel con indicadores de operaciones, pagos, directorio y cajas. El selector de periodo cambia el año y el mes; el botón Mes actual usa America/Lima. Último mes con operaciones permite analizar registros históricos.
- El gráfico anual compara operaciones con referencias mensuales sin sumarlas. El desglose de cajas vinculadas solo redistribuye el fondo; caja no vinculada, préstamos y devoluciones se presentan como movimientos por conciliar. Los totales son montos de operaciones registradas, no gastos contables devengados certificados.
- Las familias agrupan los rubros históricos sin actualizar los registros originales. Los rubros sin clasificar pueden mostrar una familia sugerida por el concepto. Los rubros existentes personalizados desconocidos quedan en Otros / por revisar. Las reglas nuevas se aplican a importaciones y registros nuevos con rubro vacío; las sugerencias históricas pueden aplicarse desde Rubros y reportes. Presupuesto conserva las partidas originales.
- Reportes: Familia de gasto, Familia y rubro, Rubro individual; exportación PDF/XLSX con agrupaciones. El panel usa el desglose conciliado de Presupuesto, mientras que Rubros y reportes muestra los registros de cada origen por separado.
- No hay cambios de esquema ni de credenciales. Respaldar antes de desplegar y comprobar el panel en producción. Pruebas de navegador bloqueadas por política del entorno; las pruebas estáticas y del modelo no equivalen a una validación de producción.

### 3.6.8: reportes completos
El gráfico de Rubros y reportes muestra todos los grupos devueltos por el análisis, con contador visible. Se mantienen los filtros, las exportaciones y las protecciones de datos anteriores. No requiere migración.

### 3.6.9: detalle y edición
Las cinco tarjetas de Resumen mensual abren el detalle correspondiente. Los conceptos en Inicio, Registro, Resumen, Rubros y reportes y Caja chica abren un editor común; lector consulta sin editar. Se actualizan los indicadores tras guardar mediante las rutas PUT existentes. No requiere migraciones.

## Conciliación mensual (3.7.0)
Desde Inicio o Resumen pulsa Conciliación. Se conserva el total de operaciones y el resumen mensual por separado. SUNAT explícito en el detalle mensual se sugiere si no se detecta un pago ya registrado y el importe del día lo permite; confirma que no haya otro pago con fecha o descripción distinta. Registrar SUNAT solicita el estado y crea una sola operación en una transacción con auditoría. La diferencia ajustada es registrado más SUNAT sugerido menos referencia. Los faltantes y excesos por fecha no se compensan. La coincidencia de importes no prueba identidad ni pago; revisa posibles duplicados, informes incompletos y fechas. El periodo fiscal se extrae del concepto si figura. Las proyecciones incluyen SUNAT sugerido como tributos, no como gasto real, y mantienen el resto pendiente de desglose. No requiere migración de esquema.

### Registro mensual SUNAT (3.7.1)
En Inicio, Resumen mensual o Presupuesto, pulsa **Registrar SUNAT**. Si hay una sugerencia en el resumen del mes, puedes seleccionarla. Si no, ingresa fecha efectiva, periodo tributario, importe, estado y banco/medio; el comprobante es opcional. Solo marca Pagado si corresponde. Se guarda una operación de rubro Tributos y tasas y se actualizan los totales; no se altera el resumen mensual. Si ya existe el pago, edita el registro anterior. No requiere cambios de esquema.


### Resumen de operaciones (3.7.2)

El menú **Resumen de operaciones** permite consultar los doce meses de un año y editar o eliminar los resúmenes guardados. El administrador y el editor pueden modificar las filas; únicamente el administrador puede eliminar una referencia mensual. La eliminación no afecta a operaciones, pagos SUNAT ni caja chica. El total se recalcula a partir de las filas si existe detalle. Las versiones anteriores de la referencia se conservan en auditoría. El periodo de una referencia existente permanece fijo: para corregirlo se debe registrar el mes correcto y eliminar el equivocado. Los informes anteriores se conservan en la base y no requieren reimportación.

Los PDF y Excel de resúmenes, rubros y presupuesto comparten formato institucional. Los resúmenes exportados incluyen el total impreso, el registrado, las diferencias y, cuando está disponible, la conciliación diaria. La exportación del detalle mensual usa los filtros seleccionados.

Pruebas adicionales: `python3 tests/reference-management_test.py`.

### Flujo de caja institucional 4.0
Ver [guía de flujo de caja](docs/FLUJO-CAJA-4.0.md).

## Conciliación entre fechas
Consulta [la guía de la versión 4.1.1](docs/CONCILIACION-FECHAS-4.1.1.md).
