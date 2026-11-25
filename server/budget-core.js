import {normalize,suggestCategory} from './finance-core.js';
const cents=x=>Math.round(Number(x||0)*100);
const cat=x=>String(x||'Sin clasificar').trim()||'Sin clasificar';
const transfer=o=>/\b(caja chica|fondo fijo|fondo de caja|reposicion de caja)\b/.test(normalize(o.concept+' '+o.type+' '+o.category));
function order(s){return (String(s||'').match(/\b\d{4,}\b/g)||[]).map(x=>x.replace(/^0+/,'')).filter(Boolean);}
export function buildBudget(year,ops,boxes,items,links,plans,refs){
 const rows=new Map(), months=Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`), cashItems=new Map(), byOp=new Map(), candidates=new Map(), used=new Set(), review=[];
 for(const i of items){const k=Number(i.cc_id);if(!cashItems.has(k))cashItems.set(k,[]);cashItems.get(k).push(i);}
 const linked=new Map(links.map(l=>[Number(l.cash_id),Number(l.op_id)]));const opMap=new Map(ops.map(o=>[Number(o.id),o]));
 // A manually confirmed link or unique exact order + fund match may distribute an operation, never add a second expense.
 for(const b of boxes){const id=Number(b.id),manual=linked.get(id),ord=order(b.ord), eligible=ops.filter(o=>transfer(o)&&cents(o.amount)===cents(b.fund));let exact=eligible.filter(o=>ord.length&&order(o.order_number).some(x=>ord.includes(x)));
 const matching=manual?opMap.get(manual):exact.length===1?exact[0]:null;
 candidates.set(id,{b,matching,manual:!!manual,eligible});if(matching){const k=Number(matching.id);used.add(k);byOp.set(k,(byOp.get(k)||0)+1);}}
 function add(month,category,kind,n){if(!months.includes(month))return;const key=JSON.stringify([month,category]);const r=rows.get(key)||{month,category,planned:null,paid:0,pending:0};r[kind]+=n;rows.set(key,r);}
 const allocations=new Map();
 for(const {b,matching,manual,eligible} of candidates.values()){
  const id=Number(b.id),list=cashItems.get(id)||[],spent=list.reduce((s,i)=>s+cents(i.amount),0);let state='Sin vincular',good=false;
  if(matching){if(byOp.get(Number(matching.id))!==1)state='Conflicto: una operación para varias cajas';else if(cents(matching.amount)!==cents(b.fund)||!transfer(matching))state='Vínculo inválido: importe o concepto';else if(spent>cents(matching.amount))state='Gastos exceden el fondo';else if(list.length===0)state='Sin gastos para distribuir';else {state=manual?'Vinculada manualmente':'Vinculada por orden exacta';good=true;allocations.set(Number(matching.id),{list,spent});}}
  if(String(b.from_date||b.to_date||b.report_date||'').startsWith(year)||list.some(i=>String(i.date).startsWith(year))||String(matching?.date||'').startsWith(year))review.push({id,num:b.num,ord:b.ord,period:b.from_date||b.to_date||'',fund:cents(b.fund)/100,spent:spent/100,state,opId:matching?Number(matching.id):null,manual,options:eligible.filter(o=>String(o.date).startsWith(year)||Math.abs(Number(String(o.date).slice(0,4))-Number(year))<=1).map(o=>({id:Number(o.id),date:o.date,concept:o.concept,amount:Number(o.amount),order:o.order_number||''})).slice(0,100)});
 }
 for(const o of ops){const month=String(o.date).slice(0,7),kind=o.status==='Pagado'?'paid':'pending',allocation=allocations.get(Number(o.id)),n=cents(o.amount);if(!months.includes(month))continue;if(allocation){for(const i of allocation.list)add(month,cat(i.category||suggestCategory(i.detail)),kind,cents(i.amount));if(n>allocation.spent)add(month,'Caja chica · saldo sin distribuir',kind,n-allocation.spent);}else add(month,transfer(o)?'Caja chica · fondo sin distribuir':cat(o.category||suggestCategory(o.concept)),kind,n);}
 for(const p of plans){const key=JSON.stringify([p.month,p.category]);const r=rows.get(key)||{month:p.month,category:p.category,planned:null,paid:0,pending:0};r.planned=Number(p.cents);rows.set(key,r);}
 const detail=[...rows.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.category.localeCompare(b.category)).map(r=>({...r,planned:r.planned===null?null:r.planned/100,paid:r.paid/100,pending:r.pending/100,registered:(r.paid+r.pending)/100,balance:r.planned===null?null:(r.planned-r.paid-r.pending)/100}));
 const refMap=new Map(refs.map(x=>[x.month,x]));
 const totals=months.map(month=>{const r=[...rows.values()].filter(x=>x.month===month),p=r.filter(x=>x.planned!==null),planned=p.reduce((s,x)=>s+x.planned,0),paid=r.reduce((s,x)=>s+x.paid,0),pending=r.reduce((s,x)=>s+x.pending,0),unplanned=r.filter(x=>x.planned===null).reduce((s,x)=>s+x.paid+x.pending,0),reference=refMap.get(month);return {month,planned:p.length?planned/100:null,paid:paid/100,pending:pending/100,registered:(paid+pending)/100,balance:p.length?(planned-paid-pending)/100:null,unplanned:unplanned/100,reference:reference?Number(reference.cents)/100:null,referenceFile:reference?.filename||'',difference:reference?(paid+pending-Number(reference.cents))/100:null,cashDetail:items.filter(i=>String(i.date).slice(0,7)===month).reduce((s,i)=>s+cents(i.amount),0)/100};});
 return {year,detail,months:totals,cash:review};
}
