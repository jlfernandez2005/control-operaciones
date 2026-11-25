import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
// On Render, do not silently fall back to ephemeral local storage.
if ((process.env.RENDER==='true'||process.env.RENDER_SERVICE_ID||process.env.TURSO_DATABASE_URL||process.env.TURSO_AUTH_TOKEN) && (!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)) throw new Error('Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN antes de iniciar SISFIA.');
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
  // Additive, idempotent migrations: preserve all previous rows and login credentials.
  for(const [name,definition] of Object.entries({category:"TEXT NOT NULL DEFAULT 'Sin clasificar'",provider_name:"TEXT NOT NULL DEFAULT ''",import_batch:'TEXT',source_file:'TEXT',source_ref:'TEXT',bank_account:"TEXT NOT NULL DEFAULT ''",order_number:"TEXT NOT NULL DEFAULT ''"})){
    if(!cols.some(c=>c.name===name)) await db.execute(`ALTER TABLE ops ADD COLUMN ${name} ${definition}`);
  }
  for(const [table,fields] of Object.entries({petty_cash:{import_batch:'TEXT',report_date:'TEXT',source_file:'TEXT'},petty_items:{source_ref:'TEXT',source_category:'TEXT'}})){
    const existing=(await db.execute(`PRAGMA table_info(${table})`)).rows;
    for(const [name,definition] of Object.entries(fields))if(!existing.some(c=>c.name===name))await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ops_import_batch ON ops(company_id,import_batch)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_ops_match ON ops(company_id,date,amount,ruc,receipt)');
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
