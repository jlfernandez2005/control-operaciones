import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';
import {digest} from './security-core.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
const stamp = u => crypto.createHmac('sha256', secret).update(u.pass_hash).digest('hex');
export const hashPassword = p => bcrypt.hash(p, 12);
export const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'), path: '/' };
export const signToken = (u,sid) => jwt.sign({ uid: u.id, cid: u.company_id, v: stamp(u), sid }, secret, { algorithm: 'HS256', expiresIn: '8h', issuer: 'control-ops', audience: 'control-ops' });
export async function newSession(u,mfa=false){const sid=crypto.randomBytes(32).toString('hex'),now=Date.now();await db.execute({sql:'DELETE FROM auth_sessions WHERE expires<? OR seen<?',args:[now,now-30*60_000]});await db.execute({sql:'INSERT INTO auth_sessions(sid_hash,company_id,user_id,created,seen,expires,mfa) VALUES(?,?,?,?,?,?,?)',args:[digest(sid),u.company_id,u.id,now,now,now+8*60*60_000,mfa?1:0]});return signToken(u,sid);}
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
    if(typeof token.sid!=='string'||!/^[a-f0-9]{64}$/.test(token.sid))return res.status(401).json({error:'Inicia sesión nuevamente'});
    const sh=digest(token.sid),now=Date.now();const session=(await db.execute({sql:'SELECT * FROM auth_sessions WHERE sid_hash=? AND company_id=? AND user_id=?',args:[sh,u.company_id,u.id]})).rows[0];
    if(!session||Number(session.expires)<=now||Number(session.seen)<=now-30*60_000)return res.status(401).json({error:'Sesión vencida. Inicia sesión nuevamente'});
    const mfa=(await db.execute({sql:'SELECT enabled FROM auth_mfa WHERE company_id=? AND user_id=?',args:[u.company_id,u.id]})).rows[0];
    if(mfa?.enabled&&!session.mfa)return res.status(401).json({error:'Inicia sesión con tu segundo factor'});
    if(now-Number(session.seen)>60_000)await db.execute({sql:'UPDATE auth_sessions SET seen=? WHERE sid_hash=? AND company_id=? AND user_id=?',args:[now,sh,u.company_id,u.id]});
    req.user={uid:u.id,cid:u.company_id,role:u.role,mustChange:!!u.must_change,sidHash:sh,mfa:!!session.mfa,payrollUntil:Number(session.payroll_until)};
    const policy=(await db.execute({sql:'SELECT require_mfa FROM erp_policy WHERE company_id=?',args:[u.company_id]})).rows[0];
    if(policy?.require_mfa&&!session.mfa&&!['/api/auth','/api/security'].includes(req.baseUrl))return res.status(403).json({error:'Configura el segundo factor en Seguridad.',enrollRequired:true});
    if (u.must_change && !(req.baseUrl==='/api/auth' && ['/me','/change-password','/logout'].includes(req.path))) return res.status(403).json({error:'Debes cambiar tu contraseña primero'});
    next();
  } catch(e){next(e);}
}
export const roleRequired = (...roles) => (req,res,next) => roles.includes(req.user?.role) ? next() : res.status(403).json({error:'No tienes permisos para esta acción'});
