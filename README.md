# SISFIA · Gestión financiera institucional

**Versión 3.4.0** — actualización de Control de Operaciones 3.3 para La Salle Lima. Mantiene Express, Node 22, Turso/libSQL, las cuentas existentes y los módulos anteriores.

## Actualización del servicio Docker en Render (recomendado)

1. Antes de subir el código, realiza un respaldo de la base de datos Turso y conserva una copia de la versión anterior del repositorio. La exportación JSON del administrador es complementaria, no una copia completa de usuarios y auditoría.
2. Extrae el ZIP y reemplaza el contenido del repositorio GitHub existente, en la raíz (no subas el ZIP ni una carpeta contenedora). Asegúrate de subir `Dockerfile`, `package.json`, `server/`, `public/`, `scripts/` y las demás carpetas. Nunca subas `.env`, contraseñas ni tokens. El Dockerfile instala el motor Python de documentos y Poppler automáticamente.
3. En Render, utiliza el servicio Docker existente `control-operaciones-1`, no crees otro. Mantén `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV=production`, `TRUST_PROXY=1` y `COOKIE_SECURE=true`. No regeneres JWT ni la contraseña. Retira `ADMIN_PASS` si ya cambiaste la contraseña de inicio; el sistema no lo necesita para una cuenta existente.
4. Deja que Auto-Deploy publique el commit, o utiliza Manual Deploy → Deploy latest commit una sola vez. Verifica el estado y Logs; el inicio aplica una migración aditiva. No cambies de Docker a Node, porque se requieren dependencias de sistema.
5. Comprueba que puedes ingresar con tu misma cuenta, que están las operaciones y que aparecen los nuevos módulos. Importa un documento pequeño y coteja sus montos con el original antes de cargar todo el año. El dominio de Render no cambia por renombrar la aplicación.

## Importación de informes

- XLSX (no XLS antiguo), CSV, PDF con texto extraíble. Hasta 8 MB, 3000 filas extraídas, 40 columnas, 20 hojas de Excel o 100 páginas PDF. Un lote confirmado admite 500 registros; puedes continuar con los siguientes lotes y hojas.
- Selecciona el archivo, lee las filas, indica encabezado y asigna columnas. SISFIA intenta reconocer encabezados conocidos. Fecha, concepto y monto son obligatorios. Define si los datos están pagados o pendientes; no asume estados cuando no se reconocen.
- Revisa las filas, edita importes/fechas/rubros, selecciona las válidas y confirma. Solo soles (PEN); no convierte moneda ni admite abonos negativos. Los informes PDF escaneados necesitan OCR externo o conversión a Excel; los PDF de diseño complejo pueden requerir ajustes manuales. Las fórmulas Excel requieren valores calculados previamente guardados.
- Las filas de totales/saldos identificables no son importables. La validación y la revisión de origen son imprescindibles: no existe una regla universal para reconocer todos los subtotales. No se sobreescriben operaciones; coincidencias de fecha, importe, documento y concepto se omiten, incluidas las archivadas. Para dos gastos legítimamente idénticos, verifica y registra el segundo manualmente. La deduplicación no identifica todos los casos con formatos distintos. Se conserva el nombre, referencia, lote y huella del archivo; no se almacena el archivo original. Conserva los documentos originales fuera del sistema.
- Importa solo movimientos individuales de operaciones; no importes informes de totales o resúmenes que vuelvan a sumar las mismas operaciones. No importes gastos de caja chica también como operaciones si ya se registraron en caja chica. El importador crea operaciones, no cajas ni proveedores maestros.

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

`npm run test:static`, `npm run test:documents` (con las dependencias de Python en el intérprete activo), `npm test`, `npm run test:e2e`. Se ejecutaron pruebas estáticas de Node, pruebas reales del motor PDF/XLSX/CSV con archivos sintéticos, migración y deduplicación SQLite y flujo de navegador con API simulada. No se pudo instalar npm desde el entorno de preparación; no se ejecutaron pruebas completas del servidor ni despliegue real en Docker/Turso. No se realizó una auditoría nueva de dependencias. Verificar `npm audit` antes de producción, sin forzar cambios de versiones. La versión 3.3 reportó una vulnerabilidad alta sin identificar en los logs previos; esta entrega no certifica su resolución.
