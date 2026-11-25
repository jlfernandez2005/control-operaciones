import express from 'express';
import {z} from 'zod';
import crypto from 'node:crypto';
import {db} from '../db.js';
import {authRequired,roleRequired} from '../auth.js';
import {audit} from '../audit.js';
import {date,money,text,optionalText,validate} from '../validation.js';
import {categories,suggestCategory,familyFor,isTotal,dims,groupsFor,normalize,fingerprint} from '../finance-core.js';
import {financeWorker} from '../finance-worker.js';
import {reconcileCash} from '../cash-reconcile.js';
const r=express.Router();r.use(authRequired);
const editor=roleRequired('admin','editor');
const optionalDoc=z.union([z.literal(''),z.string().regex(/^(\d{8}|\d{11})$/)]).default('');
const rowSchema=z.object({date,concept:text(500).refine(s=>!isTotal(s),'No se admiten totales ni saldos'),amount:money,ruc:optionalDoc,receipt:optionalText(200),provider:optionalText(200),category:text(100),status:z.enum(['Pendiente','Pagado']),bank:optionalText(80),type:optionalText(80),reference:text(300),cci:optionalText(200),order:optionalText(80),usd:money.nullish(),currencyConfirmed:z.boolean().optional()}).refine(x=>x.usd==null||x.currencyConfirmed===true,'Confirma el importe equivalente en soles de cada operación con USD');
const fileSchema=z.object({name:text(200),data:z.string().min(1).max(34952536).regex(/^[A-Za-z0-9+/]+={0,2}$/)});
r.get('/categories',async(req,res)=>{
 const cid=req.user.cid;const [a,b]=await db.batch([{sql:'SELECT DISTINCT category FROM ops WHERE company_id=? AND category IS NOT NULL AND category<>\'\' AND deleted_at IS NULL',args:[cid]},{sql:'SELECT DISTINCT i.category FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id WHERE c.company_id=? AND i.category IS NOT NULL AND i.category<>\'\'',args:[cid]}],'read');res.json([...new Set([...categories,...a.rows.map(x=>x.category),...b.rows.map(x=>x.category)])]);
});
r.post('/preview',editor,express.json({limit:'35mb'}),async(req,res)=>{const b=validate(fileSchema,req,res);if(!b)return;try{const raw=await financeWorker('preview',b);const parsed=JSON.parse(raw.toString());res.json({...parsed,name:b.name,digest:crypto.createHash('sha256').update(Buffer.from(b.data,'base64')).digest('hex')});}catch(e){res.status(e.status||422).json({error:e.message});}});
r.post('/import',editor,async(req,res)=>{
 const b=validate(z.object({name:text(200),digest:z.string().regex(/^[a-f0-9]{64}$/),rows:z.array(rowSchema).min(1).max(500)}),req,res);if(!b)return;
 const cid=req.user.cid,uid=req.user.uid,batch=crypto.randomUUID();const unique=new Map();for(const x of b.rows){const k=fingerprint(x);if(!unique.has(k))unique.set(k,x);}
 // Batch is atomic; duplicates include archived records and repeated uploads. No overwrite.
 const statements=[{sql:'INSERT INTO import_batches(id,company_id,user_id,filename,digest,submitted) VALUES(?,?,?,?,?,?)',args:[batch,cid,uid,b.name,b.digest,b.rows.length]}];
 for(const x of unique.values()){
  const receipt=x.receipt.trim(),ruc=x.ruc.trim(),concept=x.concept.trim();
  statements.push({sql:`INSERT INTO ops(company_id,date,concept,receipt,amount,ruc,status,bank,type,signature,created_by,category,provider_name,import_batch,source_file,source_ref,bank_account,order_number,usd_reference)
  SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM ops WHERE company_id=? AND date=? AND round(amount*100)=? AND lower(trim(coalesce(ruc,'')))=lower(?) AND lower(trim(coalesce(receipt,'')))=lower(?) AND (lower(trim(concept))=lower(?) OR (?<>'' AND ?<>'')))`,args:[cid,x.date,concept,receipt,x.amount,ruc,x.status,x.bank||'Sin especificar',x.type||'General',crypto.randomUUID(),uid,x.category,x.provider,batch,b.name,x.reference,x.cci,x.order,x.usd??null,cid,x.date,Math.round(x.amount*100),ruc,receipt,concept,receipt,ruc]});
 }
 statements.push({sql:'UPDATE import_batches SET inserted=(SELECT count(*) FROM ops WHERE company_id=? AND import_batch=?) WHERE id=? AND company_id=?',args:[cid,batch,batch,cid]});
 statements.push({sql:`INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,'import','ops',?)`,args:[cid,uid,JSON.stringify({batch,file:b.name,submitted:b.rows.length,digest:b.digest})]});
 const result=await db.batch(statements,'write');const inserted=result.slice(1,1+unique.size).reduce((s,x)=>s+Number(x.rowsAffected),0);const accepted=new Set([...unique.keys()].filter((_,i)=>result[i+1].rowsAffected));const seen=new Set(),skippedRefs=[];for(const x of b.rows){const key=fingerprint(x);if(!accepted.has(key)||seen.has(key))skippedRefs.push(x.reference);seen.add(key);}res.status(201).json({batch,inserted,skipped:b.rows.length-inserted,skippedRefs});
});
// One cash liquidation per company and number; the batch is atomic and never overwrites existing cash.
const cashHeader=z.object({num:text(50),resp:text(200),area:optionalText(200),ord:optionalText(200),from_date:date,to_date:date,fund:money,report_date:date.or(z.literal('')).optional().default(''),declared_from_date:date.optional(),declared_to_date:date.optional()}).refine(x=>x.from_date<=x.to_date,'Rango inválido');
const cashRow=z.object({date,concept:text(500).refine(s=>!isTotal(s),'No se admiten totales'),amount:money,ruc:optionalText(20),receipt:optionalText(200),provider:optionalText(200),category:text(100),source_category:optionalText(100),usd:money.nullish(),reference:text(300)});
r.post('/import-cash',editor,async(req,res)=>{
 const b=validate(z.object({name:text(200),digest:z.string().regex(/^[a-f0-9]{64}$/),meta:cashHeader,declaredTotal:money.nullish(),correctedTotal:money.nullish(),correctionNote:optionalText(500),originalFund:z.number().finite().min(0).max(999999999).nullish(),rows:z.array(cashRow).min(1).max(500)}),req,res);if(!b)return;
 const cid=req.user.cid,uid=req.user.uid,batch=crypto.randomUUID(),h=b.meta;
 const reconciliation=reconcileCash(b);if(reconciliation.error)return res.status(400).json({error:reconciliation.error});
 if(b.rows.some(x=>x.date<h.from_date||x.date>h.to_date))return res.status(400).json({error:'Hay gastos fuera del periodo de caja.'});
 const stmts=[{sql:`INSERT INTO petty_cash(company_id,num,resp,area,ord,from_date,to_date,fund,import_batch,report_date,source_file) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM petty_cash WHERE company_id=? AND lower(trim(num))=lower(trim(?)))`,args:[cid,h.num,h.resp,h.area,h.ord,h.from_date,h.to_date,h.fund,batch,h.report_date||null,b.name,cid,h.num]}];
 for(const x of b.rows)stmts.push({sql:`INSERT INTO petty_items(cc_id,date,ruc,provider,receipt,category,detail,amount,usd,source_ref,source_category) SELECT id,?,?,?,?,?,?,?,?,?,? FROM petty_cash WHERE company_id=? AND import_batch=?`,args:[x.date,x.ruc,x.provider,x.receipt,x.category,x.concept,x.amount,x.usd??null,x.reference,x.source_category,cid,batch]});
 stmts.push({sql:`INSERT INTO import_batches(id,company_id,user_id,filename,digest,submitted,inserted) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM petty_cash WHERE company_id=? AND import_batch=?)`,args:[batch,cid,uid,b.name,b.digest,b.rows.length,b.rows.length,cid,batch]});
 stmts.push({sql:`INSERT INTO audit(company_id,user_id,action,entity,payload) SELECT ?,?,'import','cc',? WHERE EXISTS(SELECT 1 FROM petty_cash WHERE company_id=? AND import_batch=?)`,args:[cid,uid,JSON.stringify({batch,num:h.num,submitted:b.rows.length,...reconciliation,declaredPeriod:h.declared_from_date?[h.declared_from_date,h.declared_to_date]:null,period:[h.from_date,h.to_date]}),cid,batch]});
 const result=await db.batch(stmts,'write');if(!result[0].rowsAffected)return res.status(409).json({error:'Ya existe una caja chica con este número. No se importó ningún gasto. Revisa la caja existente.'});
 res.status(201).json({batch,inserted:b.rows.length,skipped:0});
});
r.get('/imports',editor,async(req,res)=>res.json((await db.execute({sql:'SELECT id,filename,submitted,inserted,created_at FROM import_batches WHERE company_id=? ORDER BY created_at DESC LIMIT 100',args:[req.user.cid]})).rows));
r.patch('/category',editor,async(req,res)=>{
 const b=validate(z.object({source:z.enum(['ops','cash']),ids:z.array(z.number().int().positive()).min(1).max(500),category:text(100)}),req,res);if(!b)return;
 const ids=[...new Set(b.ids)],cid=req.user.cid,marks=ids.map(()=>'?').join(',');const sql=b.source==='ops'?`UPDATE ops SET category=? WHERE company_id=? AND deleted_at IS NULL AND id IN (${marks})`:`UPDATE petty_items SET category=? WHERE cc_id IN (SELECT id FROM petty_cash WHERE company_id=?) AND id IN (${marks})`;
 const out=await db.batch([{sql,args:[b.category,cid,...ids]},{sql:'INSERT INTO audit(company_id,user_id,action,entity,payload) VALUES(?,?,?,?,?)',args:[cid,req.user.uid,'classify',b.source,JSON.stringify({ids,category:b.category})]}],'write');res.json({updated:out[0].rowsAffected});
});
const filters=z.object({source:z.enum(['ops','cash']).default('ops'),group:z.enum(Object.keys(dims)).default('category'),from:date.optional(),to:date.optional(),status:z.enum(['Pagado','Pendiente']).optional(),category:optionalText(100),search:optionalText(150),format:z.enum(['json','pdf','xlsx']).default('json')}).refine(x=>!x.from||!x.to||x.from<=x.to,'Rango de fechas inválido');
r.get('/report',async(req,res)=>{
 const check=filters.safeParse(req.query);if(!check.success)return res.status(400).json({error:'Filtros inválidos'});const f=check.data,cid=req.user.cid;
 if(f.source==='cash'&&f.status==='Pendiente')return res.status(400).json({error:'Caja chica no tiene estado pendiente'});
 const isOps=f.source==='ops',alias=isOps?'o':'i';const conditions=[isOps?'o.company_id=? AND o.deleted_at IS NULL':'c.company_id=?'],args=[cid];for(const [key,op] of [['from','>='],['to','<=']])if(f[key]){conditions.push(`${alias}.date${op}?`);args.push(f[key]);}if(isOps&&f.status){conditions.push('o.status=?');args.push(f.status);}
 const select=isOps?`SELECT o.id,o.date,o.concept,o.receipt,o.amount,o.ruc,o.status,o.bank,o.type,o.category,COALESCE(NULLIF(o.provider_name,''),p.name,'') provider,o.source_file,o.source_ref,o.import_batch,o.bank_account,o.order_number,o.usd_reference usd FROM ops o LEFT JOIN providers p ON p.company_id=o.company_id AND p.ruc=o.ruc`:`SELECT i.id,i.date,i.detail concept,i.receipt,i.amount,i.ruc,'Pagado' status,'' bank,'Caja chica' type,i.category,i.provider,c.area,c.num,i.source_ref,i.source_category,i.usd,c.source_file FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id`;
 const data=(await db.execute({sql:`${select} WHERE ${conditions.join(' AND ')} ORDER BY ${alias}.date,${alias}.id LIMIT 10001`,args})).rows;if(data.length>10000)return res.status(422).json({error:'Más de 10000 registros. Reduce el periodo.'});
 let rows=data.map(x=>({id:Number(x.id),date:String(x.date),month:String(x.date).slice(0,7),year:String(x.date).slice(0,4),concept:String(x.concept||''),receipt:String(x.receipt||''),amount:Number(x.amount),ruc:String(x.ruc||''),status:String(x.status),bank:String(x.bank||'Sin dato'),type:String(x.type||'General'),category:String(x.category||'Sin clasificar'),provider:String(x.provider||x.ruc||'Sin dato'),area:isOps?'Sin dato':String(x.area||x.num||'Sin dato'),source:isOps?(x.import_batch?'Importado':'Manual'):'Caja chica',reference:[isOps?'':x.num,x.source_file,x.source_ref].filter(Boolean).join(' · '),cci:String(x.bank_account||''),order:String(x.order_number||''),usd:x.usd==null?'':Number(x.usd),source_category:String(x.source_category||''),suggestion:suggestCategory(x.concept)}));
 rows=rows.map(x=>({...x,family:familyFor(x.category,x.concept),familyCategory:`${familyFor(x.category,x.concept)} · ${x.category}`,categoryMonth:`${x.month} · ${x.category}`,categoryYear:`${x.year} · ${x.category}`}));
 if(f.category)rows=rows.filter(x=>x.category===f.category);if(f.search){const q=normalize(f.search);rows=rows.filter(x=>normalize([x.concept,x.provider,x.ruc,x.receipt,x.reference].join(' ')).includes(q));}
 const dimensions=Object.fromEntries(Object.entries(dims).filter(([k])=>isOps?k!=='area':!['bank','status','type','source'].includes(k)));if(!dimensions[f.group])return res.status(400).json({error:'Agrupación no disponible para este origen'});
 const allGroups=Object.fromEntries(Object.keys(dimensions).map(k=>[k,groupsFor(rows,k)]));const groups=allGroups[f.group];const total=groupsFor(rows.map(x=>({...x,total:'Total'})),'total')[0]||{count:0,amount:0,paid:0,pending:0};
 const company=(await db.execute({sql:'SELECT name FROM companies WHERE id=?',args:[cid]})).rows[0]?.name||'';const title=`${isOps?'Operaciones':'Caja chica'} por ${dimensions[f.group].toLowerCase()}`;
 const context=`${company} | ${f.from||'Inicio'} a ${f.to||'Fin'} | Estado: ${f.status||'Todos'} | Rubro: ${f.category||'Todos'} | Búsqueda: ${f.search||'Todas'} | Moneda: PEN (S/). ${isOps?'Pagado y pendiente se presentan por separado.':'Gastos de caja, sin sumar fondos asignados.'} Familias sugeridas para rubros sin clasificar; no se cambia el rubro original. No combina operaciones y caja chica para evitar duplicidad.`;
 const p={title,context,dimension:dimensions[f.group],dimensions,group:f.group,groups,allGroups,totals:total,rows};
 if(f.format==='json')return res.json(p);
 if(rows.length>2000&&f.format==='pdf')return res.status(422).json({error:'El PDF admite hasta 2000 registros. Reduce el periodo o exporta Excel.'});
 try{const result=await financeWorker(f.format,p);await audit({companyId:cid,userId:req.user.uid,action:'export',entity:'report',payload:{...f,count:rows.length},req});res.attachment(`SISFIA-${f.source}-${f.group}.${f.format}`).type(f.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(result);}catch(e){res.status(e.status||422).json({error:e.message});}
});
export default r;
