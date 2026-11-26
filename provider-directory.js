// Directory derived from existing records. No writes or inferred bank ownership.
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const validDoc=v=>/^(?:\d{8}|\d{11})$/.test(v)&&!/^([0-9])\1+$/.test(v);
const placeholder=v=>!norm(v)||/^(?:sin (?:dato(?:s)?|registrar|proveedor|comprobante|especificar|identificar)|no (?:aplica|identificado|registrado)|n a|s n|varios|proveedores varios|personal institucional|personal|voucher de deposito|cuentas del personal)$/.test(norm(v));
export const directoryQueries={
 manual:'SELECT id,ruc,name,cci,holder FROM providers WHERE company_id=?',
 ops:'SELECT id,ruc,provider_name,bank_account,bank,date,concept,receipt FROM ops WHERE company_id=? AND deleted_at IS NULL ORDER BY date DESC,id DESC',
 cash:'SELECT i.id,i.ruc,i.provider,i.date,i.detail,i.receipt FROM petty_items i JOIN petty_cash c ON c.id=i.cc_id WHERE c.company_id=? ORDER BY i.date DESC,i.id DESC'
};
export function buildDirectory(manual,ops,cash){
 const groups=new Map();
 function get(doc,name,source){
   doc=clean(doc);if(!norm(doc)||/^(?:sin (?:ruc|dni|dato|documento)|n a|s n|no aplica)$/.test(norm(doc)))doc='';name=clean(name);
   const known=validDoc(doc);
   // Unidentified names are never merged into an identified fiscal record.
   if(placeholder(name)&&!known)return null;
   if(placeholder(name)&&!groups.has('doc:'+doc))return null;
   const key=known?'doc:'+doc:'name:'+norm(name)+':'+norm(doc);
   if(!groups.has(key))groups.set(key,{key,ruc:known?doc:'',document_reference:known?'':doc,manual_id:null,manual_name:'',holder:'',cci:'',names:new Map(),accounts:new Map(),operations:0,cash_items:0,last_date:'',sources:new Set()});
   const g=groups.get(key);g.sources.add(source);
   if(!placeholder(name)&&!g.names.has(norm(name)))g.names.set(norm(name),name);
   return g;
 }
 for(const p of manual){const g=get(p.ruc,p.name,'Ficha manual');if(!g)continue;g.manual_id=Number(p.id);g.manual_name=clean(p.name);g.holder=clean(p.holder);g.cci=clean(p.cci);}
 for(const pass of [false,true])for(const [rows,source] of [[ops,'Operaciones'],[cash,'Caja chica']]){
   // Named rows across both sources first, so ID-only rows can attach to known profiles.
   for(const o of rows){
     if(placeholder(o.provider_name??o.provider)!==pass)continue;
     const name=o.provider_name??o.provider;const g=get(o.ruc,name,source);if(!g)continue;
     if(source==='Operaciones'){
       g.operations++;
       const account=clean(o.bank_account);const bank=clean(o.bank);
       // Exclude textual payment methods; only keep plausible numeric account references.
       const digits=account.replace(/[\s-]/g,'');
       if(/^\d{6,24}$/.test(digits)&&!/^([0-9])\1+$/.test(digits)){
         const key=digits+'|'+norm(bank);if(!g.accounts.has(key))g.accounts.set(key,{account,bank,date:clean(o.date)});
       }
     }else g.cash_items++;
     if(clean(o.date)>g.last_date)g.last_date=clean(o.date);
   }
 }
 return [...groups.values()].map(g=>{
   const aliases=[...g.names.values()],name=g.manual_name||aliases[0]||'';
   return {key:g.key,ruc:g.ruc,document_reference:g.document_reference,name,aliases,manual_id:g.manual_id,holder:g.holder,cci:g.cci,sources:[...g.sources],operations:g.operations,cash_items:g.cash_items,last_date:g.last_date,accounts:[...g.accounts.values()],name_conflict:aliases.length>1,account_conflict:new Set([...g.accounts.values()].map(a=>a.account.replace(/[\s-]/g,''))).size>1,kind:g.manual_id?'Ficha manual':g.cash_items?'Proveedor consignado en caja':'Beneficiario de operación',needs_review:!g.ruc||aliases.length>1||!g.manual_id&&!g.cash_items};
 }).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.key.localeCompare(b.key));
}
