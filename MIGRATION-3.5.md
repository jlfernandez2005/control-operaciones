# Migración 3.4 → 3.5

Respalda Turso y guarda el commit anterior. Descomprime el ZIP y actualiza el repositorio existente; no cambies el servicio Docker ni sus variables. `initSchema()` agrega `ops.bank_account`, `ops.order_number`, `petty_cash.import_batch`, `petty_cash.report_date`, `petty_cash.source_file`, `petty_items.source_ref`, `petty_items.source_category` si no existen. No borra tablas ni usuarios. El Dockerfile cambia a Node 22 Debian slim y agrega pdfplumber. Comprueba Logs y login. No borres columnas para volver al commit anterior.

Comprueba primero un informe de 7 operaciones y una caja de 15 gastos. En la caja 001-2026 hay dos variantes del mismo informe; importa solamente una. La segunda se rechaza por número de caja. Para revisar una caja ya registrada, usa el módulo Caja chica; no reimportes para sobrescribirla. Los estados de pago se confirman manualmente.

No se ha probado contra el Turso de producción; el ZIP no contiene tus PDF ni datos personales de ellos.
