import express from 'express';
import {db} from '../db.js';
import {authRequired} from '../auth.js';
const r=express.Router();r.use(authRequired);
// Un administrador pertenece a una empresa, no es administrador global.
r.get('/',async(req,res)=>res.json((await db.execute({sql:'SELECT id,name,code FROM companies WHERE id=?',args:[req.user.cid]})).rows));
export default r;
