import express from 'express';
import {db} from '../db.js';
import {authRequired,roleRequired} from '../auth.js';
import {audit} from '../audit.js';
const r=express.Router();r.use(authRequired,roleRequired('admin'));
r.get('/all.json',async(req,res)=>{
 const cid=req.user.cid;
 const [ops,prov,cc,items,batches,plans,links,refs,flowEntries,flowClassification,flowYears]=await db.batch([{sql:'SELECT * FROM ops WHERE company_id=? ORDER BY date',args:[cid]},{sql:'SELECT * FROM providers WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM petty_cash WHERE company_id=?',args:[cid]},{sql:'SELECT i.* FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id WHERE c.company_id=?',args:[cid]},{sql:'SELECT * FROM import_batches WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_lines WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_cash_links WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM budget_month_refs WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_entries WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_classification WHERE company_id=?',args:[cid]},{sql:'SELECT * FROM flow_years WHERE company_id=?',args:[cid]}],'read');
 const boxes=cc.rows.map(c=>({...c,items:items.rows.filter(i=>i.cc_id===c.id)}));
 await audit({companyId:cid,userId:req.user.uid,action:'export',entity:'backup',req});res.attachment('respaldo.json').json({generatedAt:new Date().toISOString(),ops:ops.rows,prov:prov.rows,cc:boxes,imports:batches.rows,budget:{lines:plans.rows,cashLinks:links.rows,monthlyReferences:refs.rows},flow:{entries:flowEntries.rows,classification:flowClassification.rows,years:flowYears.rows}});
});
export default r;
