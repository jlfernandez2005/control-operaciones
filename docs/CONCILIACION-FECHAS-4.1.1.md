# SISFIA 4.1.1 — Conciliación entre fechas

## Actualización
Realizar respaldo de Turso y publicar todos los archivos en el repositorio existente. Mantener servicio Docker, JWT_SECRET y credenciales de Turso. El arranque agrega `budget_date_links` sin modificar operaciones ni resúmenes existentes. El respaldo JSON incluye los vínculos. La caché del service worker se actualiza.

## Uso
1. Abrir Presupuesto → Conciliación diaria de resúmenes mensuales (también accesible desde Detalle mensual). Seleccionar el año y mes.
2. En Conciliación entre fechas, revisar las sugerencias. Se buscan excesos y faltantes de igual monto dentro de siete días del mismo mes, con operaciones pagadas. Si hay varias alternativas se indica ambigüedad. Se muestra la coincidencia con el total diario de cargos bancarios de una cuenta, excluyendo comisiones e ITF cuando el lector los identifica. No es prueba individual del pago.
3. Verificar comprobantes, confirmar vínculo e indicar motivo. La selección manual permite elegir un subconjunto del exceso que cubra exactamente un faltante del mismo mes. No se permiten movimientos pendientes, pagos SUNAT (tienen procedimiento propio), duplicados sospechosos en las fechas involucradas ni reutilización de operaciones vinculadas.
4. El registro original conserva su fecha, importe y demás datos. La fecha efectiva se utiliza en la conciliación diaria, presupuesto, flujo y comparativo bancario. No se generan nuevas operaciones ni se modifica el total mensual. Los reportes del registro original mantienen la fecha documental.
5. Los vínculos guardados muestran las dos fechas, monto, motivo y evidencia bancaria disponible al confirmar. Desvincular restaura el uso de la fecha original; la auditoría conserva el registro. Si cambia la operación o el contenido de la referencia mensual, el vínculo queda inactivo hasta revisión y retiro; no se aplica silenciosamente. La evidencia bancaria es una instantánea de la versión del documento al confirmar, no una validación permanente tras su reemplazo.

## Alcance
No hay confirmación automática sin intervención del usuario. La conciliación entre meses, los emparejamientos de muchos días entre sí y la identificación individual de todos los cargos bancarios no están incluidos. El sistema conserva controles de posibles duplicidades; una igualdad monetaria no basta para confirmar identidad. El enlace no altera fechas de caja chica. Para una diferencia de periodo entre meses, se debe revisar el comprobante y corregir mediante un procedimiento contable explícito.

## Pruebas
`npm run test:dates`, `npm run test:static`, `npm run test:flow`, `npm run test:treasury`. Para probar contra el estado original, usar `SISFIA_TEST_BANK_PDF` con la ruta local del documento; los PDF privados no se distribuyen en el proyecto. Pruebas locales; pendiente validación integral en Render/Turso.
