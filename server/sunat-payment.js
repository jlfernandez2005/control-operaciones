import {normalize} from './finance-core.js';
export const isSunat=o=>/\bsunat\b/.test(normalize(o.concept))||/\bsunat\b/.test(normalize(o.provider_name));
const cents=n=>Math.round(Number(n)*100);
const receiptKey=s=>normalize(s).replace(/[^a-z0-9]/g,'');
export function sunatConflict(ops,b){
 const receipt=receiptKey(b.receipt);
 for(const o of ops){if(o.deleted_at||!isSunat(o))continue;
  if(receipt&&receipt===receiptKey(o.receipt))return {id:o.id,reason:'Ya existe un pago SUNAT con ese comprobante.'};
  if(cents(o.amount)!==cents(b.amount))continue;
  if(o.date===b.date)return {id:o.id,reason:'Ya existe un pago SUNAT con esa fecha e importe.'};
  if(String(o.date).slice(0,7)===b.date.slice(0,7)&&(!receipt||!receiptKey(o.receipt)||!b.distinctConfirmed))return {id:o.id,reason:'Existe un pago SUNAT del mismo importe en otra fecha del mes. Revisa el registro. Si es otro pago, indica ambos comprobantes diferentes y confirma.'};
 }
 return null;
}
export function sunatConcept(period,detail=''){
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
 return `Pago directo SUNAT - ${months[Number(period.slice(5))-1]} ${period.slice(0,4)}${detail?' · '+detail:''}`;
}
