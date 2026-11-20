import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const DB_PATH = process.env.DB_PATH || './data/control.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'server/schema.sql'), 'utf8');
  db.exec(sql);
}

export function seed() {
  const companyCode = 'LSALLE';
  let company = db.prepare('SELECT * FROM companies WHERE code=?').get(companyCode);
  if (!company) {
    db.prepare('INSERT INTO companies (name, code) VALUES (?,?)').run('Colegio Hermano Noé Zevallos · La Salle Lima', companyCode);
    company = db.prepare('SELECT * FROM companies WHERE code=?').get(companyCode);
  }
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const exists = db.prepare('SELECT id FROM users WHERE company_id=? AND username=?').get(company.id, adminUser);
  if (!exists) {
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare(`INSERT INTO users (company_id, username, name, role, pass_hash, must_change)
                VALUES (?,?,?,?,?,1)`).run(company.id, adminUser, 'Administrador', 'admin', hash);
    console.log(`[seed] Usuario admin creado: ${adminUser} / ${adminPass}`);
  }
  const provCount = db.prepare('SELECT COUNT(*) c FROM providers WHERE company_id=?').get(company.id).c;
  if (provCount === 0) {
    db.prepare(`INSERT INTO providers (company_id, ruc, name, cci) VALUES (?,?,?,?)`)
      .run(company.id, '10062021476', 'Niuyen Elvira Béjar Chinchay', '00219113408177002956');
    db.prepare(`INSERT INTO providers (company_id, ruc, name, cci) VALUES (?,?,?,?)`)
      .run(company.id, '20615897591', 'Noari Diseño & Construcción SAC', '01135200020050915828');
  }
}

if (process.argv.includes('--init')) { initSchema(); console.log('[db] Esquema listo:', DB_PATH); }
if (process.argv.includes('--seed')) { initSchema(); seed(); console.log('[db] Seed listo'); }