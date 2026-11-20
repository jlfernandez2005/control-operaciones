import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, checkPassword, authRequired, hashPassword } from '../auth.js';
import { audit } from '../audit.js';
import { z } from 'zod';

const r = express.Router();
const loginSchema = z.object({ companyCode: z.string(), username: z.string(), password: z.string() });

r.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { companyCode, username, password } = parsed.data;
  
  const companyRes = await db.execute({ sql: 'SELECT * FROM companies WHERE code=?', args: [companyCode.toUpperCase()] });
  const company = companyRes.rows[0];
  if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
  
  const user = await checkPassword(username, password, company.id);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  
  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 });
  
  await audit({ companyId: company.id, userId: user.id, action: 'login', entity: 'auth', req });
  res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role }, mustChange: !!user.must_change, company: { id: company.id, name: company.name, code: company.code } });
});

r.post('/logout', authRequired, async (req, res) => {
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'logout', entity: 'auth', req });
  res.clearCookie('token').json({ ok: true });
});

r.get('/me', authRequired, async (req, res) => {
  const uRes = await db.execute({ sql: 'SELECT id, username, name, role, must_change FROM users WHERE id=?', args: [req.user.uid] });
  const u = uRes.rows[0];
  if (!u) return res.status(401).json({ error: 'Usuario no encontrado' });
  const cRes = await db.execute({ sql: 'SELECT id, name, code FROM companies WHERE id=?', args: [req.user.cid] });
  res.json({ user: { ...u, mustChange: !!u.must_change }, company: cRes.rows[0] });
});

r.post('/change-password', authRequired, async (req, res) => {
  const { newPassword, question, answer } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const hash = await hashPassword(newPassword);
  const aHash = question && answer ? await hashPassword(answer.trim().toLowerCase()) : null;
  await db.execute({ sql: 'UPDATE users SET pass_hash=?, must_change=0, q=?, a_hash=? WHERE id=?', args: [hash, question || null, aHash, req.user.uid] });
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'change_password', entity: 'user', entityId: req.user.uid, req });
  res.json({ ok: true });
});

export default r;
