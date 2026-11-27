import express from 'express';
import {db} from '../db.js';
import {authRequired,roleRequired} from '../auth.js';
import {audit} from '../audit.js';
import {keyAvailable,seal} from '../security-core.js';
const r=express.Router();r.use(authRequired,roleRequired('admin'));
r.get('/all.json',async(req,res)=>{
 const cid=req.user.cid,encrypted=keyAvailable();
 if(!encrypted)return res.status(503).json({error:'Configura una clave de cifrado válida antes de descargar el respaldo.'});
 if(!req.user.mfa||req.user.payrollUntil<=Date.now())return res.status(403).json({error:'Activa MFA, inicia sesión y desbloquea Planillas desde Seguridad antes de descargar el respaldo.'});
 const [ops,prov,cc,items,batches,plans,links,refs,flowEntries,flowClassification,flowYears,treasury,dateLinks]=await db.batch([{sql:'SELECT * FROM ops WHERE company_id=? ORDER BY date',args:[cid]},{sql:'SELECT * FROM providers WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM petty_cash WHERE company_id=?',args:[cid]},{sql:'SELECT i.* FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id WHERE c.company_id=?',args:[cid]},{sql:'SELECT * FROM import_batches WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_lines WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_cash_links WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_month_refs WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_entries WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_classification WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_years WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM treasury_documents WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_date_links WHERE company_id=?',args:[cid]}],'read');
 const boxes=cc.rows.map(c=>({...c,items:items.rows.filter(i=>i.cc_id===c.id)}));
 const content={generatedAt:new Date().toISOString(),ops:ops.rows,prov:prov.rows,cc:boxes,imports:batches.rows,budget:{lines:plans.rows,cashLinks:links.rows,monthlyReferences:refs.rows,dateLinks:dateLinks.rows},flow:{entries:flowEntries.rows,classification:flowClassification.rows,years:flowYears.rows},treasury:treasury.rows};
 if(encrypted){const q=await db.batch([{sql:'SELECT * FROM payroll_documents WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM payroll_history WHERE company_id=?',args:[cid]}],'read');content.payroll={documents:q[0].rows,history:q[1].rows};}
 content.dailyBatches=(await db.execute({sql:'SELECT * FROM daily_batches WHERE company_id=?',args:[cid]})).rows;
 content.erp={};for(const table of ['erp_access','erp_policy','erp_records','erp_attachments','erp_allocations','erp_bank_links','erp_bank_members','erp_periods'])content.erp[table]=(await db.execute({sql:`SELECT * FROM ${table} WHERE company_id=?`,args:[cid]})).rows;
 await audit({companyId:cid,userId:req.user.uid,action:'export',entity:'backup',payload:{encrypted},req});
 return res.attachment('SISFIA-respaldo-cifrado.json').json({version:1,company:cid,payload:seal(content,`general-backup:${cid}`)});
});
export default r;
