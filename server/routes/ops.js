import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', async (req, res) => {
  const { month } = req.query;
  let result;
  if (month) {
    result = await db.execute({ sql: 'SELECT * FROM ops WHERE company_id=? AND substr(date,1,7)=? ORDER BY date DESC, id DESC', args: [req.user.cid, month] });
  } else {
    result = await db.execute({ sql: 'SELECT * FROM ops WHERE company_id=? ORDER BY date DESC, id DESC', args: [req.user.cid] });
  }
  res.json(result.rows);
});

r.post('/', roleRequired('admin', 'editor'), async (req, res) => {
  const { date, concept, receipt, amount, ruc, status, bank, type } = req.body;
  if (!date || !concept || amount == null || !ruc) return res.status(400).json({ error: 'Faltan datos' });
  const signature = crypto.createHash('sha256').update(`${date}|${concept}|${amount}|${ruc}|${Date.now()}`).digest('hex');
  
  const info = await db.execute({
    sql: 'INSERT INTO ops (company_id, date, concept, receipt, amount, ruc, status, bank, type, signature, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    args: [req.user.cid, date, concept, receipt || '', amount, ruc, status || 'Pendiente', bank || 'Scotiabank', type || 'General', signature, req.user.uid]
  });
  
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'op', entityId: Number(info.lastInsertRowid), payload: req.body, req });
  res.status(201).json({ id: Number(info.lastInsertRowid), signature });
});

r.delete('/:id', roleRequired('admin'), async (req, res) => {
  const curRes = await db.execute({ sql: 'SELECT * FROM ops WHERE id=? AND company_id=?', args: [req.params.id, req.user.cid] });
  if (!curRes.rows[0]) return res.status(404).json({ error: 'No encontrada' });
  await db.execute({ sql: 'DELETE FROM ops WHERE id=?', args: [req.params.id] });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'op', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;
