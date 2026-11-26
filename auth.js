import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
const stamp = u => crypto.createHmac('sha256', secret).update(u.pass_hash).digest('hex');
export const hashPassword = p => bcrypt.hash(p, 12);
export const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'), path: '/' };
export const signToken = u => jwt.sign({ uid: u.id, cid: u.company_id, v: stamp(u) }, secret, { algorithm: 'HS256', expiresIn: '8h', issuer: 'control-ops', audience: 'control-ops' });
export async function checkPassword(username, password, cid) {
  const u = (await db.execute({sql:'SELECT * FROM users WHERE company_id=? AND username=? AND active=1',args:[cid,username]})).rows[0];
  return u && await bcrypt.compare(password,u.pass_hash) ? u : null;
}
export async function authRequired(req,res,next) {
  let token;
  try { token = jwt.verify(req.cookies.token,secret,{algorithms:['HS256'],issuer:'control-ops',audience:'control-ops'}); } catch { return res.status(401).json({error:'Inicia sesión nuevamente'}); }
  try {
    const u = (await db.execute({sql:'SELECT * FROM users WHERE id=? AND company_id=? AND active=1',args:[token.uid,token.cid]})).rows[0];
    if (!u || token.v !== stamp(u)) return res.status(401).json({error:'Sesión inválida'});
    req.user={uid:u.id,cid:u.company_id,role:u.role,mustChange:!!u.must_change};
    if (u.must_change && !(req.baseUrl==='/api/auth' && ['/me','/change-password','/logout'].includes(req.path))) return res.status(403).json({error:'Debes cambiar tu contraseña primero'});
    next();
  } catch(e){next(e);}
}
export const roleRequired = (...roles) => (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({error:'No tienes permisos para esta acción'});
