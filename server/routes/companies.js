import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';

const r = express.Router();
r.use(authRequired);

r.get('/', (req, res) => res.json(db.prepare('SELECT id, name, code FROM companies ORDER BY id').all()));

r.post('/', roleRequired('admin'), (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = db.prepare('INSERT INTO companies (name, code) VALUES (?,?)').run(name, code.toUpperCase());
    res.status(201).json({ id: info.lastInsertRowid });
  } catch { res.status(409).json({ error: 'Código ya existe' }); }
});

export default r;