import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initSchema() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'server/schema.sql'), 'utf8');
  const statements = sql.split(';').filter(s => s.trim() !== '');
  for (const stmt of statements) {
    if (stmt.trim()) await db.execute(stmt);
  }
}

export async function seed() {
  let companyRes = await db.execute({ sql: 'SELECT * FROM companies WHERE code=?', args: ['LSALLE'] });
  let company = companyRes.rows[0];
  if (!company) {
    await db.execute({ sql: 'INSERT INTO companies (name, code) VALUES (?,?)', args: ['La Salle Lima', 'LSALLE'] });
    companyRes = await db.execute({ sql: 'SELECT * FROM companies WHERE code=?', args: ['LSALLE'] });
    company = companyRes.rows[0];
  }
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const userCheck = await db.execute({ sql: 'SELECT id FROM users WHERE company_id=? AND username=?', args: [company.id, adminUser] });
  if (userCheck.rows.length === 0) {
    const hash = bcrypt.hashSync(adminPass, 10);
    await db.execute({ sql: 'INSERT INTO users (company_id, username, name, role, pass_hash, must_change) VALUES (?,?,?,?,?,1)', args: [company.id, adminUser, 'Administrador', 'admin', hash] });
  }
  console.log('[seed] Listo');
}
