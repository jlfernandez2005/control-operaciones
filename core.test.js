import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  global.window = global.window || {};
  return import('../public/app-core.js');
});

describe('core utils', () => {
  it('fd formatea fecha válida', () => { expect(window.AppCore.fd('2026-11-10')).toBe('10/11/2026'); });
  it('fd devuelve input si no es fecha', () => { expect(window.AppCore.fd('bad')).toBe('bad'); });
  it('ml septiembre → setiembre', () => { expect(window.AppCore.ml('2026-09-05')).toBe('05 de setiembre'); });
  it('bank CCI BCP', () => { expect(window.AppCore.bank('00219113408177002956')).toBe('BCP'); });
  it('bank 13 dígitos Interbank', () => { expect(window.AppCore.bank('1234567890123')).toBe('Interbank'); });
  it('isDate ok', () => { expect(window.AppCore.isDate('2026-01-01')).toBe(true); });
  it('isDate rechaza formato corto', () => { expect(window.AppCore.isDate('2026-1-1')).toBe(false); });
});