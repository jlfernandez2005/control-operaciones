import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired, hashPassword } from '../auth.js';
import { audit } from '../audit.js';

import {z} from 'zod';
import {validate,text,password as passwordSchema} from '../validation.js';
const r = express.Router();
r.use(authRequired, roleRequired('admin'));

r.get('/', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT id, username, name, role, must_change, active FROM users WHERE company_id=? ORDER BY id', args: [req.user.cid] });
  res.json(result.rows);
});

r.post('/', async (req, res) => {
  const b=validate(z.object({username:text(100),name:text(200),role:z.enum(['admin','editor','lector']),password:passwordSchema}),req,res);if(!b)return;const {username,name,role,password}=b;
  if (!username || !name || !role || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const hash = await hashPassword(password);
  try {
    const info = await db.execute({ sql: 'INSERT INTO users (company_id, username, name, role, pass_hash, must_change) VALUES (?,?,?,?,?,1)', args: [req.user.cid, username, name, role, hash] });
    await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'user', entityId: Number(info.lastInsertRowid), payload: { username, name, role }, req });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Usuario ya existe' });
    throw e;
  }
});

r.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.uid) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  const q=await db.execute({sql:'UPDATE users SET active=0 WHERE id=? AND company_id=? AND active=1',args:[req.params.id,req.user.cid]});if(!q.rowsAffected)return res.status(404).json({error:'Usuario no encontrado'});
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'user', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

r.post('/:id/reset-password',async(req,res)=>{if(Number(req.params.id)===req.user.uid)return res.status(400).json({error:'No puedes restablecer tu propia contraseña desde aquí'});const b=validate(z.object({password:passwordSchema}),req,res);if(!b)return;const q=await db.execute({sql:'UPDATE users SET pass_hash=?,must_change=1,q=NULL,a_hash=NULL WHERE id=? AND company_id=? AND active=1',args:[await hashPassword(b.password),req.params.id,req.user.cid]});if(!q.rowsAffected)return res.status(404).json({error:'Usuario no encontrado'});await audit({companyId:req.user.cid,userId:req.user.uid,action:'reset_password',entity:'user',entityId:Number(req.params.id),req});res.json({ok:true});});
export default r;
