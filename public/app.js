(function(){
'use strict';
const {$,esc,fm,fd,ml,bank,by,ty,srt,api}=AppCore;
const state={user:null,company:null,ops:[],prov:[],directory:[],cc:[],archive:false};
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
  const [ops,prov,cc,directory]=await Promise.all([api('/ops'),api('/prov'),api('/cc'),api('/prov/directory')]);
  state.ops=ops;state.prov=prov;state.cc=cc;state.directory=directory;
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
  FinanceUI.init({role:state.user.role,refresh,openRecord});BudgetUI.init(state.user.role,refresh);
}

document.querySelectorAll('#nav button').forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.t!=='budget'&&document.querySelector('#t-budget').classList.contains('on')&&!BudgetUI.canLeave())return;
    if(b.dataset.t!=='imp'&&document.querySelector('#t-imp').classList.contains('on')){if(!FinanceUI.canLeave())return;FinanceUI.resetImport();}
    document.querySelectorAll('#nav button').forEach(x=>x.setAttribute('aria-selected',x===b?'true':'false'));
    document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on',s.id==='t-'+b.dataset.t));
    if(b.dataset.t==='dash')drawDash();
    if(b.dataset.t==='res')drawRes();
    if(b.dataset.t==='usr')drawUsr();
    if(b.dataset.t==='aud')loadAudit(true);
    if(b.dataset.t==='imp')FinanceUI.openImport();
    if(b.dataset.t==='fin')FinanceUI.openReports();
    if(b.dataset.t==='budget')BudgetUI.open();
    window.scrollTo({top:0,behavior:'instant'});
  };
});

