# Deploy

## Requisitos
- Node.js ≥ 20 (local) o Docker 24+ (prod)
- Dominio apuntando al servidor

## Local
```bash
cp .env.example .env
npm install
npm run db:seed
npm start