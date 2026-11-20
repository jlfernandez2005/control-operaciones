import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

const r = express.Router();
r.use(authRequired);

r.get('/all.json', (req, res) => {
  const cid = req.user.cid;
  const ops = db.prepare('SELECT * FROM ops WHERE company_id=? ORDER BY date').all(cid);
  const prov = db.prepare('SELECT * FROM providers WHERE company_id=?').all(cid);
  const ccs = db.prepare('SELECT * FROM petty_cash WHERE company_id=?').all(cid);
  const stmt = db.prepare('SELECT * FROM petty_items WHERE cc_id=?');
  ccs.forEach(c => { c.items = stmt.all(c.id); });
  res.setHeader('Content-Disposition', 'attachment; filename="respaldo.json"');
  res.json({ generatedAt: new Date().toISOString(), ops, prov, cc: ccs });
});

export default r;