import { db, initSchema, seed as baseSeed } from './db.js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

initSchema();
baseSeed();

const company = db.prepare('SELECT * FROM companies WHERE code=?').get('LSALLE');
if (!company) { console.error('Falta la empresa base'); process.exit(1); }
const cid = company.id;

const providers = [
  { ruc: '10062021476', name: 'Niuyen Elvira Béjar Chinchay', cci: '00219113408177002956', holder: 'Niuyen Béjar' },
  { ruc: '20615897591', name: 'Noari Diseño & Construcción SAC', cci: '01135200020050915828', holder: 'Noari SAC' },
  { ruc: '20512345678', name: 'Servicios Generales Andinos SAC', cci: '00312345678901234567', holder: 'Andinos SAC' },
  { ruc: '10456789123', name: 'María Fernanda Quispe Rojas', cci: '00987654321098765432', holder: 'María Quispe' },
  { ruc: '20765432109', name: 'Tecnología Educativa Perú SAC', cci: '00276543210987654321', holder: 'TecnoEduca' },
  { ruc: '10234567890', name: 'Carlos Alberto Mendoza Vega', cci: '01812345678901234567', holder: 'Carlos Mendoza' },
  { ruc: '20456789012', name: 'Distribuidora Escolar Lima SAC', cci: '01145678901234567890', holder: 'Distribuidora Escolar' },
  { ruc: '10987654321', name: 'Ana Lucía Torres Sánchez', cci: '00210987654321098765', holder: 'Ana Torres' },
  { ruc: '20123456789', name: 'Mantenimiento Integral Sur SAC', cci: '00301234567890123456', holder: 'Mantto Sur' },
  { ruc: '10765432109', name: 'Jorge Luis Ramírez Castro', cci: '00976543210987654321', holder: 'Jorge Ramírez' }
];
const insertProv = db.prepare('INSERT OR IGNORE INTO providers (company_id, ruc, name, cci, holder) VALUES (?,?,?,?,?)');
providers.forEach(p => insertProv.run(cid, p.ruc, p.name, p.cci, p.holder));

const extraUsers = [
  { username: 'editor1', name: 'Rosa Martínez', role: 'editor', pass: 'editor123' },
  { username: 'editor2', name: 'Luis Paredes', role: 'editor', pass: 'editor123' },
  { username: 'lector1', name: 'Carmen Ríos', role: 'lector', pass: 'lector123' }
];
const insertUser = db.prepare('INSERT OR IGNORE INTO users (company_id, username, name, role, pass_hash, must_change) VALUES (?,?,?,?,?,0)');
extraUsers.forEach(u => insertUser.run(cid, u.username, u.name, u.role, bcrypt.hashSync(u.pass, 10)));

const existingOps = db.prepare('SELECT COUNT(*) c FROM ops WHERE company_id=?').get(cid).c;
if (existingOps <= 5) {
  const concepts = [
    { c: 'Servicio de desayuno y torta Primera Comunión', min: 800, max: 1200, type: 'General', bank: 'Scotiabank' },
    { c: 'Planos: Diseño Integral - Adelanto', min: 1800, max: 2500, type: 'General', bank: 'Interbank' },
    { c: 'Mantenimiento de aulas - Pintura', min: 500, max: 900, type: 'General', bank: 'Scotiabank' },
    { c: 'Compra de materiales educativos', min: 300, max: 700, type: 'General', bank: 'Scotiabank' },
    { c: 'Servicio de limpieza mensual', min: 400, max: 600, type: 'General', bank: 'Interbank' },
    { c: 'Pago de taller de robótica', min: 200, max: 500, type: 'Talleres', bank: 'Scotiabank' },
    { c: 'Pago de taller de música', min: 150, max: 400, type: 'Talleres', bank: 'Interbank' },
    { c: 'Declaración SUNAT PDT 601', min: 100, max: 300, type: 'SUNAT', bank: 'Scotiabank' },
    { c: 'Servicio de internet mensual', min: 250, max: 350, type: 'General', bank: 'Interbank' },
    { c: 'Mantenimiento de equipos de cómputo', min: 350, max: 800, type: 'General', bank: 'Scotiabank' }
  ];
  const insertOp = db.prepare(`INSERT INTO ops (company_id, date, concept, receipt, amount, ruc, status, bank, type, signature, created_by)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const today = new Date();
  let count = 0;
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const opsCount = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < opsCount; i++) {
      const day = 1 + Math.floor(Math.random() * Math.min(daysInMonth, 28));
      const date = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tpl = concepts[Math.floor(Math.random() * concepts.length)];
      const amount = Math.round((tpl.min + Math.random() * (tpl.max - tpl.min)) * 100) / 100;
      const prov = providers[Math.floor(Math.random() * providers.length)];
      const status = Math.random() > 0.3 ? 'Pagado' : 'Pendiente';
      const receipt = `FE N° E001 - ${100 + count} - ${prov.name}`;
      const crypto = await import('node:crypto');
      const sig = crypto.createHash('sha256').update(`${date}|${tpl.c}|${amount}|${prov.ruc}|seed`).digest('hex');
      insertOp.run(cid, date, tpl.c, receipt, amount, prov.ruc, status, tpl.bank, tpl.type, sig, 1);
      count++;
    }
  }
  console.log(`[seed:full] Operaciones nuevas: ${count}`);
}

const existingCc = db.prepare('SELECT COUNT(*) c FROM petty_cash WHERE company_id=?').get(cid).c;
if (existingCc === 0) {
  const ccs = [
    { num: '011-2026', resp: 'Rosa Martínez', area: 'Administración Logística', ord: 'TR-000012345678 (Scotiabank)', fund: 1500, items: [
      { d: 'Compra de útiles de oficina', cat: 'compras', m: 120, f: 2 },
      { d: 'Pasajes a reunión de padres', cat: 'pasajes', m: 45, f: 3 },
      { d: 'Misa de inicio de mes', cat: 'misa', m: 200, f: 5 },
      { d: 'Delivery de almuerzos reunión', cat: 'delivery', m: 85, f: 8 },
      { d: 'Lavado de cortinas de aula', cat: 'lavado', m: 60, f: 10 }
    ]},
    { num: '012-2026', resp: 'Luis Paredes', area: 'Mantenimiento', ord: 'TR-000087654321 (Interbank)', fund: 2000, items: [
      { d: 'Comisiones bancarias', cat: 'comisiones', m: 30, f: 4 },
      { d: 'Suscripción workspace anual', cat: 'workspace', m: 250, f: 6 },
      { d: 'Compras de materiales de pintura', cat: 'compras', m: 320, f: 12 }
    ]}
  ];
  const insertCc = db.prepare(`INSERT INTO petty_cash (company_id, num, resp, area, ord, from_date, to_date, fund) VALUES (?,?,?,?,?,?,?,?)`);
  const insertItem = db.prepare(`INSERT INTO petty_items (cc_id, date, ruc, provider, receipt, category, detail, amount, usd) VALUES (?,?,?,?,?,?,?,?,?)`);
  const now = new Date();
  const desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const hasta = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;
  ccs.forEach(c => {
    const info = insertCc.run(cid, c.num, c.resp, c.area, c.ord, desde, hasta, c.fund);
    c.items.forEach(it => {
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(it.f).padStart(2, '0')}`;
      insertItem.run(info.lastInsertRowid, d, '', '', 'sin comprobante', it.cat, it.d, it.m, null);
    });
  });
}

console.log('\n✅ Seed ampliado completo');
console.log('   admin / admin123');
console.log('   editor1 / editor123');
console.log('   editor2 / editor123');
console.log('   lector1 / lector123');
