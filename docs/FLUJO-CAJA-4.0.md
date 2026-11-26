# SISFIA 4.0 · Flujo de caja La Salle

## Actualización
1. Descargue un respaldo JSON desde Inicio > Exportar respaldo y conserve una copia de Turso. El JSON es una exportación de datos, no reemplaza una copia nativa de la base.
2. Actualice el repositorio existente con este ZIP descomprimido. Mantenga Docker, el servicio de Render y las variables JWT_SECRET, TURSO_DATABASE_URL y TURSO_AUTH_TOKEN. No cambie credenciales.
3. El arranque crea tres tablas nuevas de manera aditiva: flow_entries, flow_classification, flow_years. No modifica ni elimina registros anteriores. El respaldo JSON incluye las nuevas tablas.
4. Abra Inicio > Flujo de caja La Salle, o el acceso correspondiente del menú. Actualice el navegador si conserva archivos antiguos.

## Flujo de trabajo 2026 → 2027
- Seleccione 2026, consulte movimientos y clasifique las partidas pendientes. Los rubros originales y operaciones se preservan. Los activos y préstamos ambiguos requieren confirmación según política institucional.
- Registre ingresos cobrados y otros movimientos que no existan ya en operaciones: matrícula, pensiones, cuotas, inversiones, préstamos, donaciones y financiamiento. Puede importar un lote de PDF con texto, XLSX o CSV por partida, revisando campos, totales y filas. El importador no interpreta todos los formatos de cobranza sin revisión. No use esta opción para informes de pagos ya importados.
- Ingrese el saldo inicial de caja consolidada al 1 de enero. Debe incluir los fondos internos que forman parte de caja, según el alcance acordado. No suponga cero cuando no dispone de datos.
- Compruebe la conciliación de cada mes con los resúmenes y documentos de respaldo. Marque completo solo cuando haya verificado ingresos y egresos. Guarde los cambios.
- Seleccione 2027. En Proyección histórica cargue 2026. Seleccione los meses completos y defina método, ajuste porcentual y meses activos para cada partida. Promedio usa los meses confirmados; estacional usa el mismo mes y deja vacío si falta; manual no propone importes.
- Revise la matriz de presupuesto, edite cada partida y el saldo inicial proyectado. Use cero explícito para las partidas no aplicables. Guarde como borrador. Solo admin puede aprobar y debe completar todas las celdas y saldo inicial. La auditoría conserva modificaciones.
- PDF: consolidado anual, presupuesto por semestre, flujo registrado por semestre, cobertura. Excel: plantilla oficial de 20 partidas, 12 meses, totales y fórmulas, comparativo, movimientos, evolución y notas. La exportación usa la última versión guardada.

## Reglas y alcance
- Los resúmenes mensuales son referencias y no se suman al flujo. SUNAT se registra una sola vez como operación real en el módulo existente.
- Los pagos pendientes aparecen separados. La fecha de una operación histórica se usa como fecha registrada; confirme que corresponde a la fecha efectiva de cobro/pago. Las cajas internas no son una segunda salida; los gastos de caja se incluyen por fecha individual cuando hay vínculo único con un fondo pagado o confirmación manual individual. Los gastos de caja no vinculados se muestran por verificar. Es importante revisar los reembolsos y cruces con otros registros.
- El presupuesto de flujo de caja es distinto del presupuesto por rubro (compromisos) anterior. El nuevo formulario no reemplaza las proyecciones antiguas ni altera sus datos.
- La deduplicación detecta coincidencias exactas, no todos los posibles solapamientos. Los rubros sin equivalencia segura permanecen sin clasificar; los meses incompletos no deben emplearse para una estimación histórica. Los saldos calculados no certifican saldos bancarios. No hay sincronización automática con bancos o plataforma de cobranza ni registro patrimonial/depreciación o cronograma automático de deuda. Las inversiones y financiamientos se registran como movimientos del flujo.

## Validación
`npm run test:static` y `npm run test:flow` (el último requiere Python con las dependencias de `scripts/requirements-finance.txt`). Pruebas de cálculo, generación PDF/Excel, comprobación de sintaxis y referencias DOM. Verificar en un entorno de prueba de Render antes de usar el módulo para decisiones reales.
