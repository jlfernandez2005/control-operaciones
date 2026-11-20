import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', (req, res) => res.json(db.prepare('SELECT * FROM providers WHERE company_id=? ORDER BY name').all(req.user.cid)));

r.post('/', roleRequired('admin', 'editor'), (req, res) => {
  const { ruc, name, cci, holder } = req.body;
  if (!ruc || !name || !cci) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = db.prepare('INSERT INTO providers (company_id, ruc, name, cci, holder) VALUES (?,?,?,?,?)')
      .run(req.user.cid, ruc, name, cci, holder || null);
    audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'provider', entityId: info.lastInsertRowid, payload: req.body, req });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'RUC/DNI ya existe' });
    throw e;
  }
});

r.put('/:id', roleRequired('admin', 'editor'), (req, res) => {
  const { ruc, name, cci, holder } = req.body;
  const cur = db.prepare('SELECT * FROM providers WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cur) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('UPDATE providers SET ruc=?, name=?, cci=?, holder=? WHERE id=?')
    .run(ruc ?? cur.ruc, name ?? cur.name, cci ?? cur.cci, holder ?? cur.holder, req.params.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'update', entity: 'provider', entityId: Number(req.params.id), payload: req.body, req });
  res.json({ ok: true });
});

r.delete('/:id', roleRequired('admin'), (req, res) => {
  db.prepare('DELETE FROM providers WHERE id=? AND company_id=?').run(req.params.id, req.user.cid);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'provider', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;