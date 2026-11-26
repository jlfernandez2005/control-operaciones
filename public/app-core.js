(function(global){
'use strict';
const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const BK={'002':'BCP','003':'Interbank','009':'Scotiabank','011':'BBVA','018':'Banco de la Nación'};
const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fm=n=>'S/ '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const isDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
const fd=d=>{if(!isDate(d))return d||'';const a=d.split('-');return a[2]+'/'+a[1]+'/'+a[0]};
const ml=f=>{if(!isDate(f))return f||'';const a=f.split('-');return a[2]+' de '+MES[a[1]-1].replace('septiembre','setiembre')};
const bank=c=>c?(c.length===13?'Interbank':(BK[c.slice(0,3)]||'REVISAR CÓDIGO')):'';
const by=o=>o.b||o.bank||'Scotiabank';
const ty=o=>o.t||o.type||'General';
const srt=L=>L.slice().sort((a,b)=>a.f<b.f?-1:a.f>b.f?1:a.id-b.id);

async function api(path, opts={}){
  const res=await fetch('/api'+path,{
    credentials:'include',
    headers:{'Content-Type':'application/json',...(opts.headers||{})},
    ...opts,
    body:opts.body?JSON.stringify(opts.body):undefined
  });
  const txt=await res.text();
  let data=null; try{data=txt?JSON.parse(txt):null}catch{data=txt}
  if(!res.ok)throw Object.assign(new Error(data?.error||'Error de red'),{status:res.status,data});
  return data;
}

// Work in integer cents so every indicator agrees with its source records.
function monthlyDetail(ops,month,metric='total',search=''){
 const rows=ops.filter(o=>String(o.date).slice(0,7)===month&&!o.deleted_at).sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.id)-Number(a.id));
 const sum=a=>a.reduce((n,o)=>n+Math.round(Number(o.amount)*100),0)/100;
 const paid=rows.filter(o=>o.status==='Pagado'),pending=rows.filter(o=>o.status!=='Pagado');
 const base=metric==='paid'?paid:metric==='pending'?pending:rows;
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const q=norm(search).trim();
 const visible=base.filter(o=>!q||norm([o.concept,o.provider_name,o.ruc,o.receipt,o.order_number,o.category,o.bank,o.status].join(' ')).includes(q));
 return {total:sum(rows),count:rows.length,average:rows.length?sum(rows)/rows.length:0,paid:sum(paid),pending:sum(pending),base,visible,subtotal:sum(visible)};
}
global.AppCore={monthlyDetail,MES,BK,$,esc,fm,isDate,fd,ml,bank,by,ty,srt,api};
})(window);