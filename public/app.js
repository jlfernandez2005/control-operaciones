(function(){
'use strict';
const {$,esc,fm,fd,ml,bank,by,ty,srt,api}=AppCore;
const state={user:null,company:null,ops:[],prov:[],cc:[],archive:false};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isAdmin=()=>state.user?.role==='admin';
const canEdit=()=>state.user?.role!=='lector';
const total=L=>L.reduce((s,o)=>s+Math.round(Number(o.amount)*100),0)/100;
const refresh=async()=>{await loadAll();drawDash();drawReg();drawRes();drawPrv();drawCC();FinanceUI.loadCats().catch(()=>{});};
const run=fn=>async e=>{const target=e?.currentTarget;const b=target?.tagName==='BUTTON'?target:target?.tagName==='FORM'?target.querySelector('[type=submit]'):null;if(b?.disabled){e?.preventDefault();return;}if(b)b.disabled=true;try{await fn(e)}catch(err){toast(err.message)}finally{if(b)b.disabled=false}};
window.addEventListener('unhandledrejection',e=>{e.preventDefault();toast(e.reason?.message||'No se pudo completar la acción')});

function toast(m){const t=$('#ts');t.textContent=m;t.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove('show'),3200)}
function show(id,on){$(id).classList.toggle('hidden',!on)}
function setMsg(sel,txt,cls){const e=$(sel);e.textContent=txt;e.className='msg '+(cls||'')}

(async function boot(){
  try{
    const r=await api('/auth/me');
    state.user=r.user;state.company=r.company;
    if(r.user.mustChange){show('#login-form',false);show('#firstpass-form',true);return}
    await loadAll();
    enterApp();
  }catch{
    show('#login-view',true);show('#app-view',false);
  }finally{show('#boot-status',false)}
})();

async function loadAll(){
  const [ops,prov,cc]=await Promise.all([api('/ops'),api('/prov'),api('/cc')]);
  state.ops=ops;state.prov=prov;state.cc=cc;
}

$('#login-form').onsubmit=async e=>{
  e.preventDefault();
  setMsg('#l-msg','','');
  try{
    const r=await api('/auth/login',{method:'POST',body:{
      companyCode:$('#l-company').value.trim(),
      username:$('#l-user').value.trim(),
      password:$('#l-pass').value
    }});
    state.user=r.user;state.company=r.company;
    if(r.mustChange){show('#login-form',false);show('#firstpass-form',true);return}
    await loadAll();enterApp();
  }catch(err){setMsg('#l-msg','⚠ '+err.message,'bad')}
};

$('#firstpass-form').onsubmit=async e=>{
  e.preventDefault();
  try{
    await api('/auth/change-password',{method:'POST',body:{
      newPassword:$('#fp-pass').value
    }});
    state.user=(await api('/auth/me')).user;await loadAll();enterApp();
  }catch(err){setMsg('#fp-msg','⚠ '+err.message,'bad')}
};

$('#go-recover').onclick=()=>{show('#login-form',false);show('#recover-form',true)};
$('#go-login').onclick=()=>{show('#recover-form',false);show('#login-form',true)};

function enterApp(){
  show('#login-view',false);show('#app-view',true);
  $('#u-name').textContent=state.user.name;
  $('#u-role').textContent=state.user.role;
  $('#avatar').textContent=(state.user.name||'?').slice(0,1).toUpperCase();
  if(state.user.role==='admin'){
    $('#tab-usr').style.display='';
    $('#tab-aud').style.display='';
  }
  $('#company-name').textContent=state.company.name;$('#today-label').textContent=new Intl.DateTimeFormat('es-PE',{dateStyle:'long',timeZone:'America/Lima'}).format(new Date());$('#r-f').value=today();$('#ci-date').value=today();$('#m-m').value=today().slice(0,7);
  ['#op-form','#prov-form','#d-new','#c-new'].forEach(id=>show(id,canEdit()));show('#d-export-all',isAdmin());show('#r-archive',isAdmin());
  drawDash();drawReg();drawRes();drawPrv();drawCC();
  FinanceUI.init({role:state.user.role,refresh});BudgetUI.init(state.user.role);
}

document.querySelectorAll('#nav button').forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.t!=='budget'&&document.querySelector('#t-budget').classList.contains('on')&&!BudgetUI.canLeave())return;
    if(b.dataset.t!=='imp'&&document.querySelector('#t-imp').classList.contains('on')){if(!FinanceUI.canLeave())return;FinanceUI.resetImport();}
    document.querySelectorAll('#nav button').forEach(x=>x.setAttribute('aria-selected',x===b?'true':'false'));
    document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on',s.id==='t-'+b.dataset.t));
    if(b.dataset.t==='res')drawRes();
    if(b.dataset.t==='usr')drawUsr();
    if(b.dataset.t==='aud')loadAudit(true);
    if(b.dataset.t==='imp')FinanceUI.openImport();
    if(b.dataset.t==='fin')FinanceUI.openReports();
    if(b.dataset.t==='budget')BudgetUI.open();
    window.scrollTo({top:0,behavior:'instant'});
  };
});

