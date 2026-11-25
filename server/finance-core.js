// Reglas deterministas; nunca sustituyen la confirmación del operador.
export const categoryFamilies={
  "Personal y obligaciones laborales": [
    "Haberes",
    "Personal y honorarios",
    "AFP",
    "ONP",
    "EsSalud",
    "Retención Judicial",
    "Docente adecuación",
    "Reemplazo",
    "Beneficios sociales",
    "Capacitación del personal",
    "Formación continua"
  ],
  "Tecnología y comunicaciones": [
    "Computadoras",
    "Telefonía e Internet",
    "Mantenimiento Tecnológico",
    "Tecnología y comunicaciones",
    "Licencias y software",
    "Impresión y equipos informáticos",
    "Tecnología"
  ],
  "Infraestructura y mantenimiento": [
    "Mantenimiento e infraestructura",
    "Alquiler",
    "Equipamiento y mobiliario"
  ],
  "Servicios generales": [
    "Servicios básicos",
    "Limpieza e higiene",
    "Seguridad",
    "SST"
  ],
  "Gestión académica e institucional": [
    "Material educativo",
    "Útiles y oficina",
    "Confección trajes",
    "Eventos y actividades",
    "Pastoral y liturgia",
    "Alquiler casa retiro"
  ],
  "Movilidad y alimentación": [
    "Transporte y movilidad",
    "Viajes",
    "Viáticos",
    "Refrigerios",
    "Alimentación"
  ],
  "Administración y obligaciones fiscales": [
    "Tributos y tasas",
    "Servicios profesionales",
    "Asesoría contable",
    "Seguros",
    "Servicios financieros"
  ],
  "Fondos y movimientos por conciliar": [
    "Caja Chica",
    "Caja chica · fondo sin distribuir",
    "Caja chica · saldo sin distribuir",
    "Préstamos",
    "Devoluciones",
    "Reembolsos"
  ],
  "Compras por detallar": [
    "Adquisiciones",
    "Abastecimiento"
  ],
  "Otros / por revisar": [
    "Otros",
    "Sin clasificar"
  ]
};
export const categories=[...new Set(Object.values(categoryFamilies).flat().filter(x=>!x.includes(" · ")))];
export const normalize=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const rules=[['Servicios básicos',/\b(servicio de agua|sedapal|electricidad|energia electrica|luz|gas natural)\b/],['Limpieza e higiene',/\b(limpieza|detergente|desinfectante|lejia|higiene|jabon)\b/],['Tecnología y comunicaciones',/\b(internet|software|computadoras?|laptop|licencia digital|hosting|telefonia|celulares?|movistar|workspace|impresora|toner|informatica)\b/],['Mantenimiento e infraestructura',/\b(mantenimiento|reparaciones?|ventiladores?|fluorescentes?|pintura|gasfiteria|electricista|obra|construccion)\b/],['Material educativo',/\b(textos escolares|material didactico|material educativo|libros|laboratorio)\b/],['Útiles y oficina',/\b(papel|utiles|lapiceros|impresiones|archivador|fotocopias|papeleria)\b/],['Personal y honorarios',/\b(planillas?|liquidacion|remuneracion|sueldo|honorarios|gratificacion|cts)\b/],['Transporte y movilidad',/\b(transporte|movilidad|taxis?|pasajes?|combustible|peaje|flete)\b/],['Alimentación',/\b(alimentacion|refrigerios?|botellas de agua|bebidas|gaseosas|chifones|almuerzo|catering|alimentos|comida)\b/],['Tributos y tasas',/\b(sunat|tributo|impuesto|arbitrio|municipalidad|igv|detraccion)\b/],['Servicios profesionales',/\b(consultoria|asesoria|servicio legal|servicio contable|abogado)\b/],['Seguridad',/\b(vigilancia|seguridad|alarma|extintor)\b/],['Eventos y actividades',/\b(evento|ceremonia|taller|actividad|celebracion)\b/],['Equipamiento y mobiliario',/\b(mobiliario|escritorio|silla|mesa|estante|equipo)\b/],['Pastoral y liturgia',/\b(misa|pastoral|liturgia|hostias)\b/],['Servicios financieros',/\b(comision bancaria|interes bancario|itf)\b/]];
// Specific financial concepts take precedence over generic keywords. Do not overwrite an explicit historical rubro.
const specificRules=[
 ['Caja Chica',/\b(caja chica|fondo fijo|fondo de caja|reposicion de caja)\b/],
 ['Retención Judicial',/\b(retencion judicial|descuento judicial|pension alimenticia)\b/],
 ['AFP',/\bafp\b/],['ONP',/\bonp\b/],['EsSalud',/\bessalud\b/],
 ['Beneficios sociales',/\b(liquidacion (?:del |de )?(?:personal|trabajador|beneficios)|beneficios sociales|vacaciones truncas|indemnizacion|cts)\b/],
 ['Haberes',/\b(planillas?|haberes|sueldos?|remuneraciones?)\b/],
 ['Reemplazo',/\b(reemplazo (?:de |del )?(?:docente|personal)|suplencia)\b/],
 ['Docente adecuación',/\b(?:docente adecuacion|adecuacion docente)\b/],
 ['Mantenimiento Tecnológico',/\b(mantenimiento|reparacion|soporte)\b.{0,60}\b(computadoras?|laptops?|impresoras?|servidores?|equipos informaticos|tecnologico)\b/],
 ['Computadoras',/\b(computadoras?|laptops?|notebooks?|pc de escritorio)\b/],
 ['Telefonía e Internet',/\b(internet|telefonia|celulares?|movistar|entel|integratel|fibra optica)\b/],
 ['Licencias y software',/\b(software|hosting|workspace|adobe|licencia digital|licencias google|dominio web)\b/],
 ['Impresión y equipos informáticos',/\b(impresoras?|toner|tintas? de impresora|tintas? impresora)\b/],
 ['Alquiler casa retiro',/\b(alquiler|arrendamiento)\b.{0,60}\b(retiro|casa de retiro)\b/],
 ['Alquiler',/\b(alquiler|arrendamiento)\b/],
 ['Confección trajes',/\b(confeccion|trajes|disfraces)\b/],
 ['Asesoría contable',/\b(asesoria contable|servicio contable|honorarios contables)\b/],
 ['Seguros',/\b(seguro|seguros|poliza)\b/],
 ['SST',/\b(sst|seguridad y salud en el trabajo|salud ocupacional)\b/],
 ['Formación continua',/\b(formacion continua|capacitacion|curso de actualizacion)\b/],
 ['Viajes',/\b(vuelos?|viajes?|pasajes aereos|boletos aereos)\b/],
 ['Viáticos',/\bviaticos?\b/],['Refrigerios',/\brefrigerios?\b/],
 ['Préstamos',/\bprestamos?\b/],['Devoluciones',/\bdevoluciones?\b/],['Reembolsos',/\breembolsos?\b/]
];
export function suggestCategory(concept){const s=normalize(concept);const found=specificRules.find(([,re])=>re.test(s));if(found)return found[0];const broad=rules.filter(([,re])=>re.test(s));return broad.length===1?broad[0][0]:'Sin clasificar';}
const familyIndex=new Map(Object.entries(categoryFamilies).flatMap(([family,labels])=>labels.map(label=>[normalize(label),family])));
export function familyFor(category,concept=''){const label=normalize(category);if(!label||label==='sin clasificar'){return familyIndex.get(normalize(suggestCategory(concept)))||'Otros / por revisar';}return familyIndex.get(label)||'Otros / por revisar';}
export function dateValue(x){const s=String(x??'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);if(!m){const a=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(a)m=[s,a[3],a[2].padStart(2,'0'),a[1].padStart(2,'0')];}if(!m)return '';const iso=m.slice(1,4).join('-');const d=new Date(iso+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:'';}
export function amountValue(x,decimal='dot'){if(typeof x==='number')return Number.isFinite(x)?x:null;let s=String(x??'').trim().replace(/^S\s*\/?\.?\s*/i,'').replace(/\s/g,'');if(!s)return null;const pattern=decimal==='comma'?/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/:/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;if(!pattern.test(s))return null;return Number(decimal==='comma'?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,''));}
export const isTotal=s=>/^(?:sub\s*total|total(?:es)?|saldo(?: inicial| final)?|saldo anterior|fondo asignado|resumen|acumulado|importe total|total general)(?:\s*[:\-]|\s*$|\s+)/i.test(normalize(s));
export function fingerprint(r){return JSON.stringify([r.date,normalize(r.concept).replace(/\s+/g,' '),Math.round(r.amount*100),normalize(r.receipt),normalize(r.ruc)]);}
export const dims={family:'Familia de gasto',familyCategory:'Familia y rubro',category:'Rubro',categoryMonth:'Rubro y mes',categoryYear:'Rubro y año',month:'Mes',year:'Año',provider:'Proveedor',status:'Estado',bank:'Banco',type:'Tipo',source:'Origen',area:'Área / caja'};
export const groupsFor=(rows,dim)=>{const m=new Map();for(const r of rows){const k=String(r[dim]||'Sin dato');const g=m.get(k)||{group:k,count:0,cents:0,paidCents:0,pendingCents:0};const cents=Math.round(Number(r.amount)*100);g.count++;g.cents+=cents;if(r.status==='Pagado')g.paidCents+=cents;if(r.status==='Pendiente')g.pendingCents+=cents;m.set(k,g);}return [...m.values()].sort((a,b)=>dim==='month'||dim==='year'?a.group.localeCompare(b.group):b.cents-a.cents||a.group.localeCompare(b.group)).map(g=>({group:g.group,count:g.count,amount:g.cents/100,paid:g.paidCents/100,pending:g.pendingCents/100}));};

// Dashboard uses registered operations once; monthly reference is an independent comparison.
export function dashboardModel(period,ops,budget=null){
 const year=period.slice(0,4),annual=ops.filter(o=>String(o.date).startsWith(year+'-')),monthOps=annual.filter(o=>String(o.date).startsWith(period));
 const sum=(list,key='amount')=>list.reduce((s,o)=>s+Math.round(Number(o[key]||0)*100),0)/100;
 const months=Array.from({length:12},(_,i)=>{const month=year+'-'+String(i+1).padStart(2,'0'),list=annual.filter(o=>String(o.date).startsWith(month)),b=budget?.months?.find(r=>r.month===month);return {month,count:list.length,registered:sum(list),reference:b?.reference??null,planned:b?.planned??null,paid:sum(list.filter(o=>o.status==='Pagado')),pending:sum(list.filter(o=>o.status==='Pendiente'))};});
 const groups=budget?(budget.familyDetail||budget.detail.filter(r=>r.registered!==0).map(r=>({family:familyFor(r.category),amount:r.registered}))):annual.map(r=>({...r,family:familyFor(r.category,r.concept)}));
 const referenceMonths=months.filter(m=>m.reference!==null),plannedMonths=months.filter(m=>m.planned!==null);
 return {year,month:months.find(m=>m.month===period),annual:sum(annual),count:annual.length,paid:sum(annual.filter(o=>o.status==='Pagado')),pending:sum(annual.filter(o=>o.status==='Pendiente')),months,groups:groupsFor(groups,'family'),reference:referenceMonths.length?sum(referenceMonths,'reference'):null,referenceRegistered:sum(referenceMonths,'registered'),referenceCount:referenceMonths.length,planned:plannedMonths.length?sum(plannedMonths,'planned'):null,plannedRegistered:sum(plannedMonths,'registered'),plannedCount:plannedMonths.length,cashCount:budget?.cash?.length??null,cashReview:budget?.cash?.filter(c=>!c.state.startsWith('Vinculada')).length??null,latest:annual.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.id)-Number(a.id)).slice(0,8)};
}
