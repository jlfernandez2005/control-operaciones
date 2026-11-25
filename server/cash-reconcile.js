// Amounts are validated by the route; integer cents avoid floating-point drift.
const cents = n => Math.round(n * 100);
export function reconcileCash({rows,meta,declaredTotal,correctedTotal,correctionNote,originalFund}) {
  const actual = rows.reduce((n,r)=>n+cents(r.amount),0);
  const original = declaredTotal == null ? null : cents(declaredTotal);
  const mismatch = original !== null && actual !== original;
  if (mismatch && (correctedTotal == null || cents(correctedTotal)!==actual || !correctionNote?.trim())) {
    return {error:'El total difiere del impreso. Confirma el total corregido y el motivo antes de guardar.'};
  }
  if (correctedTotal != null && cents(correctedTotal)!==actual) return {error:'El total corregido debe coincidir con los gastos seleccionados.'};
  return {declaredTotal:declaredTotal??null, correctedTotal:mismatch?actual/100:null, actualTotal:actual/100, difference:original===null?null:(actual-original)/100, correctionNote:mismatch?correctionNote.trim():null, originalFund:originalFund??null, fund:meta.fund, balance:(cents(meta.fund)-actual)/100};
}