function drawDash(){
  const mo=today().slice(0,7);
  const L=state.ops.filter(o=>o.date.slice(0,7)===mo);
  const T=total(L);
  const pend=L.filter(o=>o.status!=='Pagado').length;
  $('#d-k').innerHTML=[
    ['Operaciones del mes',L.length],
    ['Monto del mes',fm(T)],
    ['Pendientes',pend],
    ['Proveedores',state.prov.length],
    ['Cajas chicas',state.cc.length]
  ].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
  const R=state.ops.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8);
  $('#d-recent').innerHTML=R.length?R.map(o=>`<tr><td>${esc(fd(o.date))}</td><td class="l">${esc(o.concept)}</td><td class="r">${fm(o.amount)}</td><td class="${o.status==='Pagado'?'ok':'warn'}">${esc(o.status)}</td></tr>`).join(''):'<tr><td>Sin operaciones.</td></tr>';
}

let EDID=null;
function drawReg(){
  const fl=$('#r-fm')?.value;
  const q=$('#r-search').value.toLowerCase(), status=$('#r-status').value,cat=$('#r-category-filter').value;const L=(state.archive?state.deleted||[]:state.ops).filter(o=>(!fl||o.date.slice(0,7)===fl)&&(!status||o.status===status)&&(!cat||(o.category||'Sin clasificar')===cat)&&(!q||[o.concept,o.ruc,o.receipt,o.provider_name,o.category,state.prov.find(p=>p.ruc===o.ruc)?.name].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);$('#r-count').textContent=`${L.length} operaciones · ${fm(total(L))}`;
  $('#dl').innerHTML=state.prov.map(p=>`<option value="${esc(p.ruc)}">${esc(p.name)}</option>`).join('');
  const canEdit=state.user.role!=='lector';
  $('#r-tb').innerHTML=L.map(o=>{
    const p=state.prov.find(x=>x.ruc===o.ruc);
    return`<tr><td>${o.id}</td><td>${esc(fd(o.date))}</td><td class="l">${esc(o.concept)}</td><td class="l">${esc(o.receipt||'')}${o.order_number?'<small class="im-sub">Orden '+esc(o.order_number)+'</small>':''}</td><td class="r">${fm(o.amount)}${o.usd_reference!=null?'<small class="im-sub">USD '+esc(o.usd_reference)+'</small>':''}</td><td>${esc(o.bank_account||p?.cci||'')}</td><td class="l">${esc(o.provider_name||p?.name||'Sin registrar')}</td><td>${esc(o.bank)}</td><td>${esc(o.type)}</td><td>${esc(o.category||'Sin clasificar')}</td><td><span class="${o.status==='Pagado'?'ok':'warn'}">${esc(o.status)}</span></td><td>${o.signature?'<span class="muted">Generada</span>':''}</td><td>${state.archive?`<button class="btn g" data-act="restore" data-id="${o.id}">Restaurar</button>`:`${canEdit?`<button class="x edit" data-act="eo" data-id="${o.id}">Editar</button>`:''}${isAdmin()?`<button class="x" data-act="del" data-id="${o.id}">Archivar</button>`:''}`}</td></tr>`;
  }).join('');
}
window.eo=async function(id){
  const o=state.ops.find(x=>x.id===id);if(!o)return;
  EDID=id;
  $('#r-f').value=o.date;$('#r-c').value=o.concept;$('#r-p').value=o.receipt||'';
  $('#r-m').value=o.amount;$('#r-r').value=o.ruc;$('#r-e').value=o.status;
  $('#r-b').value=o.bank;$('#r-t').value=o.type;$('#r-cat').value=o.category||'';$('#r-provider').value=o.provider_name||'';$('#r-cci').value=o.bank_account||'';$('#r-order').value=o.order_number||'';
  $('#r-add').textContent='Guardar';$('#op-title').textContent='Editar operación';show('#r-cancel',true);
  document.querySelector('#nav button[data-t="reg"]').click();
};
window.del=async function(id){
  if(!confirm('¿Archivar operación? Podrás restaurarla desde la papelera.'))return;
  await api('/ops/'+id,{method:'DELETE'});
  await refresh();toast('Operación archivada');
};
$('#r-add').onclick=async function(){
  const body={date:$('#r-f').value,concept:$('#r-c').value.trim(),receipt:$('#r-p').value.trim(),amount:parseFloat($('#r-m').value),ruc:$('#r-r').value.trim(),status:$('#r-e').value,bank:$('#r-b').value,type:$('#r-t').value,category:$('#r-cat').value.trim(),provider_name:$('#r-provider').value.trim(),bank_account:$('#r-cci').value.trim(),order_number:$('#r-order').value.trim()};
  try{
    if(EDID){await api('/ops/'+EDID,{method:'PUT',body});resetOp()}
    else await api('/ops',{method:'POST',body});
    await refresh();toast('Guardado');$('#r-msg').textContent='';
    ['r-c','r-p','r-m','r-r','r-cat','r-provider','r-cci','r-order'].forEach(i=>{$('#'+i).value=''});
  }catch(e){$('#r-msg').textContent='⚠ '+e.message}
};

function drawRes(){
  const mo=$('#m-m').value||today().slice(0,7);
  const L=state.ops.filter(o=>o.date.slice(0,7)===mo);
  const T=total(L);
  const pg=total(L.filter(o=>o.status==='Pagado'));
  $('#m-k').innerHTML=[['Total',fm(T)],['N° ops',L.length],['Promedio',fm(L.length?T/L.length:0)],['Pagado',fm(pg)],['Pendiente',fm(T-pg)]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
}

function drawPrv(){
  const canEdit=state.user.role!=='lector';
  $('#v-tb').innerHTML=state.prov.map(p=>`<tr><td>${esc(p.ruc)}</td><td class="l">${esc(p.name)}</td><td class="l">${esc(p.holder||'')}</td><td>${esc(p.cci)}</td><td>${esc(bank(p.cci))}</td><td>Registrado</td><td>${isAdmin()?`<button class="x" data-act="dp" data-id="${p.id}">Eliminar</button>`:''}</td></tr>`).join('');
}
window.dp=async function(id){if(!confirm('¿Eliminar proveedor?'))return;await api('/prov/'+id,{method:'DELETE'});await refresh()};
$('#v-add').onclick=async function(){
  try{
    await api('/prov',{method:'POST',body:{ruc:$('#v-r').value.trim(),name:$('#v-n').value.trim(),cci:$('#v-c').value.replace(/\s/g,''),holder:$('#v-t').value.trim()}});
    await refresh();toast('Proveedor guardado');
    ['v-r','v-n','v-c','v-t'].forEach(i=>{$('#'+i).value=''});
  }catch(e){$('#v-msg').textContent='⚠ '+e.message}
};

let editingCash=null;
function resetCashEdit(){editingCash=null;$('#ci-form').reset();$('#ci-date').value=today();$('#ci-title').textContent='Registrar gasto';show('#ci-cancel',false);}
$('#ci-cancel').onclick=resetCashEdit;
function drawCC(preferred){
  const current=preferred||Number($('#c-sel').value);const c=state.cc.find(x=>x.id===current)||state.cc[0];
  $('#c-sel').innerHTML=state.cc.map(x=>`<option value="${x.id}">${esc(x.num||'(sin N°)')}</option>`).join('');if(c)$('#c-sel').value=c.id;
  show('#ci-form',!!c&&canEdit());show('#c-items',!!c);
  if(!c){$('#c-rp').textContent='No hay cajas registradas.';return;}
  const spent=total(c.items);$('#c-rp').innerHTML=`<div class="card"><h2>Caja ${esc(c.num)} · ${esc(c.resp||'')}</h2><div class="k"><div><span>Fondo asignado</span><b>${fm(c.fund)}</b></div><div><span>Gastos registrados</span><b>${fm(spent)}</b></div><div><span>Saldo disponible</span><b class="${c.fund-spent<0?'bad':''}">${fm(c.fund-spent)}</b></div></div></div>`;
  $('#c-items').innerHTML=`<h2>Detalle de gastos (${c.items.length})</h2><div class="sc"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Proveedor</th><th>Comprobante</th><th>Rubro</th><th>Monto</th><th>Acción</th></tr></thead><tbody>${c.items.map(i=>`<tr><td>${esc(fd(i.date))}</td><td class="l">${esc(i.detail)}</td><td>${esc(i.provider)}</td><td>${esc(i.receipt)}</td><td>${esc(i.category||'Sin clasificar')}</td><td class="r">${fm(i.amount)}${i.usd?'<small class="im-sub">USD '+esc(i.usd)+'</small>':''}</td><td>${canEdit()?`<button class="x edit" data-act="eci" data-id="${i.id}">Editar</button>`:''} ${isAdmin()?`<button class="x" data-act="di" data-id="${i.id}">Eliminar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7">Sin gastos</td></tr>'}</tbody></table></div>`;
}
$('#c-sel').onchange=()=>{resetCashEdit();drawCC();};$('#c-new').onclick=()=>show('#c-form',true);$('#c-cancel').onclick=()=>show('#c-form',false);
$('#c-form').onsubmit=run(async e=>{e.preventDefault();const {id}=await api('/cc',{method:'POST',body:{num:$('#c-num').value,resp:$('#c-resp').value,area:$('#c-area').value,fund:Number($('#c-fund').value),from_date:$('#c-from').value||null,to_date:$('#c-to').value||null}});e.target.reset();show('#c-form',false);await refresh();drawCC(id);toast('Caja registrada');});
$('#ci-form').onsubmit=run(async e=>{e.preventDefault();const id=$('#c-sel').value;await api(`/cc/${id}/items${editingCash?'/'+editingCash:''}`,{method:editingCash?'PUT':'POST',body:{ruc:$('#ci-ruc').value.trim(),usd:$('#ci-usd').value?Number($('#ci-usd').value):null,date:$('#ci-date').value,detail:$('#ci-detail').value,provider:$('#ci-provider').value,receipt:$('#ci-receipt').value,amount:Number($('#ci-amount').value),category:$('#ci-cat').value.trim()||FinanceCore.suggestCategory($('#ci-detail').value)}});resetCashEdit();await refresh();toast('Gasto guardado');});
async function drawUsr(){
  if(state.user.role!=='admin')return;
  const list=await api('/users');
  $('#usr-tb').innerHTML=list.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${u.must_change?'Sí':'No'}</td><td>${u.id===state.user.id?'':u.active?`<button class="x edit" data-act="reset" data-id="${u.id}">Restablecer clave</button> <button class="x" data-act="du" data-id="${u.id}">Desactivar</button>`:'Desactivado'}</td></tr>`).join('');
}
window.du=async function(id){if(!confirm('¿Desactivar usuario? Se conservará su historial.'))return;await api('/users/'+id,{method:'DELETE'});drawUsr()};
$('#nu-add').onclick=async function(){
  try{
    await api('/users',{method:'POST',body:{username:$('#nu-user').value.trim(),name:$('#nu-name').value.trim(),role:$('#nu-role').value,password:$('#nu-pass').value}});
    drawUsr();toast('Usuario creado');
    ['nu-user','nu-name','nu-pass'].forEach(i=>{$('#'+i).value=''});
  }catch(e){$('#nu-msg').textContent='⚠ '+e.message}
};

let aOffset=0;
const aLimit=50;
let aTotal=0;
async function loadAudit(reset){
  if(state.user.role!=='admin')return;
  if(reset)aOffset=0;
  const qs=new URLSearchParams({action:$('#a-action').value||'',entity:$('#a-entity').value||'',from:$('#a-from').value||'',to:$('#a-to').value||'',limit:aLimit,offset:aOffset});
  try{
    const data=await api('/audit?'+qs.toString());
    aTotal=data.total;
    $('#a-tb').innerHTML=data.rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.created_at)}</td><td>${esc(r.user_name||r.username||'—')}</td><td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--hd);color:var(--pri);font-weight:700">${esc(r.action)}</span></td><td>${esc(r.entity)}</td><td>${r.entity_id??''}</td><td style="font-size:11px">${esc(r.ip||'')}</td><td class="l" style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((r.payload||'').slice(0,80))}</td></tr>`).join('')||'<tr><td colspan="8" style="color:var(--mut)">Sin registros.</td></tr>';
    $('#a-page').textContent=`Mostrando ${aTotal?aOffset+1:0}–${Math.min(aOffset+aLimit,aTotal)} de ${aTotal}`;
    $('#a-prev').disabled=aOffset===0;
    $('#a-next').disabled=aOffset+aLimit>=aTotal;
  }catch(e){$('#a-msg').textContent='⚠ '+e.message}
}
$('#a-filter')?.addEventListener('click',()=>loadAudit(true));
$('#a-export')?.addEventListener('click',()=>window.open('/api/audit/export.csv','_blank'));
$('#a-prev')?.addEventListener('click',()=>{aOffset=Math.max(0,aOffset-aLimit);loadAudit(false)});
$('#a-next')?.addEventListener('click',()=>{aOffset+=aLimit;loadAudit(false)});

$('#btn-logout').onclick=run(async()=>{if(!confirm('¿Cerrar sesión?'))return;await api('/auth/logout',{method:'POST',body:{}});location.reload()});
$('#btn-password').onclick=()=>show('#password-form',true);$('#pw-cancel').onclick=()=>{ $('#password-form').reset();show('#password-form',false);};$('#password-form').onsubmit=run(async e=>{e.preventDefault();await api('/auth/change-password',{method:'POST',body:{currentPassword:$('#pw-current').value,newPassword:$('#pw-new').value}});e.target.reset();show('#password-form',false);toast('Contraseña actualizada');});
$('#btn-theme').onclick=()=>{const cur=document.documentElement.getAttribute('data-theme');const next=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);try{localStorage.setItem('theme',next)}catch{}};
try{const th=localStorage.getItem('theme');if(th)document.documentElement.setAttribute('data-theme',th);}catch{}

