import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', async (req, res) => {
  const ccsResult = await db.execute({ sql: 'SELECT * FROM petty_cash WHERE company_id=? ORDER BY id DESC', args: [req.user.cid] });
  const ccs = ccsResult.rows;
  for (let c of ccs) {
    const itemsResult = await db.execute({ sql: 'SELECT * FROM petty_items WHERE cc_id=? ORDER BY date, id', args: [c.id] });
    c.items = itemsResult.rows;
  }
  res.json(ccs);
});

r.post('/', roleRequired('admin', 'editor'), async (req, res) => {
  const { num, resp, area, ord, from_date, to_date, fund } = req.body;
  const info = await db.execute({ 
    sql: 'INSERT INTO petty_cash (company_id, num, resp, area, ord, from_date, to_date, fund) VALUES (?,?,?,?,?,?,?,?)',
    args: [req.user.cid, num || '', resp || '', area || '', ord || '', from_date || null, to_date || null, fund || 0]
  });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'cc', entityId: Number(info.lastInsertRowid), payload: req.body, req });
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

r.delete('/:id', roleRequired('admin'), async (req, res) => {
  await db.execute({ sql: 'DELETE FROM petty_cash WHERE id=? AND company_id=?', args: [req.params.id, req.user.cid] });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'cc', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

r.post('/:id/items', roleRequired('admin', 'editor'), async (req, res) => {
  const ccResult = await db.execute({ sql: 'SELECT * FROM petty_cash WHERE id=? AND company_id=?', args: [req.params.id, req.user.cid] });
  const cc = ccResult.rows[0];
  if (!cc) return res.status(404).json({ error: 'Caja no encontrada' });
  const { date, ruc, provider, receipt, category, detail, amount, usd } = req.body;
  if (!date || !detail || amount == null) return res.status(400).json({ error: 'Faltan datos' });
  const info = await db.execute({ 
    sql: 'INSERT INTO petty_items (cc_id, date, ruc, provider, receipt, category, detail, amount, usd) VALUES (?,?,?,?,?,?,?,?,?)',
    args: [cc.id, date, ruc || '', provider || '', receipt || '', category || '', detail, amount, usd || null]
  });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'cc_item', entityId: Number(info.lastInsertRowid), payload: req.body, req });
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

r.delete('/:id/items/:itemId', roleRequired('admin', 'editor'), async (req, res) => {
  const ccResult = await db.execute({ sql: 'SELECT * FROM petty_cash WHERE id=? AND company_id=?', args: [req.params.id, req.user.cid] });
  const cc = ccResult.rows[0];
  if (!cc) return res.status(404).json({ error: 'Caja no encontrada' });
  await db.execute({ sql: 'DELETE FROM petty_items WHERE id=? AND cc_id=?', args: [req.params.itemId, cc.id] });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'cc_item', entityId: Number(req.params.itemId), req });
  res.json({ ok: true });
});

export default r;