let dashRequest=0;
function drawDash(){
 const period=$('#d-period').value||today().slice(0,7);$('#d-period').value=period;
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)){ $('#d-note').textContent='Selecciona un periodo válido.';return; }
 const request=++dashRequest;
 renderDash(FinanceCore.dashboardModel(period,state.ops),period);
 $('#d-note').textContent='Consultando resúmenes y presupuesto…';
 api('/budget?year='+period.slice(0,4)).then(b=>{if(request!==dashRequest)return;renderDash(FinanceCore.dashboardModel(period,state.ops,b),period,true);const scoped=b.months.filter(x=>x.reference!==null),sum=k=>scoped.reduce((a,x)=>a+Math.round(Number(x[k]||0)*100),0)/100;$('#d-budget-info').insertAdjacentHTML('beforeend',`<div class="dash-breakdown"><span>SUNAT directo por confirmar <b>${fm(sum('directSuggested'))}</b></span><span>Diferencia ajustada del año <b>${scoped.length?fm(sum('adjustedDifference')):'—'}</b></span><span>Faltantes por fecha <b>${scoped.some(x=>x.hasDailyDetail)?fm(sum('missing')):'—'}</b></span><span>Excesos por fecha <b>${scoped.some(x=>x.hasDailyDetail)?fm(sum('excess')):'—'}</b></span></div>`);$('#d-note').textContent='Datos actualizados.';}).catch(()=>{if(request===dashRequest)$('#d-note').textContent='No se pudo consultar presupuesto. Se muestran únicamente las operaciones registradas.';});
}
function renderDash(d,period,complete=false){
 const money=x=>x==null?'—':fm(x),pct=(n,v)=>v>0?Math.max(0,Math.min(100,n/v*100)):0, m=d.month, monthName=AppCore.MES[Number(period.slice(5))-1],current=period===today().slice(0,7);
 const kpis=[['Acumulado anual · '+d.year,fm(d.annual),d.count+' operaciones registradas'],[current?'Mes en curso':'Mes seleccionado · '+monthName,fm(m.registered),m.count?m.count+' operaciones':'Sin operaciones registradas'],['Pagado · '+d.year,fm(d.paid),'Según estado registrado'],['Pendiente · '+d.year,fm(d.pending),'Por pagar'],['Resúmenes del año',money(d.reference),complete?d.referenceCount+' de 12 meses cargados':'Consultando referencias'],['Proveedores y beneficiarios',state.directory.length,'Directorio general'],['Cajas chicas',state.cc.length,'Total histórico'],['Resumen de '+monthName,money(m.reference),m.reference==null?'Sin referencia disponible':'No se suma al registrado']];
 $('#d-k').innerHTML=kpis.map(([label,value,detail])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`).join('');
 const max=Math.max(1,...d.months.flatMap(x=>[x.registered,x.reference||0]));
 $('#d-months').innerHTML=d.months.map((x,i)=>`<button type="button" class="dash-month ${x.month===period?'active':''}" data-month="${x.month}" aria-label="${esc(AppCore.MES[i])}: registrado ${esc(fm(x.registered))}; resumen ${esc(money(x.reference))}" title="${esc(AppCore.MES[i])}: ${esc(fm(x.registered))} / ${esc(money(x.reference))}"><span class="dash-bars"><i class="dash-bar reg" style="height:${pct(x.registered,max)}%"></i><i class="dash-bar ref" style="height:${pct(x.reference||0,max)}%"></i></span><span>${AppCore.MES[i].slice(0,3)}</span></button>`).join('');
 $('#d-month-table').innerHTML=d.months.map((x,i)=>`<tr><td>${AppCore.MES[i]}</td><td class="r">${fm(x.registered)}</td><td class="r">${money(x.reference)}</td><td class="r">${x.reference==null?'—':fm(x.registered-x.reference)}</td></tr>`).join('');
 $('#d-group-note').textContent=complete?'Operaciones del año, con desglose de cajas vinculadas y familias sugeridas para rubros sin clasificar. Los resúmenes no se suman.':'Operaciones registradas; conciliación de caja pendiente de consultar.';
 const groupMax=Math.max(1,...d.groups.map(g=>g.amount));$('#d-groups').innerHTML=d.groups.map(g=>`<div class="dash-group"><div><span>${esc(g.group)}</span><b>${fm(g.amount)}</b></div><div class="dash-track"><i class="reg" style="width:${pct(g.amount,groupMax)}%"></i></div><small>${pct(g.amount,d.annual).toFixed(1)}% del total registrado</small></div>`).join('')||'<p class="muted">No hay movimientos en este año.</p>';
 const paidPct=pct(d.paid,d.annual),pendingPct=pct(d.pending,d.annual);$('#d-status').innerHTML=`<div class="dash-status-amount">${fm(d.annual)}<small>Total registrado</small></div><div class="dash-stacked"><i class="reg" style="width:${paidPct}%"></i><i class="ref" style="width:${pendingPct}%"></i></div><div class="dash-breakdown"><span>Pagado <b>${fm(d.paid)} · ${paidPct.toFixed(1)}%</b></span><span>Pendiente <b>${fm(d.pending)} · ${pendingPct.toFixed(1)}%</b></span></div>`;
 $('#d-budget-info').innerHTML=`<div class="dash-breakdown"><span>Presupuesto registrado <b>${money(d.planned)}</b></span><span>Meses con presupuesto <b>${d.plannedCount} / 12</b></span><span>Saldo en meses con plan <b>${d.planned===null?'—':fm(d.planned-d.plannedRegistered)}</b></span><span>Diferencia en meses con resumen <b>${d.reference===null?'—':fm(d.referenceRegistered-d.reference)}</b></span><span>Cajas por conciliar en el año <b>${d.cashReview??'—'}</b></span></div><p class="muted">Saldo y diferencias comparan únicamente los meses que cuentan con plan o referencia, respectivamente.</p>`;
 const R=d.latest;$('#d-recent').innerHTML=R.length?R.map(o=>`<tr><td>${esc(fd(o.date))}</td><td class="l">${recordLink(o.id,o.concept)}</td><td>${esc(o.category||'Sin clasificar')}</td><td class="r">${fm(o.amount)}</td><td class="${o.status==='Pagado'?'ok':'warn'}">${esc(o.status)}</td></tr>`).join(''):'<tr><td>Sin operaciones en este año.</td></tr>';
}
$('#d-period').onchange=drawDash;$('#d-current').onclick=()=>{$('#d-period').value=today().slice(0,7);drawDash();};$('#d-last').onclick=()=>{const last=state.ops.map(o=>String(o.date)).filter(x=>/^20\d{2}-\d{2}-\d{2}$/.test(x)).sort().at(-1);if(!last){toast('No hay operaciones registradas.');return;}$('#d-period').value=last.slice(0,7);drawDash();};
$('#d-months').onclick=e=>{const month=e.target.closest('[data-month]')?.dataset.month;if(month){$('#d-period').value=month;drawDash();}};
$('#d-detail').onclick=()=>{const year=$('#d-period').value.slice(0,4);$('#fin-from').value=year+'-01-01';$('#fin-to').value=year+'-12-31';$('#fin-source').value='ops';$('#fin-source').dispatchEvent(new Event('change'));$('#fin-group').value='family';$('#fin-cat').value='';$('#fin-status').value='';$('#fin-search').value='';document.querySelector('#nav button[data-t=fin]').click();};
function goReconcile(month){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return;$('#bud-year').value=month.slice(0,4);BudgetUI.focus(month);document.querySelector('#nav button[data-t=budget]').click();}
$('#d-reconcile').onclick=()=>goReconcile($('#d-period').value);$('#m-reconcile').onclick=()=>goReconcile($('#m-m').value);
$('#d-budget').onclick=()=>{$('#bud-year').value=$('#d-period').value.slice(0,4);document.querySelector('#nav button[data-t=budget]').click();};

let EDID=null;
function drawReg(){
  const fl=$('#r-fm')?.value;
  const q=$('#r-search').value.toLowerCase(), status=$('#r-status').value,cat=$('#r-category-filter').value;const L=(state.archive?state.deleted||[]:state.ops).filter(o=>(!fl||o.date.slice(0,7)===fl)&&(!status||o.status===status)&&(!cat||(o.category||'Sin clasificar')===cat)&&(!q||[o.concept,o.ruc,o.receipt,o.provider_name,o.category,state.prov.find(p=>p.ruc===o.ruc)?.name].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);$('#r-count').textContent=`${L.length} operaciones · ${fm(total(L))}`;
  $('#dl').innerHTML=state.directory.filter(p=>p.ruc&&!p.name_conflict).map(p=>`<option value="${esc(p.ruc)}">${esc(p.name)}</option>`).join('');
  const canEdit=state.user.role!=='lector';
  $('#r-tb').innerHTML=L.map(o=>{
    const p=state.prov.find(x=>x.ruc===o.ruc);
    return`<tr><td>${o.id}</td><td>${esc(fd(o.date))}</td><td class="l">${state.archive?esc(o.concept):recordLink(o.id,o.concept)}</td><td class="l">${esc(o.receipt||'')}${o.order_number?'<small class="im-sub">Orden '+esc(o.order_number)+'</small>':''}</td><td class="r">${fm(o.amount)}${o.usd_reference!=null?'<small class="im-sub">USD '+esc(o.usd_reference)+'</small>':''}</td><td>${esc(o.bank_account||p?.cci||'')}</td><td class="l">${esc(o.provider_name||p?.name||'Sin registrar')}</td><td>${esc(o.bank)}</td><td>${esc(o.type)}</td><td>${esc(o.category||'Sin clasificar')}<small class="im-sub">${esc(FinanceCore.familyFor(o.category,o.concept))}</small></td><td><span class="${o.status==='Pagado'?'ok':'warn'}">${esc(o.status)}</span></td><td>${o.signature?'<span class="muted">Generada</span>':''}</td><td>${state.archive?`<button class="btn g" data-act="restore" data-id="${o.id}">Restaurar</button>`:`${canEdit?`<button class="x edit" data-record="ops" data-id="${o.id}">Editar</button>`:''}${isAdmin()?`<button class="x" data-act="del" data-id="${o.id}">Archivar</button>`:''}`}</td></tr>`;
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

let monthMetric='total',monthPage=0;
const MONTH_PAGE=50;
const metricLabels={total:'Total',count:'N° ops',average:'Promedio',paid:'Pagado',pending:'Pendiente'};
function recordLink(id,concept,source='ops'){return `<button type="button" class="record-link" data-record="${source}" data-id="${Number(id)}">${esc(concept)}</button>`;}
function drawRes(){
 const mo=$('#m-m').value||today().slice(0,7),m=AppCore.monthlyDetail(state.ops,mo,monthMetric,$('#m-search').value);
 const values={total:fm(m.total),count:m.count,average:fm(m.average),paid:fm(m.paid),pending:fm(m.pending)};
 $('#m-k').innerHTML=Object.entries(metricLabels).map(([key,label])=>`<button type="button" class="month-kpi" data-metric="${key}" aria-pressed="${monthMetric===key}" aria-controls="m-detail-card"><span>${label}</span><b>${values[key]}</b><small>Ver detalle →</small></button>`).join('');
 $('#m-detail-title').textContent=`${metricLabels[monthMetric]} · ${AppCore.MES[Number(mo.slice(5))-1]} ${mo.slice(0,4)}`;
 $('#m-explain').textContent=monthMetric==='average'?`Promedio = ${fm(m.total)} ÷ ${m.count} operaciones${m.count?' = '+fm(m.average):' (sin operaciones)'}. Se muestran todos los movimientos del cálculo.`:monthMetric==='paid'?'Operaciones con estado Pagado.':monthMetric==='pending'?'Operaciones no marcadas como Pagado.':'Todas las operaciones del mes seleccionado.';
 $('#m-count').textContent=`${m.visible.length} de ${m.base.length} operaciones · Importe del detalle: ${fm(m.subtotal)}`;
 monthPage=Math.max(0,Math.min(monthPage,Math.ceil(m.visible.length/MONTH_PAGE)-1));
 $('#m-rows').innerHTML=m.visible.slice(monthPage*MONTH_PAGE,(monthPage+1)*MONTH_PAGE).map(o=>`<tr><td>${esc(fd(o.date))}</td><td class="l">${recordLink(o.id,o.concept)}</td><td class="l">${esc(o.provider_name||state.prov.find(p=>p.ruc===o.ruc)?.name||'—')}</td><td>${esc(o.category||'Sin clasificar')}</td><td class="l">${esc(o.receipt||'—')}${o.order_number?'<small class="im-sub">Orden '+esc(o.order_number)+'</small>':''}</td><td class="${o.status==='Pagado'?'ok':'warn'}">${esc(o.status)}</td><td class="r">${fm(o.amount)}</td><td><button type="button" class="x edit" data-record="ops" data-id="${Number(o.id)}">${canEdit()?'Editar':'Ver detalle'}</button></td></tr>`).join('')||'<tr><td colspan="8">No hay operaciones para este indicador y búsqueda.</td></tr>';
 $('#m-page').textContent=`${m.visible.length?monthPage*MONTH_PAGE+1:0}–${Math.min((monthPage+1)*MONTH_PAGE,m.visible.length)} de ${m.visible.length}`;$('#m-prev').disabled=monthPage===0;$('#m-next').disabled=(monthPage+1)*MONTH_PAGE>=m.visible.length;
}
$('#m-k').onclick=e=>{const b=e.target.closest('[data-metric]');if(!b)return;monthMetric=b.dataset.metric;monthPage=0;$('#m-search').value='';drawRes();$('#m-k').querySelector(`[data-metric="${monthMetric}"]`)?.focus({preventScroll:true});$('#m-detail-card').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('#m-search').oninput=()=>{monthPage=0;drawRes()};$('#m-all').onclick=()=>{monthMetric='total';monthPage=0;$('#m-search').value='';drawRes()};$('#m-prev').onclick=()=>{monthPage--;drawRes()};$('#m-next').onclick=()=>{monthPage++;drawRes()};
// A single editor for stored operations and petty-cash expenses. Source fields are read-only.
let recordEdit=null,recordBusy=false;
const recordDialog=$('#record-dialog');
function openRecord(source,id){
 if(recordBusy||recordDialog.open)return;
 const cash=source==='cash',box=cash?state.cc.find(c=>c.items.some(i=>Number(i.id)===Number(id))):null;
 const o=cash?box?.items.find(i=>Number(i.id)===Number(id)):state.ops.find(i=>Number(i.id)===Number(id));
 if(!o){toast('No se encontró el registro. Actualiza la consulta.');return;}
 recordEdit={source,id:Number(id),boxId:box?.id,original:o};
 $('#record-title').textContent=(canEdit()?'Editar ':'Detalle de ')+(cash?'gasto de caja chica':'operación');
 $('#record-meta').textContent=[cash?'Caja '+box.num:'Operación #'+o.id,o.source_file,o.source_ref,!cash&&o.usd_reference!=null?'USD de referencia: '+o.usd_reference:''].filter(Boolean).join(' · ');
 const fields=[['date','Fecha','date',o.date,0,true],['concept','Concepto / detalle','textarea',cash?o.detail:o.concept,500,true],['amount','Monto en soles','number',o.amount,0,true],['category','Rubro','text',o.category||'',100,false,'category-list'],['provider','Proveedor / beneficiario','text',cash?o.provider:o.provider_name,200],['ruc','RUC / DNI','text',o.ruc,cash?20:11],['receipt','Comprobante','text',o.receipt,200]];
 if(cash)fields.push(['usd','Referencia USD','number',o.usd,0,false]);else fields.push(['status','Estado','select',o.status,0,true],['bank','Banco','text',o.bank,80,true,'bank-list'],['type','Tipo','text',o.type,80,true,'type-list'],['bank_account','Cuenta / CCI','text',o.bank_account,200],['order_number','Número de orden','text',o.order_number,80]);
 const attr=canEdit()?'':' disabled';$('#record-fields').innerHTML=fields.map(([key,label,type,value,max,required,list])=>{const props=`name="${key}" ${max?'maxlength="'+max+'"':''}${required?' required':''}${list?' list="'+list+'"':''}${attr}`;const input=type==='textarea'?`<textarea rows="3" ${props}>${esc(value)}</textarea>`:type==='select'?`<select ${props}>${['Pendiente','Pagado'].map(v=>`<option${v===value?' selected':''}>${v}</option>`).join('')}</select>`:`<input type="${type}" ${props} ${type==='number'?'min="0.01" max="999999999" step="0.01"':''} value="${esc(value??'')}">`;return `<label class="${key==='concept'?'record-wide':''}">${label}${input}</label>`;}).join('');
 show('#record-save',canEdit());$('#record-cancel').textContent=canEdit()?'Cancelar':'Cerrar';setMsg('#record-msg','','');recordDialog.showModal();
}
function closeRecord(){if(!recordBusy)recordDialog.close();}
$('#record-close').onclick=closeRecord;$('#record-cancel').onclick=closeRecord;recordDialog.addEventListener('cancel',e=>{if(recordBusy)e.preventDefault();});
$('#record-form').onsubmit=async e=>{e.preventDefault();if(recordBusy||!recordEdit||!canEdit())return;const current=recordEdit,raw=Object.fromEntries(new FormData(e.target)),cash=current.source==='cash';let body={date:raw.date,amount:Number(raw.amount),category:raw.category.trim(),ruc:raw.ruc.trim(),receipt:raw.receipt.trim()};
 if(cash)Object.assign(body,{detail:raw.concept.trim(),provider:raw.provider.trim(),usd:raw.usd?Number(raw.usd):null});else Object.assign(body,{concept:raw.concept.trim(),provider_name:raw.provider.trim(),status:raw.status,bank:raw.bank.trim(),type:raw.type.trim(),bank_account:raw.bank_account.trim(),order_number:raw.order_number.trim()});
 recordBusy=true;$('#record-save').disabled=true;setMsg('#record-msg','Guardando…','');let saved=false;
 try{await api(cash?`/cc/${current.boxId}/items/${current.id}`:`/ops/${current.id}`,{method:'PUT',body});saved=true;recordDialog.close();await refresh();if($('#t-fin').classList.contains('on'))await FinanceUI.openReports();if($('#t-budget').classList.contains('on'))await BudgetUI.open();toast('Cambios guardados');}catch(err){if(saved)toast('Cambios guardados. No se pudo actualizar la vista; recarga la página.');else setMsg('#record-msg',err.message,'bad');}finally{recordBusy=false;$('#record-save').disabled=false;}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-record]');if(b)openRecord(b.dataset.record,Number(b.dataset.id));});

let providerPage=0;
function drawPrv(){
  const list=state.directory,q=$('#v-search').value.trim().toLowerCase(),src=$('#v-source').value,rev=$('#v-review').value;
  const alert=p=>p.needs_review||p.account_conflict;
  const filtered=list.filter(p=>(!src||p.sources.includes(src))&&(!rev||(rev==='review'?alert(p):!alert(p)))&&(!q||[p.name,p.ruc,p.document_reference,...p.aliases].join(' ').toLowerCase().includes(q)));
  $('#v-kpis').innerHTML=[['Fichas detectadas',list.length],['Con RUC / DNI',list.filter(p=>p.ruc).length],['Por verificar',list.filter(alert).length],['Fichas manuales',list.filter(p=>p.manual_id).length]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
  providerPage=Math.min(providerPage,Math.max(0,Math.ceil(filtered.length/30)-1));
  $('#v-count').textContent=`${filtered.length} coincidencias · Los recuentos de operaciones y caja se muestran por separado.`;
  $('#v-page').textContent=filtered.length?`${providerPage*30+1}–${Math.min((providerPage+1)*30,filtered.length)} de ${filtered.length}`:'0 registros';
  $('#v-prev').disabled=providerPage===0;$('#v-next').disabled=(providerPage+1)*30>=filtered.length;
  $('#v-tb').innerHTML=filtered.slice(providerPage*30,providerPage*30+30).map(p=>`<tr><td>${esc(p.ruc||p.document_reference||'Sin identificar')}</td><td class="l"><strong>${esc(p.name)}</strong>${p.name_conflict?'<small class="im-sub">Variantes: '+esc(p.aliases.join(' / '))+'</small>':''}</td><td>${esc(p.kind)}<small class="im-sub">${esc(p.sources.join(' · '))}</small></td><td>${p.operations}</td><td>${p.cash_items}</td><td>${esc(fd(p.last_date)||'—')}</td><td class="l">${p.cci?'Ficha: '+esc(p.cci)+(p.holder?'<small class="im-sub">'+esc(p.holder)+'</small>':''):''}${p.accounts.length?'<details><summary>'+p.accounts.length+' referencia(s) histórica(s)</summary>'+p.accounts.map(a=>'<small class="im-sub">'+esc([a.bank,a.account,fd(a.date)].filter(Boolean).join(' · '))+'</small>').join('')+'</details>':!p.cci?'Sin datos':''}</td><td>${alert(p)?'<span class="warn">Por verificar</span>':'Sin alertas'}${p.account_conflict?'<small class="im-sub">Varias cuentas</small>':''}</td><td>${p.manual_id&&isAdmin()?`<button class="x" data-act="dp" data-id="${p.manual_id}">Eliminar ficha</button>`:''}</td></tr>`).join('')||'<tr><td colspan="9">No hay coincidencias. Los datos aparecerán al registrar o importar movimientos.</td></tr>';
}
for(const id of ['#v-search','#v-source','#v-review'])$(id).addEventListener(id==='#v-search'?'input':'change',()=>{providerPage=0;drawPrv()});
$('#v-prev').onclick=()=>{providerPage--;drawPrv()};$('#v-next').onclick=()=>{providerPage++;drawPrv()};
$('#v-refresh').onclick=run(async()=>{await refresh();toast('Directorio actualizado')});
// Suggest only unambiguous names; never copy an observed bank account into a payment.
for(const [docId,nameId] of [['#r-r','#r-provider'],['#ci-ruc','#ci-provider']])$(docId).addEventListener('change',()=>{
 const p=state.directory.find(x=>x.ruc&&x.ruc===$(docId).value.trim()&&!x.name_conflict);if(p&&!$(nameId).value.trim())$(nameId).value=p.name;
});
window.dp=async function(id){if(!confirm('¿Eliminar la ficha manual? Los datos de operaciones y caja seguirán apareciendo.'))return;await api('/prov/'+id,{method:'DELETE'});await refresh()};
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
  const spent=total(c.items);$('#c-rp').innerHTML=`<div class="card"><h2>Caja ${esc(c.num)} · ${esc(c.resp||'')}</h2><div class="k"><div><span>Fondo asignado</span><b>${fm(c.fund)}</b></div><div><span>Gastos registrados</span><b>${fm(spent)}</b></div><div><span>${Math.round((c.fund-spent)*100)<0?'Por reembolsar':'Saldo disponible'}</span><b class="${Math.round((c.fund-spent)*100)<0?'bad':''}">${fm(Math.abs(Math.round((c.fund-spent)*100)/100))}</b></div></div></div>`;
  $('#c-items').innerHTML=`<h2>Detalle de gastos (${c.items.length})</h2><div class="sc"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Proveedor</th><th>Comprobante</th><th>Rubro</th><th>Monto</th><th>Acción</th></tr></thead><tbody>${c.items.map(i=>`<tr><td>${esc(fd(i.date))}</td><td class="l">${recordLink(i.id,i.detail,'cash')}</td><td>${esc(i.provider)}</td><td>${esc(i.receipt)}</td><td>${esc(i.category||'Sin clasificar')}</td><td class="r">${fm(i.amount)}${i.usd?'<small class="im-sub">USD '+esc(i.usd)+'</small>':''}</td><td>${canEdit()?`<button class="x edit" data-record="cash" data-id="${i.id}">Editar</button>`:''} ${isAdmin()?`<button class="x" data-act="di" data-id="${i.id}">Eliminar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7">Sin gastos</td></tr>'}</tbody></table></div>`;
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
$('#r-cancel').onclick=resetOp;['#r-fm','#r-search','#r-status','#r-category-filter'].forEach(id=>$(id).addEventListener('input',drawReg));$('#m-m').onchange=()=>{monthMetric='total';monthPage=0;$('#m-search').value='';drawRes()};$('#d-new').onclick=()=>document.querySelector('#nav button[data-t=reg]').click();$('#d-import').onclick=()=>document.querySelector('#nav button[data-t=imp]').click();$('#d-finance').onclick=()=>document.querySelector('#nav button[data-t=fin]').click();
$('#r-archive').onclick=run(async()=>{if(!state.archive)state.deleted=await api('/ops?deleted=true');state.archive=!state.archive;$('#r-archive').textContent=state.archive?'Ver operaciones':'Ver papelera';show('#op-form',canEdit()&&!state.archive);resetOp();drawReg();});
const actions={eci:id=>{const c=state.cc.find(x=>x.id===Number($('#c-sel').value)),i=c?.items.find(x=>x.id===id);if(!i)return;editingCash=id;for(const [k,v] of Object.entries({date:i.date,detail:i.detail,provider:i.provider,receipt:i.receipt,cat:i.category,amount:i.amount,ruc:i.ruc,usd:i.usd}))$('#ci-'+k).value=v??'';$('#ci-title').textContent='Editar gasto';show('#ci-cancel',true);$('#ci-form').scrollIntoView({block:'start'});},eo:window.eo,del:window.del,dp:window.dp,du:window.du,restore:async id=>{await api(`/ops/${id}/restore`,{method:'POST',body:{}});state.deleted=await api('/ops?deleted=true');await refresh();toast('Restaurada');},di:async id=>{if(confirm('¿Eliminar gasto?')){await api(`/cc/${$('#c-sel').value}/items/${id}`,{method:'DELETE'});await refresh();}},reset:async id=>{const password=prompt('Contraseña temporal (mínimo 12 caracteres)');if(password){await api(`/users/${id}/reset-password`,{method:'POST',body:{password}});toast('Contraseña temporal asignada');await drawUsr();}}};
document.addEventListener('click',run(async e=>{const b=e.target.closest('[data-act]');if(b&&actions[b.dataset.act]){b.disabled=true;try{await actions[b.dataset.act](Number(b.dataset.id));}finally{b.disabled=false;}}}));
for(const id of ['#r-add','#v-add','#nu-add']){const fn=$(id).onclick;$(id).onclick=run(fn);}
for(const id of ['#login-form','#firstpass-form']){const fn=$(id).onsubmit;$(id).onsubmit=run(fn);}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
})();