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

global.AppCore={MES,BK,$,esc,fm,isDate,fd,ml,bank,by,ty,srt,api};
})(window);