$('#d-export-all').onclick=async function(){
  const a=document.createElement('a');
  a.href='/api/export/all.json';
  a.download='respaldo.json';
  a.click();
};

function resetOp(){EDID=null;$('#r-add').textContent='Agregar';$('#op-title').textContent='Nueva operación';show('#r-cancel',false);['r-c','r-p','r-m','r-r','r-cat','r-provider','r-cci','r-order'].forEach(i=>$('#'+i).value='');}
$('#r-cancel').onclick=resetOp;['#r-fm','#r-search','#r-status','#r-category-filter'].forEach(id=>$(id).addEventListener('input',drawReg));$('#m-m').onchange=drawRes;$('#d-new').onclick=()=>document.querySelector('#nav button[data-t=reg]').click();$('#d-import').onclick=()=>document.querySelector('#nav button[data-t=imp]').click();$('#d-finance').onclick=()=>document.querySelector('#nav button[data-t=fin]').click();
$('#r-archive').onclick=run(async()=>{if(!state.archive)state.deleted=await api('/ops?deleted=true');state.archive=!state.archive;$('#r-archive').textContent=state.archive?'Ver operaciones':'Ver papelera';show('#op-form',canEdit()&&!state.archive);resetOp();drawReg();});
const actions={eci:id=>{const c=state.cc.find(x=>x.id===Number($('#c-sel').value)),i=c?.items.find(x=>x.id===id);if(!i)return;editingCash=id;for(const [k,v] of Object.entries({date:i.date,detail:i.detail,provider:i.provider,receipt:i.receipt,cat:i.category,amount:i.amount,ruc:i.ruc,usd:i.usd}))$('#ci-'+k).value=v??'';$('#ci-title').textContent='Editar gasto';show('#ci-cancel',true);$('#ci-form').scrollIntoView({block:'start'});},eo:window.eo,del:window.del,dp:window.dp,du:window.du,restore:async id=>{await api(`/ops/${id}/restore`,{method:'POST',body:{}});state.deleted=await api('/ops?deleted=true');await refresh();toast('Restaurada');},di:async id=>{if(confirm('¿Eliminar gasto?')){await api(`/cc/${$('#c-sel').value}/items/${id}`,{method:'DELETE'});await refresh();}},reset:async id=>{const password=prompt('Contraseña temporal (mínimo 12 caracteres)');if(password){await api(`/users/${id}/reset-password`,{method:'POST',body:{password}});toast('Contraseña temporal asignada');await drawUsr();}}};
document.addEventListener('click',run(async e=>{const b=e.target.closest('[data-act]');if(b&&actions[b.dataset.act]){b.disabled=true;try{await actions[b.dataset.act](Number(b.dataset.id));}finally{b.disabled=false;}}}));
for(const id of ['#r-add','#v-add','#nu-add']){const fn=$(id).onclick;$(id).onclick=run(fn);}
for(const id of ['#login-form','#firstpass-form']){const fn=$(id).onsubmit;$(id).onsubmit=run(fn);}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
})();