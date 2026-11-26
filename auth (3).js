import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, checkPassword, authRequired, hashPassword, cookieOptions } from '../auth.js';
import { audit } from '../audit.js';
import { z } from 'zod';
import { validate, text, password } from '../validation.js';
const r=express.Router();
const setCookie=(res,u)=>res.cookie('token',signToken(u),{...cookieOptions,maxAge:8*60*60*1000});
r.post('/login',rateLimit({windowMs:15*60_000,max:15,standardHeaders:true,legacyHeaders:false,message:{error:'Demasiados intentos. Intenta más tarde.'}}),async(req,res)=>{
 const b=validate(z.object({companyCode:text(50),username:text(100),password:z.string().min(1).max(200)}),req,res);if(!b)return;
 const company=(await db.execute({sql:'SELECT id,name,code FROM companies WHERE code=?',args:[b.companyCode.toUpperCase()]})).rows[0];
 const u=company && await checkPassword(b.username,b.password,company.id);
 if(!u)return res.status(401).json({error:'Credenciales inválidas'});
 await audit({companyId:company.id,userId:u.id,action:'login',entity:'auth',req});setCookie(res,u);
 res.json({user:{id:u.id,username:u.username,name:u.name,role:u.role,mustChange:!!u.must_change},mustChange:!!u.must_change,company});
});
r.post('/logout',authRequired,async(req,res)=>{await audit({companyId:req.user.cid,userId:req.user.uid,action:'logout',entity:'auth',req});res.clearCookie('token',cookieOptions).json({ok:true});});
r.get('/me',authRequired,async(req,res)=>{
 const u=(await db.execute({sql:'SELECT id,username,name,role,must_change FROM users WHERE id=? AND company_id=?',args:[req.user.uid,req.user.cid]})).rows[0];
 const company=(await db.execute({sql:'SELECT id,name,code FROM companies WHERE id=?',args:[req.user.cid]})).rows[0];res.json({user:{...u,mustChange:!!u.must_change},company});
});
r.post('/change-password',authRequired,async(req,res)=>{
 const b=validate(z.object({newPassword:password,currentPassword:z.string().max(200).optional()}),req,res);if(!b)return;
 const u=(await db.execute({sql:'SELECT * FROM users WHERE id=? AND company_id=?',args:[req.user.uid,req.user.cid]})).rows[0];
 if(!u.must_change && (!b.currentPassword || !await bcrypt.compare(b.currentPassword,u.pass_hash))) return res.status(403).json({error:'Contraseña actual incorrecta'});
 if(await bcrypt.compare(b.newPassword,u.pass_hash))return res.status(400).json({error:'Elige una contraseña diferente'});
 const hash=await hashPassword(b.newPassword);await db.execute({sql:'UPDATE users SET pass_hash=?,must_change=0,q=NULL,a_hash=NULL WHERE id=? AND company_id=?',args:[hash,u.id,u.company_id]});
 await audit({companyId:u.company_id,userId:u.id,action:'change_password',entity:'user',entityId:u.id,req});setCookie(res,{...u,pass_hash:hash});res.json({ok:true});
});
export default r;
