import {normalize} from './finance-core.js';
const cents=n=>Math.round(Number(n||0)*100), sum=(xs)=>xs.reduce((s,x)=>s+cents(x.amount),0);
const direct=x=>/\bsunat\b/.test(normalize(x.concept));
const taxOp=x=>direct(x)||/\bsunat\b/.test(normalize(x.provider_name));
const fiscal=x=>{const m=normalize(x).match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(20\d{2})\b/);if(!m)return '';const i=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'].indexOf(m[1]==='septiembre'?'setiembre':m[1]);return `${m[2]}-${String(i+1).padStart(2,'0')}`;};
export function reconcile(year,ops,refs){
 const referenceDays=[],months=[];
 for(const ref of refs){if(!String(ref.month).startsWith(year+'-'))continue;
  const list=ops.filter(o=>String(o.date).startsWith(ref.month+'-')&&!o.deleted_at);
  let entries=[];try{entries=JSON.parse(ref.details_json||'[]');}catch{}if(!Array.isArray(entries))entries=[];
  entries=entries.filter(e=>String(e.date).startsWith(ref.month+'-')&&Number.isFinite(Number(e.amount))&&Number(e.amount)>0);
  const valid=entries.length>0&&sum(entries)===Number(ref.cents),days=new Map();
  if(valid){for(const e of entries){if(!days.has(e.date))days.set(e.date,[]);days.get(e.date).push(e);}for(const o of list)if(!days.has(o.date))days.set(o.date,[]);}
  let proposed=0,missing=0,excess=0,reviewDays=0;
  for(const [date,es] of days){const os=list.filter(o=>o.date===date),taxes=es.filter(direct),ordinary=es.filter(e=>!direct(e)),taxesActual=os.filter(taxOp),regular=os.filter(o=>!taxOp(o)),expected=sum(es),registered=sum(os),taxExpected=sum(taxes),taxRecorded=sum(taxesActual),ordinaryExpected=sum(ordinary),ordinaryRecorded=sum(regular);
   // Only propose a direct payment if the reference has a single explicit SUNAT entry,
   // no SUNAT record exists on that date, no possible same-amount SUNAT on another date,
   // and the ordinary amount is not higher than the ordinary reference.
   const possibleOther=list.filter(o=>o.date!==date&&taxOp(o)&&cents(o.amount)===taxExpected);
   const proposal=taxes.length===1&&!taxesActual.length&&!possibleOther.length&&ordinaryRecorded<=ordinaryExpected&&taxExpected>0?taxExpected:0;
   const adjusted=registered+proposal-expected;
   const seen=new Map(),duplicates=[];for(const o of os){const k=JSON.stringify([normalize(o.concept),cents(o.amount),normalize(o.receipt),normalize(o.order_number),normalize(o.ruc),normalize(o.provider_name)]);if(seen.has(k)){duplicates.push(Number(seen.get(k)));duplicates.push(Number(o.id));}else seen.set(k,o.id);}
   const duplicateIds=[...new Set(duplicates)];
   const taxConflict=taxExpected>0&&proposal===0&&taxRecorded!==taxExpected;
   const ordinaryConflict=ordinaryExpected!==ordinaryRecorded;
   const status=!es.length?'Sin fila en resumen':duplicateIds.length?'Posible duplicidad':taxConflict?'SUNAT por revisar':adjusted<0?'Falta detalle o importe':adjusted>0?'Exceso registrado':ordinaryConflict?'Distribución por revisar':proposal?'SUNAT directo por confirmar':'Coincidencia de importes';
   proposed+=proposal;missing+=Math.max(0,-adjusted);excess+=Math.max(0,adjusted);if(status!=='Coincidencia de importes')reviewDays++;
   referenceDays.push({date,concept:es.map(e=>e.concept).join(' / ')||'Sin fila en resumen',reference:expected/100,registered:registered/100,difference:(registered-expected)/100,directSuggested:proposal/100,directReference:taxExpected/100,directRegistered:taxRecorded/100,adjustedDifference:adjusted/100,status,fiscalPeriod:taxes.map(e=>fiscal(e.concept)).filter(Boolean).join(', '),directConcept:proposal?taxes[0].concept:'',sourceRef:proposal?taxes[0].reference||'':'',operations:os.map(o=>({id:Number(o.id),concept:o.concept,amount:Number(o.amount),status:o.status,receipt:o.receipt||'',order:o.order_number||''})),duplicateIds,otherDateIds:possibleOther.map(o=>Number(o.id))});
  }
  const diff=sum(list)-Number(ref.cents);months.push({month:ref.month,directSuggested:proposed/100,adjustedDifference:(diff+proposed)/100,missing:valid?missing/100:null,excess:valid?excess/100:null,reviewDays:valid?reviewDays:null,hasDailyDetail:valid});
 }
 return {referenceDays:referenceDays.sort((a,b)=>a.date.localeCompare(b.date)),months};
}
