# SISFIA 5.2.2 — candidato de seguridad (no aprobado para producción)

Base 5.2.1. GHSA-mrhx-c7xc-m3w5: versión fijada de Zod 4.6.7 (corrección publicada desde 4.6.6). Adaptados los dos usos de z.record de flujo. Límites previos de estructura JSON y de errores. No modifica SQL, credenciales ni registros.

La instalación y auditoría en línea no se pudieron ejecutar en el entorno de preparación. Generar package-lock.json en Node 22, instalar las dependencias de desarrollo, ejecutar las pruebas y revisar auditorías antes de aprobar. No publicar archivos .env, bases SQLite, respaldos ni secretos. Mantener rama y servicio de pruebas; no conectar datos reales al servicio público. No usar npm audit fix --force. 

En PowerShell (sin credenciales Turso): `npm.cmd install --include=dev`, `npm.cmd ls zod`, `npm.cmd audit --omit=dev`, `npm.cmd run test:validation`, `npm.cmd test`. Los tests de API requieren Python y dependencias del proyecto; si faltan, usar GitHub Actions (incluye Python y pip-audit). Revisar los resultados; no fusionar main ni desplegar producción hasta validar. Incluir package-lock.json generado en el commit. 
