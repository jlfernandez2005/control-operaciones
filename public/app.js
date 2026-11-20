(function(){
'use strict';
const {$,esc,fm,fd,ml,bank,by,ty,srt,api}=AppCore;
const state={user:null,company:null,ops:[],prov:[],cc:[]};

function toast(m){const t=$('#ts');t.textContent=m;t.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove('show'),3200)}
function show(id,on){$(id).classList.toggle('hidden',!on)}
function setMsg(sel,txt,cls){const e=$(sel);e.textContent=txt;e.className='msg '+(cls||'')}

(async function boot(){
  try{
    const r=await api('/auth/me');
    state.user=r.user;state.company=r.company;
    await loadAll();
    enterApp();
  }catch{
    show('#login-view',true);show('#app-view',false);
  }
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
      newPassword:$('#fp-pass').value,
      question:$('#fp-q').value.trim(),
      answer:$('#fp-a').value.trim()
    }});
    await loadAll();enterApp();
  }catch(err){setMsg('#fp-msg','⚠ '+err.message,'bad')}
};

$('#go-recover').onclick=()=>{show('#login-form',false);show('#recover-form',true)};
$('#go-login').onclick=()=>{show('#recover-form',false);show('#login-form',true)};

$('#recover-form').onsubmit=async e=>{
  e.preventDefault();
  try{
    await api('/auth/recover',{method:'POST',body:{
      companyCode:$('#r-company').value.trim(),
      username:$('#r-user').value.trim(),
      answer:$('#r-ans').value.trim(),
      newPassword:$('#r-new').value
    }});
    setMsg('#r-msg2','✔ Contraseña actualizada.','ok');
    setTimeout(()=>{show('#recover-form',false);show('#login-form',true)},1200);
  }catch(err){setMsg('#r-msg2','⚠ '+err.message,'bad')}
};

function enterApp(){
  show('#login-view',false);show('#app-view',true);
  $('#u-name').textContent=state.user.name;
  $('#u-role').textContent=state.user.role;
  $('#avatar').textContent=(state.user.name||'?').slice(0,1).toUpperCase();
  if(state.user.role==='admin'){
    $('#tab-usr').style.display='';
    $('#tab-aud').style.display='';
  }
  drawDash();drawReg();drawRes();drawPrv();drawCC();
}

document.querySelectorAll('#nav button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#nav button').forEach(x=>x.setAttribute('aria-selected',x===b?'true':'false'));
    document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on',s.id==='t-'+b.dataset.t));
    if(b.dataset.t==='res')drawRes();
    if(b.dataset.t==='usr')drawUsr();
    if(b.dataset.t==='aud')loadAudit(true);
  };
});

function drawDash(){
  const today=new Date().toISOString().slice(0,10),mo=today.slice(0,7);
  const L=state.ops.filter(o=>o.date.slice(0,7)===mo);
  const T=L.reduce((s,o)=>s+o.amount,0);
  const pend=L.filter(o=>o.status!=='Pagado').length;
  $('#d-k').innerHTML=[
    ['Operaciones del mes',L.length],
    ['Monto del mes',fm(T)],
    ['Pendientes',pend],
    ['Proveedores',state.prov.length],
    ['Cajas chicas',state.cc.length]
  ].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
  const R=state.ops.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,8);
  $('#d-recent').innerHTML=R.length?R.map(o=>`<tr><td>${fd(o.date)}</td><td class="l">${esc(o.concept)}</td><td class="r">${fm(o.amount)}</td><td class="${o.status==='Pagado'?'ok':'warn'}">${o.status}</td></tr>`).join(''):'<tr><td>Sin operaciones.</td></tr>';
}

let EDID=null;
function drawReg(){
  const fl=$('#r-fm')?.value;
  const L=state.ops.filter(o=>!fl||o.date.slice(0,7)===fl).sort((a,b)=>a.date<b.date?1:-1);
  $('#dl').innerHTML=state.prov.map(p=>`<option value="${esc(p.ruc)}">${esc(p.name)}</option>`).join('');
  const canEdit=state.user.role!=='lector';
  $('#r-tb').innerHTML=L.map(o=>{
    const p=state.prov.find(x=>x.ruc===o.ruc);
    return`<tr><td>${o.id}</td><td>${fd(o.date)}</td><td class="l">${esc(o.concept)}</td><td class="l">${esc(o.receipt||'')}</td><td class="r">${fm(o.amount)}</td><td>${p?esc(p.cci):''}</td><td class="l">${p?esc(p.name):'<span class="bad">NO REGISTRADO</span>'}</td><td>${p?bank(p.cci):''}</td><td>${o.type}</td><td><span class="${o.status==='Pagado'?'ok':'warn'}">${o.status}</span></td><td>${o.signature?'<span class="ok">🔒</span>':''}</td><td>${canEdit?`<button class="x edit" onclick="eo(${o.id})">✎</button><button class="x" onclick="del(${o.id})">×</button>`:''}</td></tr>`;
  }).join('');
}
window.eo=async function(id){
  const o=state.ops.find(x=>x.id===id);if(!o)return;
  EDID=id;
  $('#r-f').value=o.date;$('#r-c').value=o.concept;$('#r-p').value=o.receipt||'';
  $('#r-m').value=o.amount;$('#r-r').value=o.ruc;$('#r-e').value=o.status;
  $('#r-b').value=o.bank;$('#r-t').value=o.type;
  $('#r-add').textContent='Guardar';
  document.querySelector('#nav button[data-t="reg"]').click();
};
window.del=async function(id){
  if(!confirm('¿Eliminar operación?'))return;
  await api('/ops/'+id,{method:'DELETE'});
  await loadAll();drawReg();drawDash();toast('Eliminada');
};
$('#r-add').onclick=async function(){
  const body={date:$('#r-f').value,concept:$('#r-c').value.trim(),receipt:$('#r-p').value.trim(),amount:parseFloat($('#r-m').value),ruc:$('#r-r').value.trim(),status:$('#r-e').value,bank:$('#r-b').value,type:$('#r-t').value};
  try{
    if(EDID){await api('/ops/'+EDID,{method:'PUT',body});EDID=null;$('#r-add').textContent='Agregar'}
    else await api('/ops',{method:'POST',body});
    await loadAll();drawReg();drawDash();toast('Guardado');
    ['r-c','r-p','r-m','r-r'].forEach(i=>{$('#'+i).value=''});
  }catch(e){$('#r-msg').textContent='⚠ '+e.message}
};

