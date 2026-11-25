# Control de Operaciones y Pagos · La Salle

Versión 3.3.0 — revisión correctiva y funcional. Node.js 20+ (se recomienda 22), Express, libSQL/SQLite o Turso, frontend JavaScript y PWA.

## Inicio local

1. Instala Node.js 22 y extrae el proyecto.
2. Copia `.env.example` a `.env`. Genera un secreto con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` y colócalo en `JWT_SECRET`. Configura `ADMIN_PASS` con una contraseña temporal única de al menos 12 caracteres y como máximo 72 bytes. No compartas `.env`.
3. Ejecuta:

```bash
npm install
npm run db:seed
npm start
```

Abre `http://localhost:3000`. Empresa: `LSALLE` (configurable); usuario: `admin` (configurable); clave: la configurada por ti. El primer ingreso exige cambiarla. Retira `ADMIN_PASS` del entorno una vez creado el administrador. No hay contraseña de fábrica. Si ya existía una cuenta, `db:seed` no cambia su contraseña. Rota las contraseñas antiguas y el secreto JWT al actualizar.

## Funciones

- Panel mensual, operaciones con filtros, edición y archivo/restauración por administrador.
- Proveedores, caja chica con fondo y gastos, usuarios, auditoría y exportación JSON/CSV.
- Roles: lector consulta; editor registra y modifica operaciones, crea proveedores y cajas/gastos; administrador archiva/restaura operaciones, administra usuarios y exporta el conjunto de datos.
- Restablecimiento de contraseñas por administrador; no hay preguntas de seguridad. La opción Clave permite cambiar la propia contraseña.
- PWA: instalable según navegador, requiere HTTPS fuera de localhost; el sistema necesita conexión para consultar o modificar datos. El caché solo incluye recursos públicos.

## Verificación

```bash
npm run test:static
npm test
npm run test:e2e:install
npm run test:e2e
```

Las pruebas de API y navegador necesitan dependencias y se deben ejecutar en un entorno de prueba. La revisión incluyó pruebas estáticas exitosas y validación del esquema SQLite con Python; no se pudo instalar npm en el entorno de revisión. No se generó un lockfile. `npm install` lo generará; incorporarlo a Git antes de producción. No se ha validado despliegue en Turso ni Docker.

Más información: `docs/DEPLOY.md`, `docs/MIGRATION.md`, `docs/REVISION.md`.
