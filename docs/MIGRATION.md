# Migración v2 → v3

1. Exportar respaldo v2 (botón "Generar respaldo" en la app v2).
2. Guardar como `respaldo-v2.json`.
3. Con v3 corriendo:
```bash
npm run migrate:v2 -- --file respaldo-v2.json --user admin --pass admin123