#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const FILE = arg('file', './respaldo-v2.json');
const URL = arg('url', 'http://localhost:3000');
const COMPANY = arg('company', 'LSALLE');
const USER = arg('user', 'admin');
const PASS = process.env.MIGRATION_PASSWORD;
if (!PASS) throw new Error('Configura MIGRATION_PASSWORD');

if (!fs.existsSync(FILE)) { console.error('❌ No existe:', FILE); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(path.resolve(FILE), 'utf8'));
if (!raw.prov || !raw.ops) { console.error('❌ JSON no es respaldo v2'); process.exit(1); }

let cookie = '';
async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(URL + '/api' + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const txt = await res.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}`);
  return data;
}

(async () => {
  console.log('🔐 Login…');
  const login = await api('/auth/login', { method: 'POST', body: { companyCode: COMPANY, username: USER, password: PASS } });
  if(login.mustChange)throw new Error('Cambia la contraseña temporal antes de migrar');
  let okP = 0, failP = 0;
  for (const p of raw.prov) {
    try { await api('/prov', { method: 'POST', body: { ruc: p.r, name: p.n, cci: p.c, holder: p.t || '' } }); okP++; }
    catch (e) { if (String(e.message).includes('409')) { okP++; continue; } failP++; }
  }
  console.log(`Proveedores: ✅ ${okP} / ⚠️ ${failP}`);
  let okO = 0, failO = 0;
  for (const o of raw.ops) {
    try { await api('/ops', { method: 'POST', body: { date: o.f, concept: o.c, receipt: o.p || '', amount: Number(o.m) || 0, ruc: o.r, status: o.e || 'Pendiente', bank: o.b || 'Scotiabank', type: o.t || 'General' } }); okO++; }
    catch (e) { failO++; }
  }
  console.log(`Operaciones: ✅ ${okO} / ⚠️ ${failO}`);
  let okC = 0, failC = 0;
  for (const c of (raw.cc || [])) {
    try {
      const { id } = await api('/cc', { method: 'POST', body: { num: c.num || '', resp: c.resp || '', area: c.area || '', ord: c.orden || '', from_date: c.desde || null, to_date: c.hasta || null, fund: Number(c.fondo) || 0 } });
      for (const it of (c.items || [])) {
        await api(`/cc/${id}/items`, { method: 'POST', body: { date: it.f, ruc: it.r || '', provider: it.p || '', receipt: it.c || '', category: it.k || '', detail: it.d, amount: Number(it.m) || 0, usd: it.u ? Number(it.u) : null } });
      }
      okC++;
    } catch { failC++; }
  }
  console.log(`Cajas: ✅ ${okC} / ⚠️ ${failC}`);
  console.log('Migración finalizada; revisa los registros fallidos antes de reintentar.');
  if(failP||failO||failC)process.exitCode=1;
})().catch(e => { console.error('❌', e.message); process.exit(1); });