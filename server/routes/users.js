import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired, hashPassword } from '../auth.js';
import { audit } from '../audit.js';

const r = express.Router();
r.use(authRequired, roleRequired('admin'));

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, username, name, role, must_change, active FROM users WHERE company_id=? ORDER BY id').all(req.user.cid));
});

r.post('/', async (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username || !name || !role || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const hash = await hashPassword(password);
  try {
    const info = db.prepare('INSERT INTO users (company_id, username, name, role, pass_hash, must_change) VALUES (?,?,?,?,?,1)')
      .run(req.user.cid, username, name, role, hash);
    audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'user', entityId: info.lastInsertRowid, payload: { username, name, role }, req });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Usuario ya existe' });
    throw e;
  }
});

r.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.uid) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  db.prepare('DELETE FROM users WHERE id=? AND company_id=?').run(req.params.id, req.user.cid);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'user', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;