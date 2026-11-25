import express from 'express';
import { db } from '../db.js';
import { authRequired, roleRequired } from '../auth.js';
import { audit } from '../audit.js';
import {buildDirectory,directoryQueries} from '../provider-directory.js';

import {z} from 'zod';
import {validate,text,optionalText,doc} from '../validation.js';
const schema=z.object({ruc:doc,name:text(250),cci:z.string().regex(/^(\d{13}|\d{20})$/,'Cuenta de 13 o CCI de 20 dígitos'),holder:optionalText(250)});
const r = express.Router();
r.use(authRequired);

r.get('/', async (req, res) => {
  const result = await db.execute({ sql: 'SELECT * FROM providers WHERE company_id=? ORDER BY name', args: [req.user.cid] });
  res.json(result.rows);
});

// Read-only automatic directory, isolated by company. Existing manual API stays compatible.
r.get('/directory', async (req,res)=>{
  const args=[req.user.cid];
  const [manual,ops,cash]=await Promise.all(Object.values(directoryQueries).map(sql=>db.execute({sql,args})));
  res.json(buildDirectory(manual.rows,ops.rows,cash.rows));
});

r.post('/', roleRequired('admin', 'editor'), async (req, res) => {
  const b=validate(schema,req,res);if(!b)return;const {ruc,name,cci,holder}=b;
  if (!ruc || !name || !cci) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const info = await db.execute({ sql: 'INSERT INTO providers (company_id, ruc, name, cci, holder) VALUES (?,?,?,?,?)', args: [req.user.cid, ruc, name, cci, holder || null] });
    await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'create', entity: 'provider', entityId: Number(info.lastInsertRowid), payload: b, req });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'RUC/DNI ya existe' });
    throw e;
  }
});

r.delete('/:id', roleRequired('admin'), async (req, res) => {
  const q=await db.execute({sql:'DELETE FROM providers WHERE id=? AND company_id=? AND NOT EXISTS (SELECT 1 FROM ops WHERE ops.company_id=providers.company_id AND ops.ruc=providers.ruc)',args:[req.params.id,req.user.cid]});if(!q.rowsAffected)return res.status(409).json({error:'Proveedor no encontrado o vinculado a operaciones'});
  await audit({ companyId: req.user.cid, userId: req.user.uid, action: 'delete', entity: 'provider', entityId: Number(req.params.id), req });
  res.json({ ok: true });
});

export default r;
