import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
const local = path.resolve(process.env.DB_PATH || './data/control.db');
if (!process.env.TURSO_DATABASE_URL) fs.mkdirSync(path.dirname(local),{recursive:true});
export const db = createClient({url:process.env.TURSO_DATABASE_URL || pathToFileURL(local).href,authToken:process.env.TURSO_AUTH_TOKEN});
export async function initSchema(){
  const sql=fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
  for(const stmt of sql.split(';').filter(s=>s.trim())) {
    if(process.env.TURSO_DATABASE_URL && /PRAGMA journal_mode/i.test(stmt)) continue;
    await db.execute(stmt);
  }
  const cols=(await db.execute('PRAGMA table_info(ops)')).rows;
  if(!cols.some(c=>c.name==='deleted_at')) await db.execute('ALTER TABLE ops ADD COLUMN deleted_at TEXT');
}
export async function seed(){
  const username=process.env.ADMIN_USER || 'admin', password=process.env.ADMIN_PASS;
  const companyCode=(process.env.COMPANY_CODE||'LSALLE').toUpperCase();
  const existing=(await db.execute({sql:'SELECT id FROM companies WHERE code=?',args:[companyCode]})).rows[0];
  if(existing && (await db.execute({sql:'SELECT id FROM users WHERE company_id=? AND username=?',args:[existing.id,username]})).rows.length) return;
  if(!password || password.length<12 || Buffer.byteLength(password)>72) throw new Error('Configura ADMIN_PASS (12 caracteres mínimo, máximo 72 bytes) para inicializar.');
  await db.execute({sql:'INSERT OR IGNORE INTO companies (name,code) VALUES (?,?)',args:[process.env.COMPANY_NAME||'La Salle Lima',companyCode]});
  const company=(await db.execute({sql:'SELECT id FROM companies WHERE code=?',args:[companyCode]})).rows[0];
  await db.execute({sql:'INSERT OR IGNORE INTO users (company_id,username,name,role,pass_hash,must_change) VALUES (?,?,?,?,?,1)',args:[company.id,username,'Administrador','admin',await bcrypt.hash(password,12)]});
}
if(process.argv.includes('--init')||process.argv.includes('--seed')){await initSchema();if(process.argv.includes('--seed'))await seed();db.close();}
