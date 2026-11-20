import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';

const r = express.Router();
r.use(authRequired, roleRequired('admin'));

r.get('/', (req, res) => {
  const { user, action, entity, from, to, limit = 200, offset = 0 } = req.query;
  const where = ['a.company_id = ?'];
  const params = [req.user.cid];
  if (user) { where.push('a.user_id = ?'); params.push(Number(user)); }
  if (action) { where.push('a.action = ?'); params.push(action); }
  if (entity) { where.push('a.entity = ?'); params.push(entity); }
  if (from) { where.push('date(a.created_at) >= date(?)'); params.push(from); }
  if (to) { where.push('date(a.created_at) <= date(?)'); params.push(to); }

  const sql = `SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.payload,
                      a.ip, a.ua, u.username, u.name AS user_name
               FROM audit a LEFT JOIN users u ON u.id = a.user_id
               WHERE ${where.join(' AND ')}
               ORDER BY a.id DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, Number(limit), Number(offset));
  const total = db.prepare(`SELECT COUNT(*) c FROM audit a WHERE ${where.join(' AND ')}`).get(...params).c;
  res.json({ total, rows });
});

r.get('/export.csv', (req, res) => {
  const rows = db.prepare(`SELECT a.id, a.created_at, u.username, a.action, a.entity, a.entity_id, a.ip, a.payload
                           FROM audit a LEFT JOIN users u ON u.id = a.user_id
                           WHERE a.company_id = ? ORDER BY a.id DESC`).all(req.user.cid);
  const header = 'id,created_at,username,action,entity,entity_id,ip,payload\n';
  const body = rows.map(x => [x.id, x.created_at, x.username || '', x.action, x.entity, x.entity_id || '', x.ip || '', (x.payload || '')]
    .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="auditoria.csv"');
  res.send(header + body);
});

export default r;