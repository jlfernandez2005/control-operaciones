# Despliegue

## Local / servidor persistente
Usa las instrucciones del README. El esquema se inicializa antes de abrir el puerto. SQLite necesita un disco persistente y escribible. Turso es opcional: configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN, y prueba primero con una base de ensayo.

## Docker
Crea `.env` y configura NODE_ENV=production, COOKIE_SECURE=true, JWT_SECRET y ADMIN_PASS inicial. Para proxy HTTPS en el mismo host, configura TRUST_PROXY=1 y APP_ORIGIN con el origen HTTPS exacto, sin barra final. Ejecuta `docker compose up -d --build`. El servicio solo escucha en 127.0.0.1:3000 del host y tiene volumen persistente. Instala y configura un proxy inverso HTTPS externo; no se activa Nginx ni Certbot automáticamente. Los archivos antiguos en nginx son referencias y requieren adaptación al dominio. No expongas HTTP sin TLS. Para probar localmente puedes configurar NODE_ENV=development y COOKIE_SECURE=false.

## Respaldo
`bash scripts/backup.sh` crea una copia consistente de SQLite local (requiere Python 3). Para Docker, `BACKUP_DOCKER=1 bash scripts/backup.sh`. Para Turso utiliza el mecanismo de respaldo del proveedor. Protege las copias y prueba su restauración. La exportación JSON del panel es un respaldo de datos operativos, no una imagen completa de la BD (no contiene usuarios ni auditoría). Nunca subas .env ni las bases de datos a Git.

## Antes de producción
Genera package-lock.json y ejecuta las pruebas, `npm audit`, prueba con datos de ensayo y realiza verificación funcional y de seguridad. El servidor Express requiere un proceso persistente; no se ofrece configuración para Vercel serverless. No se ha comprobado la compatibilidad con el alojamiento real.
