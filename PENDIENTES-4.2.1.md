# SISFIA 4.2.1 — corrección de importación y pendientes

## Alcance de esta entrega
Base comprobada: paquete completo 4.2.0. Se mantienen los módulos, logo institucional, esquema, seguridad y datos históricos. No se encontró un paquete previo 4.2.1; esta entrega versiona la corrección como 4.2.1. No se modificó producción ni el repositorio remoto.

- En navegador y servidor, los conceptos que describen pagos de saldos pendientes de sueldos, liquidaciones y facturas dejan de considerarse totales por empezar por «saldo». Los saldos contables identificados, fondos, resúmenes y totales continúan bloqueados.
- Nuevas sugerencias de rubros para devoluciones, almuerzos, consumo de agua y pagos de liquidaciones laborales. Son sugerencias, no una clasificación contable oficial; no se modifica retrospectivamente ninguna categoría.
- Mensajes de validación más precisos en la vista previa. Nueva versión de la caché de la aplicación. Sin nueva migración respecto de 4.2.0.

## Pruebas ejecutadas
37 pruebas estáticas (34 anteriores + 3 nuevas), 34 pruebas de flujo, tesorería, fechas, seguridad y planilla; 4 pruebas de documentos de planilla. Total: 75 superadas. Las pruebas nuevas usan conceptos genéricos sin datos personales; no se recibió el PDF original de la captura del 28 de octubre. No se ejecutó una importación real contra Turso ni el navegador en producción.

## Pendientes antes de usar datos laborales reales
1. **Crítico:** respaldo completo de Turso y restauración de prueba; verificación de acceso por empresa, roles, MFA, revocación, bloqueo y permisos de descarga en un entorno separado.
2. **Crítico:** auditoría de dependencias npm/Python, lockfile reproducible, actualización de dependencias vulnerables y revisión del resultado de CI. Pruebas dinámicas de seguridad autorizadas y revisión independiente de infraestructura.
3. **Alto:** cifrado adicional de registros históricos de operaciones, bancos y estudiantes; revisión de acceso y cifrado del proveedor de base de datos; backups diarios cifrados y automatizados fuera de la aplicación; procedimiento de rotación de claves y recuperación.
4. **Alto:** controles de retención, eliminación segura, auditoría de accesos históricos y políticas institucionales de tratamiento de datos.
5. **Funcional:** probar el PDF real que originó el bloqueo y validar que cada fila se guarda una sola vez. Las coincidencias con fecha, importe, concepto, RUC y comprobante iguales pueden ser descartadas por el deduplicador existente. Verificar especialmente devoluciones de igual monto y referencia genérica; no asumir que son duplicados ni desactivar la protección indiscriminadamente.
6. **Funcional:** completar validaciones de formatos auxiliares de planilla, motor de cálculo laboral conforme a normativa y reglas de cada trabajador; conexión directa con bancos/Sallenet (actualmente se importan informes), conciliación individual de movimientos y pagos agrupados ambiguos.

Para actualizar desde 4.1.1, configurar PAYROLL_DATA_KEY según docs/PLANILLAS-4.2.md; si ya se configuró en 4.2.0, conservar exactamente la misma clave. No publicar archivos de datos ni secretos en GitHub. La auditoría de 4.2.0 (docs/AUDITORIA-SEGURIDAD-4.2.md) sigue vigente con sus limitaciones.
