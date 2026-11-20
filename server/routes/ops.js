import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired);

r.get('/', (req, res) => {
  const { month } = req.query;
  const rows = month
    ? db.prepare('SELECT * FROM ops WHERE company_id=? AND substr(date,1,7)=? ORDER BY date DESC, id DESC').all(req.user.cid, month)
    : db.prepare('SELECT * FROM ops WHERE company_id=? ORDER BY date DESC, id DESC').all(req.user.cid);
  res.json(rows);
});

r.post('/', roleRequired('admin', 'editor'), (req, res) => {
  const { date, concept, receipt, amount, ruc, status, bank, type } = req.body;
  if (!date || !concept || amount == null || !ruc) return res.status(400).json({ error: 'Faltan datos' });
  const signature = crypto.createHash('sha256').update(`${date}|${concept}|${amount}|${ruc}|${Date.now()}`).digest('hex');
  const info = db.prepare('INSERT INTO ops (company_id, date, concept, receipt, amount, ruc, status, bank, type, signature, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.user.cid, date, concept, receipt || '', amount, ruc, status || 'Pendiente', bank || 'Scotiabank', type || 'General', signature, req.user.uid);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'op', entityId: info.lastInsertRowid, payload: req.body, req });
  res.status(201).json({ id: info.lastInsertRowid, signature });
});

r.put('/:id', roleRequired('admin', 'editor'), (req, res) => {
  const { date, concept, receipt, amount, ruc, status, bank, type } = req.body;
  const cur = db.prepare('SELECT * FROM ops WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cur) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE ops SET date=?, concept=?, receipt=?, amount=?, ruc=?, status=?, bank=?, type=? WHERE id=?')
    .run(date ?? cur.date, concept ?? cur.concept, receipt ?? cur.receipt, amount ?? cur.amount,
         ruc ?? cur.ruc, status ?? cur.status, bank ?? cur.bank, type ?? cur.type, req.params.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'update', entity: 'op', entityId: Number(req.params.id), payload: req.body, req });
  res.json({ ok: true });
});

r.patch('/:id/status', roleRequired('admin', 'editor'), (req, res) => {
  const { status } = req.body;
  const cur = db.prepare('SELECT * FROM ops WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cur) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE ops SET status=? WHERE id=?').run(status, req.params.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'status', entity: 'op', entityId: Number(req.params.id), payload: { status }, req });
  res.json({ ok: true });
});

r.delete('/:id', roleRequired('admin'), (req, res) => {
  const cur = db.prepare('SELECT * FROM ops WHERE id=? AND company_id=?').get(req.params.id, req.user.cid);
  if (!cur) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('DELETE FROM ops WHERE id=?').run(req.params.id);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'op', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;