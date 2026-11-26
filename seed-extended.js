import 'dotenv/config';
import path from 'node:path';
if(process.env.NODE_ENV==='production'||process.env.TURSO_DATABASE_URL||!process.env.DB_PATH||!path.basename(process.env.DB_PATH).startsWith('demo-'))throw Error('Usa una base local aislada DB_PATH=./data/demo-control.db');
const {db,initSchema,seed}=await import('./db.js');
await initSchema();await seed();
const c=(await db.execute({sql:'SELECT id FROM companies WHERE code=?',args:[(process.env.COMPANY_CODE||'LSALLE').toUpperCase()]})).rows[0];
await db.execute({sql:'INSERT OR IGNORE INTO providers(company_id,ruc,name,cci) VALUES(?,?,?,?)',args:[c.id,'00000000000','Proveedor de demostración','00000000000000000000']});
console.log('Base de demostración creada; no contiene datos reales.');db.close();
