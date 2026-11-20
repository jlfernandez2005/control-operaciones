import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, checkPassword, authRequired, hashPassword } from '../auth.js';
import { audit } from '../audit.js';
import { z } from 'zod';

const r = express.Router();
const loginSchema = z.object({
  companyCode: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1)
});

r.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { companyCode, username, password } = parsed.data;
  const company = db.prepare('SELECT * FROM companies WHERE code=?').get(companyCode.toUpperCase());
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
  const user = await checkPassword(username, password, company.id);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = signToken(user);
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000
  });
  audit({ companyId: company.id, userId: user.id, action: 'login', entity: 'auth', req });
  res.json({
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
    mustChange: !!user.must_change,
    company: { id: company.id, name: company.name, code: company.code }
  });
});

r.post('/logout', authRequired, (req, res) => {
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'logout', entity: 'auth', req });
  res.clearCookie('token').json({ ok: true });
});

r.get('/me', authRequired, (req, res) => {
  const u = db.prepare('SELECT id, username, name, role, must_change FROM users WHERE id=?').get(req.user.uid);
  if (!u) return res.status(401).json({ error: 'Usuario no encontrado' });
  const c = db.prepare('SELECT id, name, code FROM companies WHERE id=?').get(req.user.cid);
  res.json({ user: { ...u, mustChange: !!u.must_change }, company: c });
});

r.post('/change-password', authRequired, async (req, res) => {
  const { newPassword, question, answer } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const hash = await hashPassword(newPassword);
  const aHash = question && answer ? await hashPassword(answer.trim().toLowerCase()) : null;
  db.prepare('UPDATE users SET pass_hash=?, must_change=0, q=?, a_hash=? WHERE id=?')
    .run(hash, question || null, aHash, req.user.uid);
  audit({ companyId: req.user.cid, userId: req.user.uid, action: 'change_password', entity: 'user', entityId: req.user.uid, req });
  res.json({ ok: true });
});

r.post('/recover', async (req, res) => {
  const { companyCode, username, answer, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const company = db.prepare('SELECT * FROM companies WHERE code=?').get((companyCode || '').toUpperCase());
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
  const u = db.prepare('SELECT * FROM users WHERE company_id=? AND username=? AND active=1').get(company.id, username);
  if (!u || !u.q || !u.a_hash) return res.status(400).json({ error: 'Recuperación no configurada' });
  const ok = await bcrypt.compare(answer.trim().toLowerCase(), u.a_hash).catch(() => false);
  if (!ok) return res.status(401).json({ error: 'Respuesta incorrecta' });
  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET pass_hash=?, must_change=0 WHERE id=?').run(hash, u.id);
  audit({ companyId: company.id, userId: u.id, action: 'recover', entity: 'user', entityId: u.id, req });
  res.json({ ok: true });
});

export default r;