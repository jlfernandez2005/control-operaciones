import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES = process.env.JWT_EXPIRES || '8h';

export function signToken(user) {
  return jwt.sign({ uid: user.id, cid: user.company_id, role: user.role, name: user.name }, SECRET, { expiresIn: EXPIRES });
}
export function verifyToken(token) { try { return jwt.verify(token, SECRET); } catch { return null; } }

export function authRequired(req, res, next) {
  const t = req.cookies?.token;
  if (!t) return res.status(401).json({ error: 'No autenticado' });
  const p = verifyToken(t);
  if (!p) return res.status(401).json({ error: 'Sesión inválida o expirada' });
  req.user = p; next();
}

export function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });
    next();
  };
}

export async function checkPassword(username, password, companyId) {
  const u = db.prepare('SELECT * FROM users WHERE company_id=? AND username=? AND active=1').get(companyId, username);
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.pass_hash);
  return ok ? u : null;
}
export async function hashPassword(password) { return bcrypt.hash(password, 10); }