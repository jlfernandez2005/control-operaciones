import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', (req, res) => {
  const ccs = db.prepare('SELECT * FROM petty_cash WHERE company_id=? ORDER BY id DESC').all(req.user.cid);
  const stmt = db.prepare('SELECT * FROM petty_items WHERE cc_id=? ORDER BY date, id');
  ccs.forEach(c => { c.items = stmt.all(c.id); });
  res.json(ccs);
});

r.post('/', roleRequired('admin', 'editor'), (req, res) => {
  const { num, resp, area, ord, from_date, to_date, fund } = req.body;
  const info = db.prepare('INSERT INTO petty_cash (company_id, num, resp, area, ord, from_date, to_date, fund) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.cid, num || '', resp || '', area || '', ord || '', from_date || null, to_date || null, fund || 0);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'cc', entityId: info.lastInsertRowid, payload: req.body, req });
  res.status(201).json({ id: info.lastInsertRowid });
});

r.put('/:id', roleRequired('admin', 'editor'), (req, res) => {
  const { num, resp, area, ord, from_date, to_date, fund } = req.body;
  const cur = db.prepare('SELECT * FROM petty_cash WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cur) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE petty_cash SET num=?, resp=?, area=?, ord=?, from_date=?, to_date=?, fund=? WHERE id=?')
    .run(num ?? cur.num, resp ?? cur.resp, area ?? cur.area, ord ?? cur.ord, from_date ?? cur.from_date, to_date ?? cur.to_date, fund ?? cur.fund, req.params.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'update', entity: 'cc', entityId: Number(req.params.id), payload: req.body, req });
  res.json({ ok: true });
});

r.delete('/:id', roleRequired('admin'), (req, res) => {
  db.prepare('DELETE FROM petty_cash WHERE id=? AND company_id=?').run(req.params.id, req.user.cid);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'cc', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

r.post('/:id/items', roleRequired('admin', 'editor'), (req, res) => {
  const cc = db.prepare('SELECT * FROM petty_cash WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cc) return res.status(404).json({ error: 'Caja no encontrada' });
  const { date, ruc, provider, receipt, category, detail, amount, usd } = req.body;
  if (!date || !detail || amount == null) return res.status(400).json({ error: 'Faltan datos' });
  const info = db.prepare('INSERT INTO petty_items (cc_id, date, ruc, provider, receipt, category, detail, amount, usd) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(cc.id, date, ruc || '', provider || '', receipt || '', category || '', detail, amount, usd || null);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'cc_item', entityId: info.lastInsertRowid, payload: req.body, req });
  res.status(201).json({ id: info.lastInsertRowid });
});

r.delete('/:id/items/:itemId', roleRequired('admin', 'editor'), (req, res) => {
  const cc = db.prepare('SELECT * FROM petty_cash WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cc) return res.status(404).json({ error: 'Caja no encontrada' });
  db.prepare('DELETE FROM petty_items WHERE id=? AND cc_id=?').run(req.params.itemId, cc.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'cc_item', entityId: Number(req.params.itemId), req });
  res.json({ ok: true });
});

export default r;