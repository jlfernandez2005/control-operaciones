import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM providers WHERE company_id=? ORDER BY name', args: [req.user.cid] });
  res.json(result.rows);
});

r.post('/', roleRequired('admin', 'editor'), async (req, res) => {
  const { ruc, name, cci, holder } = req.body;
  if (!ruc || !name || !cci) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = await db.execute({ sql: 'INSERT INTO providers (company_id, ruc, name, cci, holder) VALUES (?,?,?,?,?)', args: [req.user.cid, ruc, name, cci, holder || null] });
    await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'provider', entityId: Number(info.lastInsertRowid), payload: req.body, req });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'RUC/DNI ya existe' });
    throw e;
  }
});

r.delete('/:id', roleRequired('admin'), async (req, res) => {
  await db.execute({ sql: 'DELETE FROM providers WHERE id=? AND company_id=?', args: [req.params.id, req.user.cid] });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'provider', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;
