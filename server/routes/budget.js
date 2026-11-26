import {dateModel,prepareLink} from '../date-reconcile.js';
import crypto from 'node:crypto';
import {reconcile} from '../reconciliation.js';
import {sunatConflict,sunatConcept} from '../sunat-payment.js';
import express from 'express';
import {z} from 'zod';
import {db} from '../db.js';
import {authRequired,roleRequired} from '../auth.js';
import {validate,text,date,money} from '../validation.js';
import {buildBudget} from '../budget-core.js';
import {isTotal} from '../finance-core.js';
import {financeWorker} from '../finance-worker.js';
const r=express.Router();r.use(authRequired);const editor=roleRequired('admin','editor');
const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), amount=z.number().finite().min(0).max(999999999).refine(x=>Math.abs(x*100-Math.round(x*100))<.0001);
async function data(cid,year){const q=await db.batch([{sql:'SELECT id,date,concept,type,category,amount,status,order_number,receipt,ruc,provider_name,bank FROM ops WHERE company_id=? AND deleted_at IS NULL',args:[cid]},{sql:'SELECT * FROM petty_cash WHERE company_id=?',args:[cid]},{sql:'SELECT i.* FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id WHERE c.company_id=?',args:[cid]},{sql:'SELECT cash_id,op_id FROM budget_cash_links WHERE company_id=?',args:[cid]},{sql:'SELECT month,category,cents FROM budget_lines WHERE company_id=? AND substr(month,1,4)=?',args:[cid,year]},{sql:'SELECT month,cents,filename,details_json,declared_cents FROM budget_month_refs WHERE company_id=? AND substr(month,1,4)=?',args:[cid,year]},{sql:'SELECT * FROM budget_date_links WHERE company_id=? AND substr(target_date,1,4)=? ORDER BY id',args:[cid,year]},{sql:"SELECT * FROM treasury_documents WHERE company_id=? AND kind='bank' AND substr(month,1,4)=?",args:[cid,year]}],'read');const m=dateModel(year,q[0].rows,q[5].rows,q[6].rows,q[7].rows);const p=buildBudget(year,m.ops,...q.slice(1,6).map(x=>x.rows));return {...p,referenceDays:m.referenceDays,dateCandidates:m.candidates,dateLinks:m.history};}
r.get('/',async(req,res)=>{const {year,format='json',month:filter}=req.query;if(typeof year!=='string'||!/^20\d{2}$/.test(year)||!['json','pdf','xlsx'].includes(format)||filter&&(!month.safeParse(filter).success||!filter.startsWith(year)))return res.status(400).json({error:'Periodo inválido'});const p=await data(req.user.cid,year);if(filter){p.months=p.months.filter(x=>x.month===filter);p.detail=p.detail.filter(x=>x.month===filter);p.familyDetail=p.familyDetail.filter(x=>x.month===filter);p.cash=p.cash.filter(x=>x.period.slice(0,7)===filter);p.referenceDays=p.referenceDays.filter(x=>x.date.startsWith(filter));p.dateCandidates=p.dateCandidates.filter(x=>x.targetDate.startsWith(filter));p.dateLinks=p.dateLinks.filter(x=>x.targetDate.startsWith(filter));}if(format==='json')return res.json(p);p.company=(await db.execute({sql:'SELECT name FROM companies WHERE id=?',args:[req.user.cid]})).rows[0]?.name||'';p.period=filter||year;const result=await financeWorker('budget-'+format,p);res.attachment(`SISFIA-presupuesto-${filter||year}.${format}`).type(format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(result);});
// Reversible grouping; no INSERT/UPDATE of ops, no new expense.
r.post('/date-links',editor,async(req,res)=>{const b=validate(z.object({sourceDate:date,targetDate:date,ids:z.array(z.number().int().positive()).min(1).max(500),reason:z.string().trim().min(5).max(500)}),req,res);if(!b)return;const cid=req.user.cid,tx=await db.transaction('write');try{const m=b.targetDate.slice(0,7);const ops=(await tx.execute({sql:'SELECT * FROM ops WHERE company_id=? AND deleted_at IS NULL AND substr(date,1,7)=?',args:[cid,m]})).rows,refs=(await tx.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,m]})).rows,links=(await tx.execute({sql:'SELECT * FROM budget_date_links WHERE company_id=? AND substr(target_date,1,7)=? ORDER BY id',args:[cid,m]})).rows,banks=(await tx.execute({sql:"SELECT * FROM treasury_documents WHERE company_id=? AND kind='bank' AND month=?",args:[cid,m]})).rows;const result=prepareLink(m.slice(0,4),ops,refs,links,banks,b);if(result.error){await tx.rollback();return res.status(409).json(result);}const a=await tx.execute({sql:'INSERT INTO budget_date_links(company_id,source_date,target_date,cents,payload,reason,created_by) VALUES(?,?,?,?,?,?,?)',args:[cid,b.sourceDate,b.targetDate,result.cents,JSON.stringify(result.payload),b.reason,req.user.uid]});const id=Number(a.lastInsertRowid);await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,entity_id,payload) VALUES(?,?,'link','date_reconciliation',?,?)",args:[cid,req.user.uid,id,JSON.stringify({...b,...result})]});await tx.commit();res.status(201).json({id});}catch(e){try{await tx.rollback()}catch{}throw e;}finally{tx.close();}});
r.delete('/date-links/:id',editor,async(req,res)=>{const id=Number(req.params.id),cid=req.user.cid;if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Vínculo inválido'});const tx=await db.transaction('write');try{const old=(await tx.execute({sql:'SELECT * FROM budget_date_links WHERE company_id=? AND id=?',args:[cid,id]})).rows[0];if(!old){await tx.rollback();return res.status(404).json({error:'Vínculo no encontrado'});}await tx.execute({sql:'DELETE FROM budget_date_links WHERE company_id=? AND id=?',args:[cid,id]});await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,entity_id,payload) VALUES(?,?,'unlink','date_reconciliation',?,?)",args:[cid,req.user.uid,id,JSON.stringify(old)]});await tx.commit();res.json({ok:true});}catch(e){try{await tx.rollback()}catch{}throw e;}finally{tx.close();}});
// Explicit confirmation converts a SUNAT reference into an actual operation, atomically.
r.post('/direct',editor,async(req,res)=>{
 const b=validate(z.object({date,amount:money,concept:text(500),status:z.enum(['Pendiente','Pagado'])}),req,res);if(!b)return;
 const cid=req.user.cid,tx=await db.transaction('write');
 try{
  const ref=(await tx.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,b.date.slice(0,7)]})).rows[0];
  const ops=(await tx.execute({sql:'SELECT * FROM ops WHERE company_id=? AND deleted_at IS NULL AND substr(date,1,7)=?',args:[cid,b.date.slice(0,7)]})).rows;
  const match=ref&&reconcile(b.date.slice(0,4),ops,[ref]).referenceDays.find(x=>x.date===b.date&&x.directConcept===b.concept&&Math.round(x.directSuggested*100)===Math.round(b.amount*100));
  if(!match){await tx.rollback();return res.status(409).json({error:'La referencia cambió o el pago ya existe. Actualiza la conciliación.'});}
  const signature=crypto.randomUUID();
  const q=await tx.execute({sql:`INSERT INTO ops(company_id,date,concept,amount,ruc,status,bank,type,category,provider_name,signature,created_by,source_file,source_ref) VALUES(?,?,?,?,'',?,'No especificado','Pago directo','Tributos y tasas','SUNAT',?,?,?,?)`,args:[cid,b.date,b.concept,b.amount,b.status,signature,req.user.uid,ref.filename,match.sourceRef||'Resumen mensual · '+b.date]});
  const id=Number(q.lastInsertRowid);
  await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,entity_id,payload) VALUES(?,?,'create','op',?,?)",args:[cid,req.user.uid,id,JSON.stringify({source:'conciliación mensual',...b,fiscalPeriod:match.fiscalPeriod})]});
  await tx.commit();return res.status(201).json({id});
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
});
// Manual monthly SUNAT payment, even when no reference has been imported yet.
r.post('/direct/manual',editor,async(req,res)=>{
 const b=validate(z.object({date, fiscalPeriod:month,amount:money,status:z.enum(['Pendiente','Pagado']),receipt:z.string().trim().max(200).default(''),bank:text(80),detail:z.string().trim().max(300).default(''),distinctConfirmed:z.boolean().default(false)}),req,res);if(!b)return;
 const cid=req.user.cid,tx=await db.transaction('write');
 try{
  const ops=(await tx.execute({sql:'SELECT * FROM ops WHERE company_id=? AND deleted_at IS NULL',args:[cid]})).rows;
  const conflict=sunatConflict(ops,b);if(conflict){await tx.rollback();return res.status(409).json({error:conflict.reason+' Operación #'+conflict.id,existingId:Number(conflict.id)});}
  const ref=(await tx.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,b.date.slice(0,7)]})).rows[0];
  const day=ref&&reconcile(b.date.slice(0,4),ops,[ref]).referenceDays.find(x=>x.date===b.date&&Math.round(x.directSuggested*100)===Math.round(b.amount*100)&&x.directSuggested>0);
  const concept=sunatConcept(b.fiscalPeriod,b.detail);
  const q=await tx.execute({sql:`INSERT INTO ops(company_id,date,concept,receipt,amount,ruc,status,bank,type,category,provider_name,signature,created_by,source_file,source_ref) VALUES(?,?,?,?,?,'',?,?,'Pago directo','Tributos y tasas','SUNAT',?,?,?,?)`,args:[cid,b.date,concept,b.receipt,b.amount,b.status,b.bank,crypto.randomUUID(),req.user.uid,day?ref.filename:'',day?(day.sourceRef||'Resumen mensual · '+b.date):'Pago SUNAT manual']});
  const id=Number(q.lastInsertRowid);
  await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,entity_id,payload) VALUES(?,?,'create','op',?,?)",args:[cid,req.user.uid,id,JSON.stringify({source:'registro SUNAT mensual',...b,matchedReference:!!day})]});
  await tx.commit();return res.status(201).json({id,matchedReference:!!day});
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
});
r.put('/plan',editor,async(req,res)=>{const b=validate(z.object({lines:z.array(z.object({month,category:text(100),amount:amount.nullable()})).min(1).max(500)}),req,res);if(!b)return;const cid=req.user.cid;const statements=b.lines.map(x=>x.amount===null?{sql:'DELETE FROM budget_lines WHERE company_id=? AND month=? AND category=?',args:[cid,x.month,x.category]}:{sql:'INSERT INTO budget_lines(company_id,month,category,cents) VALUES(?,?,?,?) ON CONFLICT(company_id,month,category) DO UPDATE SET cents=excluded.cents',args:[cid,x.month,x.category,Math.round(x.amount*100)]});statements.push({sql:"INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,'update','budget',?)",args:[cid,req.user.uid,JSON.stringify({lines:b.lines.length})]});await db.batch(statements,'write');res.json({ok:true});});
const refRevision=x=>x?crypto.createHash('sha256').update(JSON.stringify([x.month,x.cents,x.filename,x.details_json,x.declared_cents,x.updated_at])).digest('hex'):null;
const refView=x=>({month:x.month,amount:Number(x.cents)/100,filename:x.filename,declared:x.declared_cents==null?null:Number(x.declared_cents)/100,rows:x.details_json?JSON.parse(x.details_json):[],updatedAt:x.updated_at,revision:refRevision(x)});
r.get('/reference',async(req,res)=>{
 const year=req.query.year;if(typeof year!=='string'||!/^20\d{2}$/.test(year))return res.status(400).json({error:'Año inválido'});
 const refs=(await db.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND substr(month,1,4)=? ORDER BY month',args:[req.user.cid,year]})).rows;
 const b=await data(req.user.cid,year);res.json(refs.map(x=>({...refView(x),reconciliation:b.months.find(m=>m.month===x.month)})));
});
r.get('/reference/:month/export',async(req,res)=>{
 const m=req.params.month,format=req.query.format;if(!month.safeParse(m).success||!['pdf','xlsx'].includes(format))return res.status(400).json({error:'Periodo o formato inválido'});
 const ref=(await db.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[req.user.cid,m]})).rows[0];if(!ref)return res.status(404).json({error:'Resumen no encontrado'});
 const b=await data(req.user.cid,m.slice(0,4));const company=(await db.execute({sql:'SELECT name FROM companies WHERE id=?',args:[req.user.cid]})).rows[0]?.name||'';
 const result=await financeWorker('reference-'+format,{...refView(ref),company,reconciliation:b.months.find(x=>x.month===m),days:b.referenceDays.filter(x=>x.date.startsWith(m+'-'))});
 res.attachment(`SISFIA-resumen-operaciones-${m}.${format}`).type(format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(result);
});
r.put('/reference',editor,async(req,res)=>{
 const schema=z.object({month,amount,filename:text(200),declared:amount.nullable().optional(),expectedRevision:z.string().length(64).nullable().optional(),rows:z.array(z.object({date,concept:text(500).refine(s=>!isTotal(s)),amount:money,reference:text(300)})).min(1).max(3000).optional()}).superRefine((x,ctx)=>{if(x.rows&&(x.rows.some(r=>!r.date.startsWith(x.month))||x.rows.reduce((s,r)=>s+Math.round(r.amount*100),0)!==Math.round(x.amount*100)))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Las fechas y la suma del detalle deben coincidir con el mes y el total.'});});
 const b=validate(schema,req,res);if(!b)return;const cid=req.user.cid,tx=await db.transaction('write');
 try{
 const before=(await tx.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,b.month]})).rows[0];
 if(b.expectedRevision!==undefined&&refRevision(before)!==b.expectedRevision){await tx.rollback();return res.status(409).json({error:'El resumen cambió. Actualiza la lista antes de editar.'});}
 await tx.execute({sql:`INSERT INTO budget_month_refs(company_id,month,cents,filename,details_json,declared_cents) VALUES(?,?,?,?,?,?) ON CONFLICT(company_id,month) DO UPDATE SET cents=excluded.cents,filename=excluded.filename,details_json=excluded.details_json,declared_cents=excluded.declared_cents,updated_at=datetime('now')`,args:[cid,b.month,Math.round(b.amount*100),b.filename,b.rows?JSON.stringify(b.rows):null,b.declared==null?null:Math.round(b.declared*100)]});
 await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,'update','budget_reference',?)",args:[cid,req.user.uid,JSON.stringify({month:b.month,amount:b.amount,declared:b.declared,filename:b.filename,rows:b.rows?.length||0,before:before?refView(before):null})]});await tx.commit();res.json({ok:true});
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
});
r.delete('/reference/:month',roleRequired('admin'),async(req,res)=>{
 const m=req.params.month,revision=req.query.revision;if(!month.safeParse(m).success||typeof revision!=='string'||!/^([a-f0-9]{64})$/.test(revision))return res.status(400).json({error:'Referencia inválida'});
 const cid=req.user.cid,tx=await db.transaction('write');try{
 const before=(await tx.execute({sql:'SELECT * FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,m]})).rows[0];if(!before){await tx.rollback();return res.status(404).json({error:'Resumen no encontrado'});}
 if(refRevision(before)!==revision){await tx.rollback();return res.status(409).json({error:'El resumen cambió. Actualiza la lista.'});}
 await tx.execute({sql:'DELETE FROM budget_month_refs WHERE company_id=? AND month=?',args:[cid,m]});
 await tx.execute({sql:"INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,'delete','budget_reference',?)",args:[cid,req.user.uid,JSON.stringify({month:m,before:refView(before)})]});await tx.commit();res.json({ok:true});
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{tx.close();}
});
r.put('/link',editor,async(req,res)=>{const b=validate(z.object({cashId:z.number().int().positive(),opId:z.number().int().positive().nullable()}),req,res);if(!b)return;const cid=req.user.cid;const cash=(await db.execute({sql:'SELECT id,fund FROM petty_cash WHERE company_id=? AND id=?',args:[cid,b.cashId]})).rows[0];if(!cash)return res.status(404).json({error:'Caja no encontrada'});if(b.opId!==null){const op=(await db.execute({sql:'SELECT id,amount,concept,type,category FROM ops WHERE company_id=? AND id=? AND deleted_at IS NULL',args:[cid,b.opId]})).rows[0];if(!op||Math.round(op.amount*100)!==Math.round(cash.fund*100)||!/\b(caja chica|fondo fijo|fondo de caja|reposici[oó]n de caja)\b/i.test(op.concept+' '+op.type+' '+op.category))return res.status(400).json({error:'Selecciona una operación de caja chica por el mismo fondo.'});const other=(await db.execute({sql:'SELECT cash_id FROM budget_cash_links WHERE company_id=? AND op_id=? AND cash_id<>?',args:[cid,b.opId,b.cashId]})).rows[0];if(other)return res.status(409).json({error:'Operación ya vinculada a otra caja.'});}
await db.batch([b.opId===null?{sql:'DELETE FROM budget_cash_links WHERE company_id=? AND cash_id=?',args:[cid,b.cashId]}:{sql:'INSERT INTO budget_cash_links(company_id,cash_id,op_id) VALUES(?,?,?) ON CONFLICT(company_id,cash_id) DO UPDATE SET op_id=excluded.op_id',args:[cid,b.cashId,b.opId]},{sql:"INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,'update','budget_link',?)",args:[cid,req.user.uid,JSON.stringify(b)]}],'write');res.json({ok:true});});
export default r;