function drawRes(){
  const mo=$('#m-m').value||new Date().toISOString().slice(0,7);
  const L=state.ops.filter(o=>o.date.slice(0,7)===mo);
  const T=L.reduce((s,o)=>s+o.amount,0);
  const pg=L.filter(o=>o.status==='Pagado').reduce((s,o)=>s+o.amount,0);
  $('#m-k').innerHTML=[['Total',fm(T)],['N° ops',L.length],['Promedio',fm(L.length?T/L.length:0)],['Pagado',fm(pg)],['Pendiente',fm(T-pg)]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
}

function drawPrv(){
  const canEdit=state.user.role!=='lector';
  $('#v-tb').innerHTML=state.prov.map(p=>`<tr><td>${esc(p.ruc)}</td><td class="l">${esc(p.name)}</td><td class="l">${esc(p.holder||'')}</td><td>${esc(p.cci)}</td><td>${bank(p.cci)}</td><td>OK</td><td>${canEdit?`<button class="x" onclick="dp(${p.id})">×</button>`:''}</td></tr>`).join('');
}
window.dp=async function(id){if(!confirm('¿Eliminar proveedor?'))return;await api('/prov/'+id,{method:'DELETE'});await loadAll();drawPrv()};
$('#v-add').onclick=async function(){
  try{
    await api('/prov',{method:'POST',body:{ruc:$('#v-r').value.trim(),name:$('#v-n').value.trim(),cci:$('#v-c').value.replace(/\s/g,''),holder:$('#v-t').value.trim()}});
    await loadAll();drawPrv();toast('Proveedor guardado');
    ['v-r','v-n','v-c','v-t'].forEach(i=>{$('#'+i).value=''});
  }catch(e){$('#v-msg').textContent='⚠ '+e.message}
};

function drawCC(){
  const c=state.cc[0];
  $('#c-sel').innerHTML=state.cc.map(x=>`<option value="${x.id}">${esc(x.num||'(sin N°)')}</option>`).join('');
  $('#c-rp').innerHTML=c?`<div class="card"><h2>Caja ${esc(c.num)}</h2><p>Fondo: ${fm(c.fund)} · Gastos: ${c.items.length}</p></div>`:'<span style="color:var(--mut)">Crea una caja chica</span>';
}
$('#c-new').onclick=async function(){
  await api('/cc',{method:'POST',body:{num:'',resp:'',area:'Administración',ord:'',from_date:null,to_date:null,fund:1500}});
  await loadAll();drawCC();
};

async function drawUsr(){
  if(state.user.role!=='admin')return;
  const list=await api('/users');
  $('#usr-tb').innerHTML=list.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${u.role}</td><td>${u.must_change?'Sí':'No'}</td><td>${u.id===state.user.id?'':'<button class="x" onclick="du('+u.id+')">×</button>'}</td></tr>`).join('');
}
window.du=async function(id){if(!confirm('¿Eliminar usuario?'))return;await api('/users/'+id,{method:'DELETE'});drawUsr()};
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
    $('#a-tb').innerHTML=data.rows.map(r=>`<tr><td>${r.id}</td><td>${r.created_at}</td><td>${esc(r.user_name||r.username||'—')}</td><td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--hd);color:var(--pri);font-weight:700">${esc(r.action)}</span></td><td>${esc(r.entity)}</td><td>${r.entity_id??''}</td><td style="font-size:11px">${esc(r.ip||'')}</td><td class="l" style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((r.payload||'').slice(0,80))}</td></tr>`).join('')||'<tr><td colspan="8" style="color:var(--mut)">Sin registros.</td></tr>';
    $('#a-page').textContent=`Mostrando ${aOffset+1}–${Math.min(aOffset+aLimit,aTotal)} de ${aTotal}`;
    $('#a-prev').disabled=aOffset===0;
    $('#a-next').disabled=aOffset+aLimit>=aTotal;
  }catch(e){$('#a-msg').textContent='⚠ '+e.message}
}
$('#a-filter')?.addEventListener('click',()=>loadAudit(true));
$('#a-export')?.addEventListener('click',()=>window.open('/api/audit/export.csv','_blank'));
$('#a-prev')?.addEventListener('click',()=>{aOffset=Math.max(0,aOffset-aLimit);loadAudit(false)});
$('#a-next')?.addEventListener('click',()=>{aOffset+=aLimit;loadAudit(false)});

$('#btn-logout').onclick=async()=>{if(!confirm('¿Cerrar sesión?'))return;await api('/auth/logout',{method:'POST'});location.reload()};
$('#btn-theme').onclick=()=>{const cur=document.documentElement.getAttribute('data-theme');const next=cur==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.setItem('theme',next)};
const th=localStorage.getItem('theme');if(th)document.documentElement.setAttribute('data-theme',th);

$('#d-export-all').onclick=async function(){
  const a=document.createElement('a');
  a.href='/api/export/all.json';
  a.download='respaldo.json';
  a.click();
};

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
})();