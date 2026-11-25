import {describe,it,expect} from 'vitest';
import {suggestCategory,dateValue,amountValue,isTotal,groupsFor,fingerprint} from '../server/finance-core.js';
describe('SISFIA finance',()=>{
 it('categoriza solo coincidencias no ambiguas',()=>{expect(suggestCategory('Servicio de limpieza')).toBe('Limpieza e higiene');expect(suggestCategory('Mantenimiento de computadoras')).toBe('Mantenimiento Tecnológico');expect(suggestCategory('Limpieza y transporte')).toBe('Sin clasificar');});
 it('valida formatos de fechas y montos',()=>{expect(dateValue('29/02/2025')).toBe('');expect(dateValue('31/12/2026')).toBe('2026-12-31');expect(amountValue('S/ 1,234.56')).toBe(1234.56);expect(amountValue('1.234,56','comma')).toBe(1234.56);expect(amountValue('USD 1.00')).toBeNull();expect(amountValue('1,23','dot')).toBeNull();expect(isTotal('TOTAL GENERAL')).toBe(true);});
 it('separa pagado y pendiente sin error de redondeo',()=>{expect(groupsFor([{category:'A',amount:.1,status:'Pagado'},{category:'A',amount:.2,status:'Pendiente'}],'category')).toEqual([{group:'A',count:2,amount:.3,paid:.1,pending:.2}]);});
 it('normaliza huellas de importación',()=>{expect(fingerprint({date:'2026-01-01',concept:'Límpieza  general',amount:1,ruc:'',receipt:'A'})).toBe(fingerprint({date:'2026-01-01',concept:'limpieza general',amount:1,ruc:'',receipt:'a'}));});
});
