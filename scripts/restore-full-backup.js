import 'dotenv/config';import fs from 'node:fs';import path from 'node:path';import {decryptSnapshot,restoreSnapshot,counts} from '../server/full-backup.js';
process.umask(0o077);
const [source,dest]=process.argv.slice(2);if(!source)throw Error('Uso: node scripts/restore-full-backup.js respaldo.json [ruta absoluta nueva.db]');const s=decryptSnapshot(JSON.parse(fs.readFileSync(source,'utf8')),process.env.SISFIA_BACKUP_KEY);if(!dest){console.log(JSON.stringify({authenticated:true,counts:counts(s),note:'Verificación criptográfica, no restauración'}));}else{
 if(!path.isAbsolute(dest)||fs.existsSync(dest)||!dest.endsWith('.db'))throw Error('El destino debe ser una ruta absoluta .db nueva.');
 // Force local-only destination. Never restore to a remote DB from this tool.
 for(const k of ['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','RENDER','RENDER_SERVICE_ID'])delete process.env[k];process.env.DB_PATH=dest;
 const {db,initSchema}=await import('../server/db.js');let tx;try{await initSchema();tx=await db.transaction('write');const result=await restoreSnapshot(tx,s);await tx.commit();console.log(JSON.stringify({restored:true,counts:result}));}catch(e){if(tx)try{await tx.rollback()}catch{}console.error('Restauración interrumpida. No utilices el destino parcial.');process.exitCode=1;}finally{if(tx)tx.close();db.close();if(fs.existsSync(dest))fs.chmodSync(dest,0o600);}
}
